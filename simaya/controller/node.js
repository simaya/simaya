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


module.exports = function(app) {
  return Node(app);
}
