module.exports = function(app) {
  var notification = require('../../../models/notification.js')(app)
    , notificationWeb = require('../../notification.js')(app)
    , utils = require('../../../../sinergis/controller/utils.js')(app)
    , moment= require('moment')
    
  /**
   * @api {get} /notifications Lists notifications
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
      if (r) {
        for (var i = 0; i < r.length; i ++) {
          r[i].formattedTime = moment(r[i].time).format("dddd, DD MMMM YYYY HH:ss");
        }
        res.send({
          meta: {
            code: 200
          },
          data: r
        });
      } else {
        res.send({
          meta: {
            code: 500,
            data: "Server error"
          }
        });
      }
    });
  }

  /**
   * @api {get} /notifications/view Views a notification, this will clear notification status and sends push notification to all supported platforms
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
    if (req.params.id) {
      notification.view(req.params.id, function(r) {
      console.log(r)
        res.send({
          meta: {
            code: 200,
          },
          data: r
        });
      })
    } else {
      res.send(400, {
        meta: {
          code: 400,
          data: "Invalid request"
        }
      });
    }
  }
   
  return {
    list: list,
    view: view,
  }
};
