var _ = require("lodash");

module.exports = function (app) {
  var utils = require('./utils.js')(app)

  var list = function(req, res, callback) {
    var result = [];
    var index = 0;
    var user = require('../models/user.js')(app)
    , session = require('../models/session.js')(app)
    require('../models/deepCopy.js');
    
    var settings = owl.deepCopy(require(app.sidebarSettings))

    session.getUser(req.session.authId, function(u) {
      if (u != null) {
        user.roleList(u, function(r) {
          if (r != null) {
            var roleMap = {};
            _.each(r, function(item) {
              roleMap[item] = 1;
            });

            _.each(r, function(item) {
              if (settings[item]) {
                _.each(settings[item], function(entry) {
                  if (entry.submenu) {
                    var submenu = [];
                    _.each(entry.submenu, function(menu) {
                      var shown;
                      if (menu) {
                        if (menu.onlyShowInRoles) {
                          shown = false;
                          _.each(menu.onlyShowInRoles, function(role) {
                            if (roleMap[role]) shown = true;
                          });
                        } else {
                          shown = true;
                        }
                        if (shown) {
                          submenu.push(menu);
                        }
                      }
                    });
                    entry.submenu = submenu;
                  }

                  result.push(entry);
                });
              }
            });
          }

          callback(result); 
        });
      } else {
        callback([]);
      }
    });
  }


  return {
    list: list
  }
};
