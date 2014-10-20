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
    if (err) {
      return res.send(500, err);
    }
    res.send(200, result);
  });
}

Node.prototype.startSync = function(req, res) {
  var self = this;

  var options = {
    syncId: req.params.id
  };

  var client = gearmanode.client({servers: self.app.simaya.gearmanServer});
  var job = client.submitJob("prepare", JSON.stringify(options));

  job.on("complete", function() {
    res.send(job.response);
    client.close();
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

module.exports = function(app) {
  return Node(app);
}
