module.exports = function(app){
  var utils = require("../../../../sinergis/controller/utils.js")(app)
  var user = require("../../../../sinergis/models/user.js")(app)
  var moment = require("moment")
  var ObjectID = app.ObjectID;
  var notification = require('../../../models/notification.js')(app)
  var profileWeb = require('../../profile.js')(app)
      , contacts = require('../../../models/contacts.js')(app)
      , mUtils = require('../../../models/utils.js')(app)

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

  var view = function(req, res) {
    if (req.query.username) {
      user.list({ search: {username: req.query.username}}, function(r) {
        delete(r[0].password);
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
          res.send(r);
        });
      });
    } else {
      res.send(JSON.stringify({result: "ERROR"}));
    }
  }

  return {
    getAvatar: getAvatar
    , getAvatarBase64: getAvatarBase64
    , getFullName: getFullName
    , getLoginName: getLoginName
    , view: view
  }
}
