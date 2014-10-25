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
  recheck();
}

var upload = function(data) {
  console.log("Start uploading", data);

  node.localUpload(data,
  function() {
    console.log("Upload is done");
    recheck();
  })
}

var recheck = function() {
  setTimeout(function() {
    check(checkOptions);
  }, 5000);
}

var tryUpload = function(sync) {
  var options = {
    syncId: sync._id
  };
  node.localNextUploadSlot(options, function(err, data) {
    console.log("Try uploading");
    if (data && data.stage == "started") {
      if (data.inProgress) {
        console.log("Upload is on the way");

        recheck();
      } else {
        console.log("Upload is started");
        upload(data);
      }
    } else {
      console.log("Upload done");
      options.isMaster = false;
      node.updateStage(options, "upload", function() {
        recheck();
      });
    }
  })
}

var prepareUpload = function(options, fn) {
    var options = {
        syncId: utils.app.ObjectID(options._id),
        isMaster: false 
    }
    console.log("Preparing local manifest");
    node.prepareSync(options, function(err, result) {
      console.log("Local manifest is prepared");
      node.sendLocalManifest(options, function(err, result) {
        if (err) {
          console.log("Error preparing manifest", err);
          return recheck();
        }
        console.log("Local manifest sent");
        node.updateStage(options, "local-manifest", function() {
          console.log("Local manifest stage is set");
          fn();
        });
      });
    });
    return;
};

var download = function(data) {
  console.log("Start downloading", data);

  node.localSaveDownload(data,
  function(err) {
    if (err) console.log("Download is not saved", err);
    else console.log("Download is saved");
    recheck();
  })
}

var tryDownload = function(sync) {
  var options = {
    syncId: sync._id
  };
  node.localNextDownloadSlot(options, function(err, data) {
    if (err) return console.log("Unable to get next download", err);
    console.log("Try download", sync, data);
    if (data && data.stage == "started") {
      if (data.inProgress) {
        console.log("Download is on the way");

        recheck();
      } else {
        console.log("Download is started");
        download(data);
      }
    } else {
      options.isMaster = false;
      node.updateStage(options, "download", function() {
        recheck();
      });
    }
  })
}

var askForCompletion = function(sync) {
  var options = {
    syncId: sync._id
  };
  node.localFinalizeSync(options, function(err) {
    console.log("Sync is done")
  });
};

var check = function(options) {
  node.localSyncNode(options, function(err, result) {
    console.log(arguments);
    if (err) console.log("Check error", err);
    if (!result) console.log("No active sync, standing by");
    if (result && result.stage == "manifest") {
      console.log("MANIFEST");
      tryDownload(result);
    } else if (result && result.stage == "download") {
      console.log("DOWNLOAD");
      prepareUpload(result,function() {
        recheck();
      });
    } else if (result && result.stage == "local-manifest") {
      console.log("LOCAL-MANIFEST");
      tryUpload(result);
    } else if (result && result.stage == "upload") {
      askForCompletion(result);
    } else if (result && result.stage != "completed") {
      console.log("Stage is", result.stage, ": continuing...");
      recheck();
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
