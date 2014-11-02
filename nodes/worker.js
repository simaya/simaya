var utils = require("./utils");
var org = require("../simaya/models/organization")(utils.app);
var worker = require("gearmanode").worker({servers: utils.app.gearmanServer});

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
      org.move(payload.source, payload.destination, function(err, result) {
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


connect(connected);
