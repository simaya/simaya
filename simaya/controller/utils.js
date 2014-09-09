module.exports = function(app) {
  var sinergisUtils = require('../../sinergis/controller/utils.js')(app)
    , modelUtils = require('../models/utils.js')(app)
    , user = require('../../sinergis/models/user.js')(app)
    , deputy = require('../models/deputy.js')(app)
    , notification = require('../models/notification.js')(app)
    , azuresettings = require("../../azure-settings.js");

  var requireLocalAdmin = function(req, res, next) {
    sinergisUtils.requireRoles(['localadmin'], req, res, next); 
  }

  // Copy array but exclude specified items 
  var stripCopy = function(source, items) {
    var copy = [];
    if (items) {
      var exists = [];
      if (typeof(items) === "object") {
        for (var j = 0; j < items.length; j ++) {
          exists[items[j]] = 1;
        }
      } else {
        exists[items] = 1;
      }

      for (var i = 0; i < source.length; i ++) {
        if (exists[source[i].username] != 1) {
          var d = {
            username: source[i].username,
            fullName: source[i].profile.fullName,
            title: source[i].profile.title,
            echelon: source[i].profile.echelon,
            organization: source[i].profile.organization,
          }
          copy.push(d);
        }
      }
    } else {
      for (var i = 0; i < source.length; i ++) {
        var d = {
          username: source[i].username,
          fullName: source[i].profile.fullName,
          title: source[i].profile.title,
          echelon: source[i].profile.echelon,
          organization: source[i].profile.organization,
        }
        copy.push(d);
      }
    }
    return copy;
  }

  var getNames = function(req, res) {
    var id;
    if (req.params && req.params.id) {
      id = req.params.id; 
    } else if (req.query && req.query.id) {
      id = req.query.id; 
    }
    if (id) {
      var values = id.split(",");
      var retval = [];
      modelUtils.resolveUsers(values, function(r) {
        if (r != null) {
          res.send(JSON.stringify(r));
        } else {
          res.send('[]');
        }
      });
    } else {
      res.send('[]');
    }
  }

  var populateSenderSelection = function(org, sender, vals, req, res, callback) {
    if (org == "") {
      callback(vals);
    }
    var myOrganization = req.session.currentUserProfile.organization; 
    var deputyActive = false;
    deputy.getCurrent(myOrganization, function(info) {
      var search = {
        search: {
          'profile.organization': org, 
          $or: [
            { 'profile.echelon': {$lte: '2z'}}, 
            {
              roleList: { $in: [ "sender" ]}
            }
          ]
        },
        fields: {
          _id:1,
          username:1,
          profile:1
        }
      }; 
      if (!vals.skipDeputy) {
        if (info != null && info.active == true) {
          deputyActive = true;
          search.search = { username: info.assignee }
        }
      }

      user.list(search, function(r) {
        if (r != null && r.length > 0) {
          for (var i = 0; i < r.length; i ++) {
            if (sender == r[i].username) {
              r[i].selected = 'selected';
            }
            if (deputyActive) {
              r[i].deputyActive = true;
              r[i].title = info.title;
            }
          }
          if (vals.skipDeputy) {
            vals.autoCc = r;
          } else {
            vals.senderSelection = r;
          }
          if (deputyActive) { 
            // call again to populate the autoCc
            vals.skipDeputy = true;
            populateSenderSelection(org, sender, vals, req, res, callback);
          } else {
            callback(vals);
          }
        } else {
          var i = org.lastIndexOf(';'); 
          if (i >= 0) {
            org = org.substr(0, i); 
          } else {
            org = "";
          }
          populateSenderSelection(org, sender, vals, req, res, callback);
        }
      });
    });
  }

  // Send message to all sending administrators, fire and forget
  var notifyAdministrationOffice = function(data, req, res) {
    var search = {
      'profile.organization': req.session.currentUserProfile.organization, 
      roleList: { $in: [app.simaya.administrationRole] }
    }
    
    user.list({search: search}, function(r) {
      for (var i = 0; i < r.length; i ++) {
        azuresettings.makeNotification('Ada surat baru perlu dikirim', req.session.currentUserProfile.id);
        notification.set(req.session.currentUser, r[i].username, 'Ada surat baru perlu dikirim', '/letter/read/' + data._id);
      }
    });
  }

  var help = function(req, res) {
    var vals = {}
    var roles = req.session.currentUserRoles;
    var template = "help";
    for (var i = 0; i < roles.length; i ++) {
      if (roles[i] == "admin") {
        template = "help-admin";
        break;
      }
      else if (roles[i] == "localadmin") {
        template = "help-localadmin";
        break;
      }
      else if (roles[i] == "tatausaha") {
        template = "help-tu";
        break;
      }
      else if (roles[i] == "sender") {
        template = "help-sender";
        break;
      }
    }

    var echelon = parseInt(req.session.currentUserProfile.echelon);
    if (echelon <= 2) {
      template = "help-sender";
    }

    sinergisUtils.render(req, res, template, vals, "base-authenticated");
  }

  //
  // 1 [2] 3 4 5 > Next
  // Prev << 6 7 [8] 9 10 >> Next
  var getPages = function(page, limit, numResults) {
    if (page <= 0) {
      page = 1;
    }

    if (limit < 0) {
      limit = 10;
    }

    var pages = {};
    var pageLimit = 5;

    if (numResults <= 0) {
      return pages;
    }

    var start = Math.floor(page/pageLimit) * pageLimit + 1; 
    if (page % pageLimit == 0) {
      start = page - pageLimit + 1;
    }
    var numPages = Math.ceil(numResults/limit);
    var numbers = [];
    for (var i = 0; i < pageLimit; i ++) {
      if (start + i > numPages) {
        break;
      }
      var e = {
        page: i + start,
        active: ((i + start) == page)
      }
      numbers.push(e);
    }

    if (numbers.length > 0) {
      pages["numbers"] = numbers;
    }

    if (start != 1) {
      pages["prev"] = {
        active: true,
        page: start - 1
      }
    }

    if (start + pageLimit < numPages) {
      pages["next"] = {
        active: true,
        page: (start + pageLimit)
      }
    }
    return pages;
  }

  return {
    requireLocalAdmin: requireLocalAdmin
    , stripCopy: stripCopy
    , getNames: getNames
    , populateSenderSelection: populateSenderSelection
    , notifyAdministrationOffice: notifyAdministrationOffice
    , help: help 
    , getPages: getPages
  }
};
