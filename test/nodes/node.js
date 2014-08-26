var prefix = __dirname + "/..";
var prefixModel = prefix + "/../simaya/models"

var utils = require(prefix + "/utils");
utils.app.mongolian = true;

var nodes = utils.app.db("node");
var localNodes = utils.app.db("localNode");
var nodeRequests = utils.app.db("nodeRequest");
var nodeConnectionLog = utils.app.db("nodeConnectionLog");

var fs = require("fs");
var async = require("async");
var User = require("./user")(utils.app);
var chance = require("chance").Chance(9);
var Node = require(prefixModel + "/node.js")(utils.app);

var keyPub = fs.readFileSync(__dirname + "/key.pub");
var running = false;

var holder = {
  users : [],
  currentUser : {},
  nodes : [],
  currentNode : {}
}

function clear(fn){

  var tasks = [
    function(cb){
      nodes.remove({}, {j:false}, cb);
    },
    function(cb){
      localNodes.remove({}, {j:false}, cb);
    },
    function(cb){
      nodeRequests.remove({}, {j:false}, cb);
    },
    function(cb){
      nodeConnectionLog.remove({}, {j:false}, cb);
    }
  ]

  async.parallel(tasks, fn);
}

function prepare(done){
  clear(function(err){
    if (err) return done(err);
    User.generate(function(err){
      if (err) return done(err);
      holder.users = User.generated;
      done();
    });
  });
}

describe ("Nodes", function(){

  before(function(done) {
    if (!utils.db.openCalled){
      return utils.db.open(function(){
        prepare(done());
      });
    }
    prepare(done());
  });

  describe ("requests", function(){
    it ("should do request for a brand new node", function(done){

      function request(user, fn){

        var filename = chance.word({length : 4}) + ".pub";
        var path = __dirname + "/" + filename;
        fs.writeFileSync(path, chance.word({length : 10}) + keyPub);

        var node = {
          administrator : user,
          name : "siMAYA L " + chance.word({length : 8}), 
          file : {
            originalFilename : filename,
            path : path
          }    
        }

        Node.request(node, function(err, saved){
          if (err) return fn(err);
          fn(null, saved[0]);
        });
      }

      async.mapSeries(holder.users, request, function(err, data){
        done(err);
      });      
      
    });

    it ("should get the requested nodes", function(done){
      done();
    });
    
    it ("should remove a request", function(done){
      done();
    });

  });
});