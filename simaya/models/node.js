var fs = require("fs");
var _  = require("lodash");
var async = require("async");
var fp = require("ssh-fingerprint");

/**
 * Expose node functions
 */
module.exports = register;

var nodeStates = {
  REQUESTED : "requested",
  CONNECTED : "connected",
  DISABLED : "disabled"
};

/**
 * Nodes manager
 * @param {Object} app root object of this express app 
 */
function Node(app){
  if (!(this instanceof Node)) return new Node(app);
  if (!app) throw new TypeError("settings required");
  this.app = app;
  this.db = app.db;
  this.ObjectID = app.ObjectID;
}

/**
 * Create a request to siMAYA to register a node as a registered node
 * @param  {Object}   options: name (required), administrator (required)
 */
Node.prototype.request = function(options, fn){

  if (!options) return fn (new Error("settings required"));
  if (!options.name) return fn (new Error("node name is required"));
  if (!options.administrator) return fn (new Error("node administrator is required"));

  var NodeRequests = this.db("nodeRequest");
  var Nodes = this.db("node");

  var request = {
    name : options.name,
    administrator : options.administrator,
    date : options.date || new Date(),
    state : nodeStates.REQUESTED
  }

  this.saveFile(options.file, function(err, saved){
    if (err) return fn(err);
    request.fileId = saved.fileId;
    request.fingerprint = saved.fingerprint;

    Nodes.findOne({ fingerprint : saved.fingerprint }, function(err, node){
      if (err) return fn(err);
      if (node){
        return fn(new Error("key exists"));
      }

      NodeRequests.findOne({ fingerprint : saved.fingerprint }, function(err, req){

        if (err) return fn(err);
        if (req){
          return fn(new Error("key requested"));
        }
        NodeRequests.insert(request, fn);
        
      });

    });
  });
} 

/**
 * Get requests list or a request by _id
 * @param  {Object}   options [description]
 * @param  {Function} fn      callback
 */
Node.prototype.requests = function(options, fn){
  if (typeof options == "function"){
    fn = options;
    options = {};
  }

  if (!options.administrator){
    options.$or = [ { state : { $exists : false} }, { state : "requested" }];  
  }
  
  var NodeRequest = this.db("nodeRequest");

  if (Object.keys(options).indexOf("_id") >= 0){
    return NodeRequest.findOne(options, fn);  
  }
  NodeRequest.findArray(options, fn);
} 

/**
 * Get requests list or a request by _id
 * @param  {Object}   options [description]
 * @param  {Function} fn      callback
 */
Node.prototype.nodes = function(options, fn){
  if (typeof options == "function"){
    fn = options;
    options = {};
  }

  var Nodes = this.db("node");

  if (Object.keys(options).indexOf("_id") >= 0){
    return Nodes.findOne(options, fn);  
  }
  Nodes.findArray(options, fn);
} 

/**
 * Save file certificate
 * @param  {Object}   options [description]
 */
Node.prototype.saveFile = function(options, fn){
  var fileId = new this.ObjectID();
  var store = this.app.store(fileId, options.originalFilename || "certificate", "w");
  store.open(function(err, gridStore){
    if (err) return fn(err);
    gridStore.writeFile(options.path, function(err, written){
      if (err) return fn(err);

      fs.readFile(options.path, function(err, content){
        if (err) return fn(err);
        fs.unlink(options.path, function(err){
          if (err) return fn(err);
          var fingerprint;
          try{
            fingerprint = fp(content.toString());
          } catch(err){
            return fn(err);
          }
          written.fingerprint = fingerprint;
          fn(null, written);
        });
      });
    });
  });
}

Node.prototype.loadFile = function(options, fn){
  var store = this.app.store(this.ObjectID(options.fileId), "", "r");
  store.open(function(err, gridStore){
    if (err && fn) return fn(err);

    var buffer = "";
    
    var gridStream = gridStore.stream(true);

    gridStream.on("data", function(chunk) {
      buffer += chunk;
    });
    
    gridStream.on("error", function(error) {
      if (fn) return fn(error);
    });

    gridStream.on("end", function() {
      if (fn) fn(null, buffer);
    });

    var filename = gridStore.filename || "file.pub";
    filename = filename.substr(0, filename.lastIndexOf("."));
    filename += "_" + options.fileId;
    if (options.stream && options.stream.header){
      options.stream.header("Content-Disposition", "attachment; filename='" + filename + ".pub'");
    }

    if (options.stream){
      gridStream.pipe(options.stream);  
    }

  });
}

/**
 * Set a node to be connected
 * @param  {[type]}   options [description]
 * @param  {Function} fn      [description]
 */
Node.prototype.connect = function(options, fn){
  var self = this;
  var Nodes = this.db("node");
  var NodeRequests = this.db("nodeRequest");
  var NodeLog = this.db("nodeConnectionLog");

  NodeRequests.findOne({_id : this.ObjectID(options._id) }, function(err, node){
    if (err) return fn(err);
    
    if (!node){
      return self.connectFromDisabled(options, fn);
    }

    self.loadFile(node, function(err, content){
      if (err) return fn(err);

      var connectedNode = {
        name : node.name,
        administrator : node.administrator,
        fingerprint : node.fingerprint,
        fileId : node.fileId,
        publicCert : content,
        date : options.date || new Date(),
        state : nodeStates.CONNECTED
      }

      Nodes.save(connectedNode, function(err, savedConnectedNode){
        if (err) return fn(err);

        NodeRequests.remove({_id : node._id}, function(err){
          if (err) return fn(err);

          var log = {
            date : new Date(),
            connectionId : savedConnectedNode._id,
            stateFrom : savedConnectedNode.state || nodeStates.REQUESTED,
            stateTo : nodeStates.CONNECTED
          };

          NodeLog.save(log, function(err){
            if (err) return fn(err);
            fn(null, savedConnectedNode);
          });

        });
      });
    });
  });
}

/**
 * Disable node
 * @param  {[type]}   options [description]
 * @param  {Function} fn      [description]
 */
Node.prototype.disable = function(options, fn){
  var Nodes = this.db("node");
  var NodeLog = this.db("nodeConnectionLog");

  Nodes.findOne({_id : this.ObjectID(options._id) }, function(err, node){
    if (err) return fn(err);
    node.state = nodeStates.DISABLED;

    var log = {
      date : new Date(),
      connectionId : node._id,
      stateFrom : nodeStates.CONNECTED,
      stateTo : nodeStates.DISABLED
    };

    NodeLog.save(log, function(err){
      if (err) return fn(err);
      Nodes.save(node, fn);
    });
  });
}

/**
 * Set disabled node to be connected again
 * @param  {[type]}   options [description]
 * @param  {Function} fn      [description]
 * @return {[type]}           [description]
 */
Node.prototype.connectFromDisabled = function(options, fn){

  var Nodes = this.db("node");
  var NodeLog = this.db("nodeConnectionLog");

  Nodes.findOne({_id : this.ObjectID(options._id) }, function(err, node){
    if (err) return fn(err);
    node.state = nodeStates.CONNECTED;

    var log = {
      date : new Date(),
      connectionId : node._id,
      stateFrom : nodeStates.DISABLED,
      stateTo : nodeStates.CONNECTED
    };

    NodeLog.save(log, function(err){
      if (err) return fn(err);
      Nodes.save(node, fn);
    });
  });
}

/**
 * Validate admin
 * @param  {Object}   options [description]
 */
Node.prototype.validAdmin = function(options, fn){
  if (!options) return fn (new Error("user required"));
  var User = this.db("user");
  User.findOne({ username : options.administrator}, function(err, admin){
    if (err) return fn(err);
    if (!admin) return fn(new Error("invalid administrator"));
    if (!admin.active) return fn(new Error("invalid administrator"));
    if (admin.roleList.indexOf("localadmin") < 0) return fn (new Error("invalid administrator"));
    return fn(null, admin);
  });
}

Node.prototype.fillUser = function (options, fn){
  var ctx = options.context || this;
  var User = ctx.db("user");
  var username = options.username;
  User.findOne({username : username}, function(err, user){
    if (err){
      return fn(err);
    }

    var obj = {
      username : user.username,
      profile : user.profile
    }

    fn(null, obj);
  });
}

Node.prototype.group = function(options, fn){

  if (!options) return fn(new Error("requests required"));
  if (!Array.isArray(options)) return fn(new Error("requests should be an array"));

  var self = this;

  var grouped = _.groupBy(options, function(req){
    return req.administrator;
  });

  var admins = Object.keys(grouped);
  var users = [];
  for (var i = 0; i < admins.length; i++){
    users.push({ username : admins[i], context : self});
  }

  async.mapSeries(users, self.fillUser, function(err, filled){

    if (err) return fn(err);

    var obj = {};

    for (var i = 0; i < filled.length; i++){
      var admin = filled[i];
      obj[admin.username] = {
        info : filled[i],
        data : _.sortBy(grouped[admin.username], function(group){ return new Date(group.date).valueOf() * -1 })
      }
    }

    fn(null, obj);
  });
}

/**
 * Remove a node
 * @param  {[type]}   options [description]
 * @param  {Function} fn      [description]
 * @return {[type]}           [description]
 */
Node.prototype.remove = function(options, fn){
  var self = this;
  var NodeRequest = this.db(options.collection || "node");
  NodeRequest.findOne({_id : this.ObjectID(options._id)}, function(err, node){
    if (err) return fn(err);
    NodeRequest.remove({_id : node._id}, function(err){
      if (err) return fn(err);
      var store = self.app.store(self.ObjectID(node.fileId), "", "r");
      store.open(function(err, gridStore){
        if (err) return fn(err);
        gridStore.unlink(fn);
      });
    });
  });
}

/**
 * Save a local node
 * @param  {[type]}   options [description]
 * @param  {Function} fn      [description]
 */
Node.prototype.save = function(options, fn){
  var node = this.db("localNode");
  options.requestDate = options.requestDate || new Date();
  node.update(
    {administrator : options.administrator}, 
    options, 
    {upsert : true}, 
    fn);
}

function register (app){
  return Node(app);
}