var fs = require("fs");
var hawk = require("hawk");
var _  = require("lodash");
var x509 = require('x509');
var async = require("async");
var crypto = require("crypto");
var uuid = require("node-uuid");
var qs = require("querystring");
var request = require("request");
var validUrl = require("valid-url");
var fp = require("ssh-fingerprint");
var spawn = require("child_process").spawn;
var xz = require("xz-pipe");

/**
 * Expose node functions
 */
module.exports = register;

var nodeStates = {
  REQUESTED : "requested",
  CONNECTED : "connected",
  DISABLED : "disabled"
};

var collections = [
  "user",
  "disposition",
  "letter",
  "calendar",
  "contacts",
  "deputy",
  "jobTitle",
  "organization",
  "timeline"
];

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

  this.Nodes = this.db("node");
  this.Keys = this.db("nodeRequestKey");
  this.NodeSync = this.db("nodeSync");
  this.NodeLocalSync = this.db("nodeLocalSync");
  this.Log = this.db("nodeConnectionLog");
  this.LocalNodes = this.db("nodeLocalNode");
  this.NodeRequests = this.db("nodeRequest");
  this.Users = this.db("user");
}

/**
 * Request key for initiating a local node connection
 * @param  {Object}   options [description]
 * @param  {Function} fn      callback
 */
Node.prototype.requestKey = function (options, fn){
  if (!options) throw new TypeError ("settings required");

  var keyHash = new Buffer(uuid.v4()).toString("base64");
  var secretHash = new Buffer(uuid.v4()).toString("base64");

  var secret = "";
  for (var i = 0; i < 10; i++){
    var idx = Math.floor(Math.random() * secretHash.length);
    secret += secretHash[idx];
  }

  var nonce = "";
  for (var i = 0; i < 5; i++){
    var idx = Math.floor(Math.random() * secretHash.length);
    nonce += secretHash[idx];
  }

  var key = {
    key : keyHash,
    secret : secret,
    nonce : nonce,
    date : new Date(),
    administrator : options.administrator
  };

  this.Keys.insert(key, function(err, saved){
    if (err) return fn(err);
    if (saved && Array.isArray(saved)){
      return fn (null, saved[0]);
    }
    fn(null, saved);
  });
}

/**
 * Get request key for attempting a request to `S`
 * @param  {[type]}   options [description]
 * @param  {Function} fn      [description]
 * @return {[type]}           [description]
 */
Node.prototype.getRequestKey = function (options, fn){
  if (!options) throw new TypeError ("settings required");
  var query = {};
  for (var k in options){
    query[k] = options[k];
  }
  this.Keys.findOne({ $query : query, $orderby : {_id : -1} }, fn);
}

/**
 * At local node, create a request to siMAYA to register a node using a certificate
 * @param  {Object}   options: key (required), secret (required)
 */
Node.prototype.request = function(options, fn){

  if (!options) return fn (new Error("settings required"));
  if (!options.name) return fn (new Error("node name is required"));
  if (!validUrl.isUri(options.url)) return fn (new Error("a valid url is required"));

  options.host = options.url.replace(/\/$/, "");
  if (options.url.lastIndexOf("/") == options.url.length - 1){
    options.url += "l/nodes";
  } else {
    options.url += "/l/nodes";
  }

  var self = this;

  fs.readFile(options.file, function(err, content){
    if (err) return fn(err);

    // just in case we have a big file, do it async
    fs.unlink(options.file, function(){

      var certInfo;

      try {
        content = content.toString("utf8");
      } catch(err){
        content = "";
      }

      try {
        certInfo = x509.parseCert(content);  
      } catch(ex){
        certInfo = {};
      }

      if (!certInfo.subject){
        return fn(new Error("no subject"));
      }

      var subjectIdentifier = "";
      if (certInfo.subject){
        for (var k in certInfo.subject){
          subjectIdentifier += certInfo.subject[k] + ";";
        }
      }

      var fingerprint;
      try{
        fingerprint = fp(content);
      } catch (ex){
        fingerprint = "";
      }

      // at local node, it is not allowed to have nodes with a same cert
      self.LocalNodes.findOne({ fingerprint : fingerprint }, function(err, node){
        if (err) return fn(err);
        if (node) return fn(new Error("certificate exists"));

        // do request using hawk header
        var credentials = {
          id : options.key, // this is from the provider
          key : options.secret, // this is from the provider
          algorithm : "sha256"
        };

        var payload = JSON.stringify({
          installationId : self.app.simaya.installationId,
          cert : content, 
          name : options.name 
        });
        var nodeRequestOption = {
          uri : options.url,
          method : "POST",
          headers: {
            "Content-Type" : "application/json"
          },
          body : payload,
          json : true
        }

        var header = hawk.client.header(
        nodeRequestOption.uri, 
        nodeRequestOption.method, 
        { 
          credentials: credentials, 
          ext: "simaya-l",
          timestamp: Date.now(),
          nonce: Date.now().valueOf(),
          app: credentials.id,
          dlg: "simaya-l-registration",
          contentType : "application/json",
          hash : crypto.createHash("sha256").update(payload).digest("base64"),
          payload : payload
        });

        nodeRequestOption.headers.Authorization = header.field;

        request(nodeRequestOption, function(err, res, body){
          console.log(arguments);
          if (err) return fn(err);
          // error message: body.output.payload.message
          if (res.statusCode != 200 && res.statusCode != 201) return fn(new Error("request failed"));

          // todo: validate the reply from server
          // if (valid){}
          var localNode = {
            installationId : self.app.simaya.installationId,
            uri: options.host,
            name : options.name,
            administrator : body.administrator,
            cert : content,
            fingerprint : fingerprint,
            requestDate : new Date(),
            state : nodeStates.REQUESTED
          };

          self.LocalNodes.insert(localNode, function(err){
            fn (err, localNode);
          });
        });
      });
    });
  });
} 

Node.prototype.processRequest = function(options, fn){
  
  var self = this;
  var credentials = options.credentials || {};
  var payload = options.payload || {};
  
  // todo: check if the credentials.user is a the valid and active user
  
  // check the certificate
  try {
    certInfo = x509.parseCert(payload.cert);  
  } catch(ex){
    certInfo = {};
  }

  if (!certInfo.issuer){
    return fn(new Error("no issuer"));
  }

  if (!certInfo.subject){
    return fn(new Error("no subject"));
  }

  var issuerIdentifier = "";
  if (certInfo.issuer){
    for (var k in certInfo.issuer){
      issuerIdentifier += certInfo.issuer[k] + ";";
    }
  }

  var subjectIdentifier = "";
  if (certInfo.subject){
    for (var k in certInfo.subject){
      subjectIdentifier += certInfo.subject[k] + ";";
    }
  }

  var fingerprint;
  try{
    fingerprint = fp(payload.cert);
  } catch (ex){
    fingerprint = "";
  }

  // todo: if subjectIdentifier == identifier in provider's settings (it should be sync fn?)
  this.Nodes.findOne({fingerprint : fingerprint, subject : subjectIdentifier}, function(err, cert){
    if (err) return fn(err);
    if (cert) return fn(new Error("cert is registered for a node")); // todo check it status

    self.NodeRequests.findOne({fingerprint : fingerprint, subject : subjectIdentifier}, function(err, cert){
      if (err) return fn(err);
      if (cert) return fn(new Error("cert is in use for a node request"));

      self.Users.findOne({username : credentials.user}, function(err, administrator){
        if (err) return fn(err);

        if (!administrator) return fn(new Error("administrator not found"));
        if (!administrator.active) return fn(new Error("administrator inactive"));
        if (administrator.roleList.indexOf("localadmin") < 0) return fn(new Error("administrator invalid"));
        
        var nodeRequest = {
          installationId : payload.installationId,
          name : payload.name,
          administrator : credentials.user,
          publicCert : payload.cert,
          fingerprint : fingerprint,
          subject : subjectIdentifier,
          issuer : issuerIdentifier,
          date : new Date()
        };

        self.NodeRequests.insert(nodeRequest, function(err, request){
          if (err) return fn(err);
          if (request && Array.isArray(request)){
            return fn(null, request[0]);
          }
          fn(null, request);
        });

      });
    });
  });
}

/**
 * Get requests list or a request by _id
 * @param  {Object}   options [description]
 * @param  {Function} fn      callback
 */
Node.prototype.localNodes = function(options, fn){
  var self = this;
  if (typeof options == "function"){
    fn = options;
    options = {};
  }
  if (Object.keys(options).indexOf("_id") >= 0){
    return self.LocalNodes.findOne({_id : this.ObjectID(options._id)}, fn);  
  }
  self.LocalNodes.findArray(options, {sort : {requestDate : -1} }, fn);
} 

/**
 * Get requests list or a request by _id
 * @param  {Object}   options [description]
 * @param  {Function} fn      callback
 */
Node.prototype.nodes = function(options, fn){
  var self = this;
  if (typeof options == "function"){
    fn = options;
    options = {};
  }
  if (Object.keys(options).indexOf("_id") >= 0){
    return self.Nodes.findOne({_id : this.ObjectID(options._id)}, fn);  
  }
  self.Nodes.findArray(options, fn);
} 

/**
 * Get requests list or a request by _id
 * @param  {Object}   options [description]
 * @param  {Function} fn      callback
 */
Node.prototype.nodeRequests = function(options, fn){
  var self = this;
  if (typeof options == "function"){
    fn = options;
    options = {};
  }
  if (Object.keys(options).indexOf("_id") >= 0){
    return self.NodeRequests.findOne(options, fn);  
  }
  self.NodeRequests.findArray(options, fn);
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

    var connectedNode = {
      installationId : node.installationId,
      name : node.name,
      subject : node.subject,
      issuer : node.issuer,
      administrator : node.administrator,
      fingerprint : node.fingerprint,
      publicCert : node.publicCert,
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
  options = options || {};
  var ctx = options.context || this;
  var Users = ctx.Users;
  var username = options.username;
  Users.findOne({username : username}, function(err, user){
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
    return req.administrator.username || req.administrator;
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
    if (!node) return fn(new Error("not found"));
    NodeRequest.remove({_id : node._id}, fn);
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

// a slave registers a sync request to the master
// the master would reply a sync id
Node.prototype.requestSync = function(options, fn) {
  var self = this;
  var installationId = options.installationId;

  self.Nodes.findOne({installationId: installationId}, function(err, result) {
    if (err) return fn(err);
    if (!result) return fn(new Error("Installation ID is not found"));
    self.NodeSync.findOne({installationId: installationId}, function(err, sync) {
      if (err) return fn(err);
      
      if (sync && !sync.finished) {
        return fn(null, {
          _id: sync._id,
          stage: sync.stage,
          manifest: sync.manifest
        });
      } else {
        var _id = new self.ObjectID();
        var data = {
          _id: _id,
          installationId: options.installationId,
          startDate: new Date(),
          finished: false,
          stage: "init",
          manifest: [],
        };
        self.NodeSync.insert(data, function(err, result) {
          fn(null, data);
        });
      }
    });
  });
}

Node.prototype.dump = function(options, fn) {
  var self = this;
  var query = JSON.stringify(options.query).replace(/"ISODate\((.*)\)DateISO"/g, "new Date($1)");
  var serverConfig = self.app.dbClient.serverConfig;
  var args = [];
  args.push("-h");
  args.push(serverConfig.host);
  args.push("--port");
  args.push(serverConfig.port);
  args.push("-d" );
  args.push(self.app.dbClient.databaseName);
  args.push("-c" );
  args.push(options.collection);
  args.push("--jsonArray");
  args.push("-q" );
  args.push(query); 

  console.log(args);
  var filename = options.syncId + ":" + options.collection;
  var id = new self.app.ObjectID();
  var data = {
    _id: id,
    filename: filename,
    j: true,
    metadata: {
      type: "sync-collection",
      syncId: options.syncId
    }
  }
  var writeStream = self.app.grid.createWriteStream(data);
  var child = spawn("mongoexport",args);

  child.stdout.pipe(xz.z()).pipe(writeStream);
  child.stderr.on("data", function(err) {
    console.log(err.toString());
  });
  child.on("close", function(code) {
    fn(data);
  });
}

// the master prepares the sync
Node.prototype.masterPrepareSync = function(options, fn) {
  var self = this;
  var funcs = [];
  var lastSyncDate = new Date();
  var installationId;

  var done = function(err, result) {
    self.Nodes.update({
      installationId: installationId,
    }, {
      $set: {
        lastSyncDate: lastSyncDate
      }
    }, function(err, result) {
      fn(err, result);
    });
  }
  var updateSync = function(err, result) {
    var fs = self.db("fs.files");
    var ids = [];
    _.each(result, function(item) {
      ids.push(item._id);
    });
    fs.find({ _id: { $in: ids }}, function(err, result) {
      if (err) return done(err, result);
      result.toArray(function(err, manifest) {
        if (err) return done(err, manifest);
        self.NodeSync.update({
          _id: options.syncId 
        }, {
          $set: {
            manifest:manifest,
            stage: "manifest",
          }
        }, function(err, updateResult) {
          done(err, updateResult);
        });
      });
    })
  }

  var start = function(date) {
    options.startDate = date;
    _.each(collections, function(item) {
      var f = self["masterPrepareSync_" + item];
      if (f && typeof(f) === "function") {
        funcs.push(function(cb) {
          f.call(self, options, cb);
        });
      }
    });
    console.log("Running preparation");
    async.parallel(funcs, function(err, result) {
      console.log("done dumping");
      setTimeout(function() {
        updateSync(err, result);
      }, 1000);
    });
  }

  var findNode = function(installationId, fn) {
    self.Nodes.findOne({installationId: installationId}, function(err, result) {
      if (result) {
        var date = result.lastSyncDate || new Date(0);
        start(date, fn);
      } else {
        return fn(new Error("Sync Id is not found:", options.syncId));
      }
    });
  }

  var findSync = function(syncId, fn) {
    self.NodeSync.findOne({_id: syncId}, function(err, result) {
      if (result) {
        fn(null, result);
      } else {
        return fn(new Error("Sync Id is not found:", options.syncId));
      }
    });
  }

  findSync(options.syncId, function(err, result) {
    if (err) return done(err);
    console.log("Installation ID", result);
    if (result.stage == "init") {
      installationId = result.installationId;
      findNode(result.installationId);
    } else {
      fn(err, result);
    }
  });
}

var ISODate = function(date) {
  return "ISODate(" + date.valueOf() + ")DateISO";
}

Node.prototype.masterPrepareSync_letter = function(options, fn) {
  var self = this;
  var startDate = options.startDate;
  var localId = { $regex: "^u" + options.localId + ":" };
  var query = {
    $or: [
    { originator: localId },
    { sender: localId },
    { recipients: localId },
    { ccList: localId },
    { reviewers: localId },
    ],
    modifiedDate: { $gte: ISODate(startDate) }
  }

  options.collection = "letter";
  options.query = query;
  this.dump(options, function(data) {
    console.log("Done dumping letter");
    fn(null, data);
  });
}

Node.prototype.masterPrepareSync_user = function(options, fn) {
  var startDate = options.startDate;
  options.collection = "user";
  options.query = {
    modifiedDate: { $gte: ISODate(startDate) }
  };

  this.dump(options, function(data) {
    console.log("Done dumping user");
    fn(null, data);
  });
}

Node.prototype.manifestContent = function(options, fn) {
  var self = this;
  var index = options.index;
  var syncId = options.syncId;
  var stream = options.stream;

  if (index >= 0 && syncId && stream) {
    self.NodeSync.findOne({_id: self.ObjectID(syncId)}, function(err, result) {
      if (!result) return fn(new Error("SyncId is not found"));

      if (result.manifest && index > result.manifest.length) return fn(new Error("Index is out of bound"));

      var data = result.manifest[index];
      if (!data._id) return fn(new Error("File in the manifest is not found"));

      var readStream = self.app.grid.createReadStream({
        _id: data._id
      });
      readStream.on("end", function() {
        fn(null);
      });
      readStream.on("error", function(err) {
        fn(new Error(err));
      });
      readStream.pipe(stream);
    });
  } else {
    fn(new Error("Invalid arguments"));
  }
}

Node.prototype.checkNode = function(options, fn) {
  var self = this;
  var installationId = options.installationId;

  var findNode = function(cb) {
    self.Nodes.findOne({ installationId : installationId}, 
        {state:1,_id:1},
        function(err, node){
      if (err) return cb(err);
      if (!node) return cb(new Error("Node is not found"));
      cb(null, node);
    });
  }

  if (installationId) {
    findNode(function(err, node) {
      if (err) return fn(err);
      return fn(err, node);
    });
  } else {
    fn(new Error("Invalid argument"));
  }
}


Node.prototype.localCheckNode = function(options, fn) {
  var self = this;
  var installationId = options.installationId;

  console.log("x0");
  var findNode = function(cb) {
    self.LocalNodes.findOne({ installationId : installationId}, function(err, node){
      if (err) return cb(err);
      if (!node) return cb(new Error("Node is not found"));
      cb(null, node);
    });
  }

  var done = function(node) {
    fn(null, {
      _id: node._id,
      state: node.state,
    });
  }

  if (installationId) {
    findNode(function(err, node) {
      if (err) return fn(err);

      var requestOptions = {
        uri: (node.uri.replace(/\/$/, "") + "/nodes/check/" + installationId)
      }

      request(requestOptions, function(err, res, body) {
        if (err) return fn(err);
        if (res.statusCode != 200 && res.statusCode != 201) return fn(new Error("request failed"));

        var result = JSON.parse(body);
        if (result.state != node.state) {
          self.LocalNodes.update({ installationId : installationId}, 
              {
                $set: { state: result.state }
              },
              function(err, node){
            if (err) return fn(err);
            done(result);
          });
        } else {
          done(node);
        }
      });
    });
  } else {
    fn(new Error("Invalid argument"));
  }
}

Node.prototype.localSyncNode = function(options, fn) {
  var self = this;
  var installationId = options.installationId;

  var findNode = function(cb) {
    self.LocalNodes.findOne({ installationId : installationId}, function(err, node){
      if (err) return cb(err);
      if (!node) return cb(new Error("Node is not found"));
      cb(null, node);
    });
  }

  var done = function(node) {
    fn(null, {
      _id: node._id,
      state: node.state,
    });
  }

  if (installationId) {
    findNode(function(err, node) {
      if (err) return fn(err);

      var requestOptions = {
        uri: (node.uri.replace(/\/$/, "") + "/nodes/sync/request/" + installationId)
      }

      request(requestOptions, function(err, res, body) {
        if (err) return fn(err);
        if (res.statusCode != 200 && res.statusCode != 201) return fn(new Error("request failed"));

        var result = JSON.parse(body);
        self.NodeLocalSync.update({ installationId : installationId}, 
            {
              $set: { 
                date: new Date(),
                state: "init" 
              }
            }, 
            {
              upsert: true
            },
            function(err, node){
              if (err) return fn(err);
              done(result);
            });
      });
    });
  } else {
    fn(new Error("Invalid argument"));
  }
}

Node.prototype.checkSync = function(options, fn) {
  var self = this;
  var installationId = options.installationId;
  var f = self.NodeSync.findOne;
  if (options.local) {
    f = self.NodeLocalSync.findOne;
  }

  var findNode = function(cb) {
    f({ installationId: installationId }, 
        function(err, node){
      if (err) return cb(err);
      if (!node) return cb(null, {});
      cb(null, node);
    });
  }

  if (installationId) {
    findNode(function(err, node) {
      if (err) return fn(err);
      return fn(err, node);
    });
  } else {
    fn(new Error("Invalid argument"));
  }
}

function register (app){
  return Node(app);
}
