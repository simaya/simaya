module.exports = function(app){
  var utils = require("../../../../sinergis/controller/utils.js")(app)
  var user = require("../../../../sinergis/models/user.js")(app)
  var moment = require("moment")
  var ObjectID = app.ObjectID;
  var notification = require('../../../models/notification.js')(app)
  var profileWeb = require('../../profile.js')(app)
      , contacts = require('../../../models/contacts.js')(app)
      , mUtils = require('../../../models/utils.js')(app)
      , db = app.db('user')
      , settings = require("../../../../settings.js");

  /**
   * @api {get} /profile/avatar View avatar of a username
   *
   * @apiVersion 0.1.0
   *
   * @apiName ViewAvatar
   * @apiGroup Profile
   * @apiPermission token
   *
   * @apiParam {String} username Username to view
   * @apiSuccess {Stream} Image stream 
   */
  var getAvatar = function(req, res) {
    profileWeb.getAvatarStream(req, res);
  }

  var getAvatarBase64 = function(req, res) {
    profileWeb.getAvatarBase64Stream(req, res);
  }

  var getFullName = function(req, res) {
    var data = {
      result: 0,
      value: req.session.currentUserProfile.fullName
    }
    res.send(JSON.stringify(data));
  }

  var getLoginName = function(req, res) {
    var data = {
      result: 0,
      value: req.session.currentUser
    }
    res.send(JSON.stringify(data));
  }

  /**
   * @api {get} /profile/view View profile of a username
   *
   * @apiVersion 0.1.0
   *
   * @apiName ViewProfile
   * @apiGroup Profile
   * @apiPermission token
   *
   * @apiParam {String} username Username to view
   * @apiSuccess {Object} data Profile data
   * @apiSuccess {Object} data.profile Full listing of profile information
   * @apiSuccess {String} data.username Username
   * @apiSuccess {String} data.notes Personal notes about this user
   */
  var view = function(req, res) {
    if (req.query.username) {
      user.list({ search: {username: req.query.username}}, function(r) {
        if (r && r.length == 1) {
          delete(r[0].password);
          delete(r[0].roleList);
          delete(r[0]._id);
          delete(r[0].active);
          delete(r[0].updated_at);
          delete(r[0].lastLogin);
          r[0].profile.class = mUtils.convertClass(r[0].profile.class);
          if (r[0].profile.dates) {
            if (r[0].profile.dates.birthday) {
              r[0].dateBirthday = moment(r[0].profile.dates.birthday).format("DD MMMM YYYY");
            }
            if (r[0].profile.dates.special) {
              r[0].dateSpecial = moment(r[0].profile.dates.special).format("DD MMMM YYYY");
            }
          }
          var me = req.session.currentUser;
          contacts.getNotes(me, req.body.username, function(notes) {  
            r[0].notes = notes;

            res.send({
              meta: {
                code: 200
              },
              data: r[0]
            });
          });
        } else {
          res.send(500, {
            meta: {
              code: 500,
              data: "Server error"
            }
          });
        }
      });
    } else {
      res.send(400, {
        meta: {
          code: 400,
          data: "Invalid parameters"
        }
      });
    }
  }

  /**
   * @api {post} /profile/save Saving profile of a username
   * @apiVersion 0.1.0
   * @apiName SaveProfile
   * @apiGroup Profile
   * @apiPermission token
   *
   *
   * @apiSuccess {Object} data Profile data
   * @apiSuccess {Object} data.profile Full listing of profile information
   * @apiSuccess {String} data.username Username
   * @apiSuccess {String} data.notes Personal notes about this user
   */

  var save = function(req, res) {
    var data = {};
    data.meta = {};
    if (req.user.id) {
      if (req.body) {
        var doc = {};
        doc.profile = req.body.profile;
        doc.emailList = req.body.emailList;
        //console.log("REQBODY = " + JSON.stringify(req.body));
        var collection = settings.db.collection("user");

        collection.findAndModify({username: req.user.id}, {_id:1}, {$set:doc}, {new:true}, function(err,doc) {
          if (err) {
            console.log(err);
            data.meta.code = 500;
            data.error = "Internal Server Error"
            res.send(500, data);
          }
          if (doc) {
            console.log(doc);
            data.meta.code = 200;
            data.error = "OK";
            res.send(200, data);
          }
        });
      }
    }
  }

  return {
    getAvatar: getAvatar
    , getAvatarBase64: getAvatarBase64
    , getFullName: getFullName
    , getLoginName: getLoginName
    , view: view
    , save: save
  }
}
