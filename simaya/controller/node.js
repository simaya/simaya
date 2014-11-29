module.exports = function(app) {
  var gearmanode = require("gearmanode");
  var model = require("../models/node.js")(app);

  var requestSync = function(req, res) {
    var options = {
      installationId: req.params.id
    };

    model.requestSync(options, function(err, result) {
      if (err) {
        return res.send(500, err);
      }
      if (result.stage == "init") {
        console.log("g1");
        var client = gearmanode.client({servers: app.simaya.gearmanServer});
        var options = {
          syncId: result._id
        };
        var job = client.submitJob("prepare", JSON.stringify(options));

        job.on("complete", function() {
          console.log("g2", job.response);
          client.close();
        }); 
      }
      res.send(200, result);
    });
  }

  var startSync = function(req, res) {
    var options = {
      syncId: req.params.id
    };

    if (req.params.id.length != 24) {
      return res.send(404);
    }
    model.checkSync(options, function(err, result) {
      if (result && result.stage == "init") {
        var client = gearmanode.client({servers: app.simaya.gearmanServer});
        var job = client.submitJob("prepare", JSON.stringify(options));

        job.on("complete", function() {
          client.close();
        }); 
      }
      if (err) return res.send(404);
      res.send(result);
    });
  }

  var manifestContent = function(req, res) {
    var syncId = req.params.id;
    var index = req.params.fileId;

    var options = {
      syncId: syncId,
      fileId: index,
      stream: res
    }
    model.manifestContent(options, function(err) {
      if (err) return res.send(500, err.message);
      res.end();
    });
  }

  var manifestReceiveContent = function(req, res) {
    var syncId = req.params.id;
    var index = req.params.fileId;

    var options = {
      syncId: syncId,
      fileId: index,
      file: req.files.content
    }
    model.manifestReceiveContent(options, function(err) {
      if (err) return res.send(500, err.message);
      res.end();
    });
  }

  var checkNode = function(req, res) {
    var installationId = req.params.id;

    var options = {
      installationId: installationId,
    }

    model.checkNode(options, function(err, result) {
      if (err) {
        console.log(err);
        return res.send(500, err.message);
      }
      res.send(result);
    });
  }

  var checkSync = function(req, res) {
    var options = {
      installationId: req.params.id,
    };

    model.checkSync(options, function(err, result) {
      if (err) return res.send(404);
      res.send(result);
    });
  }

  var updateStage = function(req, res) {
    var syncId = req.params.id;
    var stage = req.body.stage;

    var options = {
      syncId: syncId,
      isMaster: true 
    }
    model.updateStage(options, stage, function(err) {
      if (err) return res.send(500, err.message);
      res.send(200);
    });
  }

  var manifestReceiveIndex = function(req, res) {
    var syncId = req.params.id;
    var manifest = req.body.manifest;

    var options = {
      syncId: syncId,
      manifest: JSON.parse(manifest),
      isMaster: false
    }
    model.manifestUpdate(options, function(err) {
      if (err) return res.send(500, err.message);
      res.send(200);
    });
  }

  var finalizeSync = function(req, res) {
    var syncId = req.params.id;

    var client = gearmanode.client({servers: app.simaya.gearmanServer});
    var options = {
      syncId: syncId 
    };
    var job = client.submitJob("finalize", JSON.stringify(options));

    job.on("complete", function() {
      console.log("g2", job.response);
      client.close();
    }); 

    res.send(200);
  }

  var checkNodeCredentials = function(req, res, next) {
    var installationId = req.headers["x-installation-id"];
    var credentials = req.headers["x-credentials"];
    var credentialsDigest = req.headers["x-credentials-digest"];
    if (!credentials || !credentialsDigest) return res.send(403, "Node is required");
    model.checkNodeCredentials({
      installationId: installationId,
      credentials: credentials,
      digest: credentialsDigest
    }, function(err, success) {
      if (err) console.log(err);
      if (err) return(res.send(403, err.message));
      if (!success) return(res.send(403, "Node is not verified"));
      next();
    });
  }

  return {
    requestSync: requestSync,
    startSync: startSync,
    manifestContent: manifestContent,
    manifestReceiveContent: manifestReceiveContent,
    checkNode: checkNode,
    checkSync: checkSync,
    updateStage: updateStage,
    manifestReceiveIndex: manifestReceiveIndex,
    finalizeSync: finalizeSync,
    checkNodeCredentials: checkNodeCredentials
  }
}
