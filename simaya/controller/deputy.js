module.exports = function(app) {
  var ObjectID = app.ObjectID
    , deputy = require("../models/deputy.js")(app)
    , user = require("../../sinergis/models/user.js")(app)
    , moment = require("moment")
    , utils = require("../../sinergis/controller/utils.js")(app)
    , cUtils = require("../../simaya/controller/utils.js")(app)


  var showList = function(callback, vals, req, res) {
    deputy.list({search: { organization: req.session.currentUserProfile.organization } }, function(result) {
      vals.deputyList = result;
      for (var i = 0; i < result.length; i ++) {
        result[i].start = moment(result[i].dateFrom).format("dddd, DD MMMM YYYY");
        result[i].end = moment(result[i].dateUntil).format("dddd, DD MMMM YYYY");
      }
      callback(vals);
    });
  }

  var showAndUpdate = function(req, res)
  {
    var myOrganization = req.session.currentUserProfile.organization;
    var myEchelon = parseInt(req.session.currentUserProfile.echelon);
    var vals = {
    };

    var breadcrumb = [
      {text: 'Pelaksana Harian', isActive: true}
    ];
    vals.breadcrumb = breadcrumb;

    var search = {
      "profile.organization": { $regex: "^" + myOrganization },
      "profile.echelon": { $regex: "^" + (myEchelon + 1)},
    }
    vals.deputies = [];
    user.list({search: search}, function(r) {
      for (var i = 0; i < r.length; i ++) {
        vals.deputies.push({ username: r[i].username, name: r[i].profile.fullName });
      }
      deputy.getCurrent(myOrganization, function(current) {
        if (typeof(req.body.assignee) !== "undefined") {
          vals.dateFromDijit = req.body.dateFrom;
          vals.dateUntilDijit = req.body.dateUntil;
          for (var i = 0; i < vals.deputies.length; i ++) {
            if (req.body.assignee == vals.deputies[i].username) {
              vals.deputies[i].selected = "selected";
            }
          }
          if (req.body.active == "yes") {
            vals.isActive = "checked";
          }
          if (req.body.active == "no") {
            vals.isNotActive = "checked";
          }

          var data = {
            assignee: req.body.assignee,
            assignor:  req.session.currentUser,
            dateFrom: new Date(req.body.dateFrom),
            dateUntil: new Date(req.body.dateUntil),
            organization: myOrganization,
            active: (req.body.active == "yes")
          }
          if (req.body.remove == "true") {
            vals.removed = true;
            vals.successful = true;
            vals.unsuccessful = false;
            deputy.removeAssignment(req.body.id, function() {
              showList(function(vals) {
                utils.render(req, res, "deputy", vals, "base-authenticated"); 
              }, vals, req, res);
            })
          } else if (req.body.assignee == "") {
            vals.removed = true;
            vals.successful = true;
            vals.unsuccessful = false;
            deputy.remove(myOrganization, function() {
              showList(function(vals) {
                utils.render(req, res, "deputy", vals, "base-authenticated"); 
              }, vals, req, res);
            })
          } else {
            if (current == null) {
              var fakeVals = {}
              cUtils.populateSenderSelection(req.session.currentUserProfile.organization, "", fakeVals, req, res, function(fakeVals) {
                data.title = fakeVals.senderSelection[0].profile.title;
                deputy.assign(data, function(v) {
                  if (v.hasErrors()) {
                    vals.errorData = {} 
                    for (var i = 0; i < v.errors.Data.length; i ++) {
                      var k = v.errors.Data[i].replace(/ /g, "_");
                      console.log(k);
                      vals.errorData[k] = true;
                    };
                    vals.successful = false;
                    vals.unsuccessful = true;
                  } else {
                    vals.successful = true;
                    vals.unsuccessful = false;
                  }
                  showList(function(vals) {
                    utils.render(req, res, "deputy", vals, "base-authenticated"); 
                  }, vals, req, res);
                })
              })
            } else {
              deputy.edit(current._id, data, function(v) {
                showList(function(vals) {
                  utils.render(req, res, "deputy", vals, "base-authenticated"); 
                }, vals, req, res);
              })
            }
          }
        } else {
          if (current == null) {
            vals.isNotActive = "checked";
            vals.dateUntilDijit = moment(new Date()).format("YYYY-MM-DD");
            vals.dateFromDijit = moment(new Date()).format("YYYY-MM-DD");
          } else {
            if (current.active) {
              vals.isActive = "checked";
              vals.isNotActive = "";
            } else {
              vals.isActive = "";
              vals.isNotActive = "checked";
            }
            vals.dateUntilDijit = moment(current.dateUntil).format("YYYY-MM-DD");
            vals.dateFromDijit = moment(current.dateFrom).format("YYYY-MM-DD");
            for (var i = 0; i < vals.deputies.length; i ++) {
              if (current.assignee == vals.deputies[i].username) {
                vals.deputies[i].selected = "selected";
              }
            }
          }
          showList(function(vals) {
            utils.render(req, res, "deputy", vals, "base-authenticated"); 
          }, vals, req, res);
        }
      });
    });
  }

  return {
    showAndUpdate: showAndUpdate 
  }
};
