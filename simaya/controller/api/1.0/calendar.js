module.exports = function(app){
  var utils = require("../../../../sinergis/controller/utils.js")(app)
  var calendarWeb = require("../../calendar.js")(app)
  var calendar = require("../../../models/calendar.js")(app)
  var moment = require("moment")
  var ObjectID = app.ObjectID;

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
    calendarWeb.listDayJSON(req, res);
  }

  return {
    list: list
  }
}
