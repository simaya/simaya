var utils = require("./utils");
var node = require("../simaya/models/node")(utils.app);
var worker = require("gearmanode").worker({servers: utils.app.gearmanServer});

var connect = function(fn) {
  utils.db.open(fn);
}

var connected = function(fn) {
  console.log("Connected");
}

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
