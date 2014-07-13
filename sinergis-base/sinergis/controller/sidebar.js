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
            for (var i = 0; i < r.length; i ++) {  
              var e = r[i];
              if (typeof(settings[e]) !== "undefined") {
                for (var j = 0; j < settings[e].length; j ++) {
                  var submenu = settings[e][j].submenu;

                  if (submenu) {
                    for (var k = 0; k < submenu.length; k ++) {
                      var shown = true;
                      // by default it is shown to everybody
                      if (submenu[k].onlyShowInRoles) {
                        var shown = false;
                        // except specified in onlyShowInRoles
                        for (var m = 0; m < submenu[k].onlyShowInRoles.length; m ++) {
                          for (var n = 0; n < r.length; n ++) {
                            if (submenu[k].onlyShowInRoles[m] == r[n]) {
                              shown = true;
                              break;
                            }
                          }
                          if (shown) break;
                        }
                        if (shown == false) {
                          submenu.splice(k, 1);
                        }
                      }
                    }
                  }
                  result[index++] = settings[e][j];
                }
              }
            }
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
