var utils = require("./utils");
var node = require("../simaya/models/node")(utils.app);
var worker = require("gearmanode").worker({servers: utils.app.gearmanServer});
var request = require("request");
var checkOptions = {
  installationId: process.env.INSTALL_ID || "1"
};

var connect = function(fn) {
  utils.db.open(fn);
}

var connected = function(fn) {
  console.log("Connected");
  check(checkOptions);
}

var download = function(data) {
  console.log("Start downloading", data);

  node.localSaveDownload(data,
  function() {
    console.log("Download is saved");
    check(checkOptions);
  })
}

var tryDownload = function(sync) {
  var options = {
    syncId: sync._id
  };
  node.localNextDownloadSlot(options, function(err, data) {
    console.log("Try download", sync, data);
    if (data && data.stage == "started") {
      if (data.inProgress) {
        console.log("Download is on the way");

        setTimeout(function() {
          check(checkOptions);
        }, 5000);
      } else {
        console.log("Download is started");
        download(data);
      }
    } else {
      setTimeout(function() {
        check(checkOptions);
      }, 5000);
    }
  })
}

var check = function(options) {
  node.localSyncNode(options, function(err, result) {
  console.log("check", result);
    if (result && result.stage == "manifest") {
      tryDownload(result);
    } else if (result && result.stage != "completed") {
      setTimeout(function() {
        check(options);
      }, 5000);
    }
  });
}

worker.addFunction("sync", function(job) {
  if (job.payload && job.payload.length > 0) {
    var payload = JSON.parse(job.payload.toString());
    if (payload.installationId) {
      var options = {
        installationId: payload.installationId 
      }
      node.localSyncNode(options, function(err, result) {
        if (result && result.stage != "completed") {
          setTimeout(function() {
            check(options);
          }, 5000);
        }
        if (err) {
          job.workComplete(JSON.stringify({result: false, reason: err.message}));
        } else {
          job.workComplete(JSON.stringify({result: true, data:result}));
        }
      });
      return;
    }
  }
  job.workComplete(JSON.stringify({result: false, reason: "no payload"}));
});

connect(connected);
