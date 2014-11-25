module.exports = function(app) {
  var model = require("../models/dashboard.js")(app);

  var letterStat = function(req, res) {
    model.letterStat({}, function(err, result) {
      if (err) return res.send(400, err.message);
      res.send(200, result);
    });
  }

  var letterTodayStat = function(req, res) {
    var date = new Date;
    var startDate = new Date(date);
    startDate.setHours(0);
    startDate.setMinutes(0);
    startDate.setSeconds(0);
    var endDate = new Date(date);
    endDate.setHours(23);
    endDate.setMinutes(59);
    endDate.setSeconds(59);

    var query = {
      $or: [
      { modifiedDate: { $gte: startDate, $lt: endDate } },
      { createdDate: { $gte: startDate, $lt: endDate }},
      ]
    }

    model.letterStat({ search: query }, function(err, result) {
      if (err) return res.send(400, err.message);
      res.send(200, result);
    });

  }

  return {
    letterStat: letterStat,
    letterTodayStat: letterTodayStat
  }
}
