module.exports = function(app) {
  var notification = require('../../../models/notification.js')(app)
    , notificationWeb = require('../../notification.js')(app)
    , utils = require('../../../../sinergis/controller/utils.js')(app)
    , moment= require('moment')
    
  /**
   * @api {get} /notification Lists notifications
   * @apiName List
   * @apiGroup Notification
   * @apiSuccess {Object[]} result Notification list
   * @apiSuccess {Boolean} result.isRead Whether the notification is explicitly read
   * @apiSuccess {String} result._id Object id of the notification
   * @apiSuccess {String} result.message Notification message
   * @apiSuccess {Date} result.time Notification time
   * @apiSuccess {String} result.url Notification url
   */
  var list = function(req, res) {
    notification.getAll(req.session.currentUser, function(r) {
      for (var i = 0; i < r.length; i ++) {
        r[i].formattedTime = moment(r[i].time).format("dddd, DD MMMM YYYY HH:ss");
      }
      res.send(r);
    });
  }

  /**
   * @api {get} /notification/view Views a notification
   * @apiName View
   * @apiGroup Notification
   * @apiSuccess {Object[]} result Notification information
   * @apiSuccess {Boolean} result.isRead Whether the notification is explicitly read
   * @apiSuccess {String} result._id Object id of the notification
   * @apiSuccess {String} result.message Notification message
   * @apiSuccess {Date} result.time Notification time
   * @apiSuccess {String} result.url Notification url
   */
  var view = function(req, res) {
    notification.view(req.query.id, function(r) {
      res.send({result: "OK"});
    })
  }
   
  return {
    list: list,
    view: view,
  }
};
