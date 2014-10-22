var gearmanode = require("gearmanode");

var Node = function(app) {
  this.model = require("../models/node.js")(app);
  this.app = app;
  if (!(this instanceof Node)) return new Node(app);
};

Node.prototype.requestSync = function(req, res) {
  var self = this;

  var options = {
    installationId: req.params.id
  };

  self.model.requestSync(options, function(err, result) {
    console.log(result);
    if (err) {
      return res.send(500, err);
    }
    if (result.stage == "init") {
      console.log("g1");
      var client = gearmanode.client({servers: self.app.simaya.gearmanServer});
      var options = {
        syncId: result._id
      };
      var job = client.submitJob("prepare", JSON.stringify(options));

      job.on("complete", function() {
      console.log("g2");
        client.close();
      }); 
    }
    res.send(200, result);
  });
}

Node.prototype.startSync = function(req, res) {
  var self = this;

  var options = {
    syncId: req.params.id
  };

  if (req.params.id.length != 24) {
    return res.send(404);
  }
  self.model.checkSync(options, function(err, result) {
    if (result && result.stage == "init") {
      var client = gearmanode.client({servers: self.app.simaya.gearmanServer});
      var job = client.submitJob("prepare", JSON.stringify(options));

      job.on("complete", function() {
        client.close();
      }); 
    }
    if (err) return res.send(404);
    res.send(result);
  });
}

Node.prototype.manifestContent = function(req, res) {
  var self = this;

  var syncId = req.params.id;
  var index = req.params.index;

  var options = {
    syncId: syncId,
    index: index,
    stream: res
  }
  self.model.manifestContent(options, function(err) {
    if (err) return res.send(500, err.message);
    res.end();
  });
}

Node.prototype.checkNode = function(req, res) {
  var self = this;

  var installationId = req.params.id;

  var options = {
    installationId: installationId,
  }

  self.model.checkNode(options, function(err, result) {
    if (err) return res.send(500, err.message);
    res.send(result);
  });
}

Node.prototype.checkSync = function(req, res) {
  var self = this;

  var options = {
    installationId: req.params.id,
  };

  self.model.checkSync(options, function(err, result) {
    if (err) return res.send(404);
    res.send(result);
  });
}


module.exports = function(app) {
  return Node(app);
}
