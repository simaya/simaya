module.exports = function(app){
  var utils = require("../../../../sinergis/controller/utils.js")(app)
  var calendarWeb = require("../../calendar.js")(app)
  var calendar = require("../../../models/calendar.js")(app)
  var moment = require("moment")
  var ObjectID = app.ObjectID;

  // Wraps letter's res
  var ResWrapper = function(callback) {
    return {
      send: function(data) {
        callback(data)
      }
    }
  };


  /**
   * @api {get} /calendar/list Gets list of calendar events
   * @apiName ListCalendar
   * @apiGroup Calendar
   *
   * @apiParam {Date} date Start date in ISO format
   * @apiParam {Number} num-days Number of days to get
   *
   * @apiSuccess {Object[]} events List of calendar events
   * @apiSuccess {String} events.title Title of event
   * @apiSuccess {String[]} events.recipients Usernames of the recipients of the event (optional)
   * @apiSuccess {String[]} events.recipientsResolved Full names of the event recipients (optional)
   * @apiSuccess {Date} events.start Start time of the event
   * @apiSuccess {Date} events.end End time of the event
   * @apiSuccess {String} events.description Description of the event
   * @apiSuccess {Number} events.status Status of the event
   * @apiSuccess {Number} events.visibility Visibility of the event
   * @apiSuccess {Number} events.reminder The reminder of the event
   * @apiSuccess {Number} events.recurrence The recurrence of the event  
   */
  var list = function(req, res) {
    if (isNaN(new Date(req.query.date).valueOf())) {
      res.send(400, {
        meta: {
          code: 400,
          data: "Invalid request"
        }
      });
      return;
    }
    var r = ResWrapper(function(data) {
      var obj = {
        meta: {
          code: 200,
        },
        data: JSON.parse(data)
      }

      res.send(obj);
    });
    calendarWeb.listDayJSON(req, r);
  }

  return {
    list: list
  }
}
