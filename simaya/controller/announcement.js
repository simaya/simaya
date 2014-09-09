module.exports = function(app) {
  var ObjectID = app.ObjectID
    , announcement = require("../models/announcement.js")(app)
    , user = require("../../sinergis/models/user.js")(app)
    , moment = require("moment")
    , utils = require("../../sinergis/controller/utils.js")(app)

  var show = function(vals, req, res)
  {
    announcement.getCurrent(function(data) {
      vals.data = data;
      if (data) {
        data.date = moment(data.date).format("dddd, DD MMMM YYYY");
        if (data.active) {
          vals.checked = "checked";
        }
      } else {
        vals.data = {
          _id: "000000000000",
        }
      }
      utils.render(req, res, "announcement", vals, "base-admin-authenticated"); 
    });
  }

  var showAndUpdate = function(req, res)
  {
    var vals = {
    };

    if (req.body.message) {
      var me = req.session.currentUser;
      var active = (typeof(req.body.active) !== "undefined");
      var data = {
        username: me,
        date: new Date(),
        active: active,
        message: req.body.message 
      }
      announcement.edit(req.body.id, data, function(v) {
        // console.log(v.hasErrors());
        show(vals, req, res);
      });
    } else {
      show(vals, req, res);
    }
  }

  var getActiveJSON = function(req, res) {
    announcement.getCurrent(function(data) {
      if (data && data.active) {
        res.send({
          message: data.message,
          date: data.updated_at,
        });
      } else {
        res.send(null);
      }
    });
  }

  return {
    showAndUpdate: showAndUpdate, 
    getActiveJSON: getActiveJSON 
  }
};
