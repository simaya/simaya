var utils = require("./utils")(false);
var node = require("../simaya/models/node")(utils.app);
var org = require("../simaya/models/organization")(utils.app);
var worker = require("gearmanode").worker({servers: utils.app.gearmanServer});
var lock = require("../simaya/models/collectionLock.js")(utils.app)

var connect = function(fn) {
  utils.db.open(fn);
}

var connected = function(fn) {
  console.log("Connected");
}

worker.addFunction("moveOrganization", function(job) {
  if (job.payload && job.payload.length > 0) {
    var payload = JSON.parse(job.payload.toString());
    if (payload.source && payload.destination) {
      var expire = new Date;
      expire.setDate(expire.getDate() + 1);
      var data = {
        username: "system",
        expire: expire,
        name: "organization",
        module: "worker.js/moveOrganization"
      }
      var key;
      lock.start(data, function(err, result) {
        if (err) {
          return job.workComplete(JSON.stringify({result: false, reason: err.message}));
        } 
        key = result.key;
        org.move(payload.source, payload.destination, function(moveErr, result) {
          var data = {
            username: "system",
            name: "organization",
            key: key
          }
          lock.finish(data, function(err, result) {
            if (moveErr) {
              job.workComplete(JSON.stringify({result: false, reason: err.message}));
            } else {
              job.workComplete(JSON.stringify({result: true, data: "ok"}));
            }
          });
        });
      });
      return;
    }
  }
  job.workComplete(JSON.stringify({result: false, reason: "no payload"}));

});

worker.addFunction("finalize", function(job) {
  if (job.payload && job.payload.length > 0) {
    var payload = JSON.parse(job.payload.toString());
    if (payload.syncId) {
      var options = {
        syncId: payload.syncId 
      }
      node.finalizeSync(options, function(err, result) {
        if (err) {
          job.workComplete(JSON.stringify({result: false, reason: err.message}));
        } else {
          job.workComplete(JSON.stringify({result: true, data: "ok"}));
        }
      });
      return;
    }
  }
  job.workComplete(JSON.stringify({result: false, reason: "no payload"}));

});

worker.addFunction("request", function(job) {
  if (job.payload && job.payload.length > 0) {
    var payload = JSON.parse(job.payload.toString());
    if (payload.installationId) {
      var options = {
        installationId: payload.installationId 
      }
      node.requestSync(options, function(err, result) {
        if (err) {
          job.workComplete(JSON.stringify({result: false, reason: err.message}));
        } else {
          job.workComplete(JSON.stringify({result: true, data: "ok"}));
        }
      });
      return;
    }
  }
  job.workComplete(JSON.stringify({result: false, reason: "no payload"}));

});

worker.addFunction("prepare", function(job) {
  if (job.payload && job.payload.length > 0) {
    var payload = JSON.parse(job.payload.toString());
    if (payload.syncId && payload.syncId.length == 24) {
      var options = {
        syncId: utils.app.ObjectID(payload.syncId),
        isMaster: true
      }
      node.prepareSync(options, function(err, result) {
        if (err) {
          job.workComplete(JSON.stringify({result: false, reason: err.message}));
        } else {
          job.workComplete(JSON.stringify({result: true, data: result}));
        }
      });
      return;
    }
  }
  job.workComplete(JSON.stringify({result: false, reason: "no payload"}));
});


connect(connected);
