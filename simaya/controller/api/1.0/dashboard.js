module.exports = function(app) {
  var timelineWeb = require("../../timeline.js")(app)
  var letter = require("../../../models/letter.js")(app)
  var disposition = require("../../../models/disposition.js")(app)
  var async = require("async");
  
  var values = function(req, res) {
    var data = {};
    var user = req.session.currentUser;
    if (user) {
      async.parallel([
        function(callback) {
          letter.numberOfNewLetters(user, function(num) {
            data["letterNew"] = num;
            callback();
          });
        },
        function(callback) {
          disposition.numberOfNewDispositions(user, function(num) {
            data["dispositionNew"] = num;
            callback();
          });
        },
      ],
      function() {
            console.log(data);
        res.send(data);
      });
    } else {
      res.send({});
    }
  };

  return {
    values: values
  }
};
