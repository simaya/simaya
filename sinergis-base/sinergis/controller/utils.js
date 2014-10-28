module.exports = function (app) {

  var qs = require("querystring");


  var recordSession = function(req, res) {
    var data = {
      headers: req.headers,
      remote: req._remoteAddress,
      url: {
        path: req.url,
        method: req.method
      },
      user: req.session.currentUser
    }
    req.session.remoteData = data;
  }

  var render = function(req, res, view, vals, base) {
    vals.search = req.query.search;
    req.app.render(view, vals, function(e, h) {
     var c = function() {
        return function(t) {
          return h;
        }
      }
      
      vals.sys = req.app.get('sinergisVar');
      vals.content = c;
      
      var roles = req.session.currentUserRoles;
      if (roles && roles.length > 0) {
        roles.forEach(function(item) {
          if (item == "localadmin") {
            vals.localAdmin = true;
          } else if (item == "admin") {
            vals.globalAdmin = true;
          }
        });
      }

      if (req.session.currentUserProfile && req.session.authId) {
        vals.fullName = req.session.currentUserProfile.fullName || req.session.currentUserProfile.username;
        vals.username = req.session.currentUserProfile.username;
        vals.organization = req.session.currentUserProfile.organization;
        var sidebar = require('./sidebar.js')(app)
        sidebar.list(req, res, function(r) {
          vals.side_bar = r;
          res.render(base, vals); 
        });
        return;
      }
      
      res.render(base, vals); 
    });
  }

  var requireRoles = function(roleNames, req, res, next) {
    var session = require('../models/session.js')(app)
    var user = require('../models/user.js')(app)

    if (req.session.authId) {
      session.getUser(req.session.authId, function(u) {
        if (u != null) {
          user.roleList(u, function(r) {
            var roleFulfilled = 0;
            if (r == null) {
              r = [];
            }
            req.session.currentUserRoles = r;
            for (var i = 0; i < r.length; i ++) {  
              for (var j = 0; j < roleNames.length; j ++) {
                if (r[i] == roleNames[j]) {
                  roleFulfilled ++;
                }
              }
            }
            if (roleFulfilled == roleNames.length) {
              if (next) {
                next();
              }
            } else {
              res.redirect('/restricted');
            }
          });
        } else {
          delete(req.session.currentUser);
          delete(req.session.currentUserProfile);
          delete(req.session.currentUserRoles);
          delete(req.session.authId);
          res.redirect('/login?reset-session-from-roles');
        }
      }); 
    } else {
      res.redirect('/login');
    }
  }

  var requireAdmin = function(req, res, next) {
    requireRoles(['admin'], req, res, next);
  }

  var requireLogin = function(req, res, next) {
    recordSession(req, res);
    var session = require('../models/session.js')(app)
    var user = require('../models/user.js')(app)
    if (req.session.authId) {
      var position = {
          ip: req.ip,
          lon: req.query.lon || 0,
          lat: req.query.lat || 0
      }
      session.update(req.session.authId, position, function(result) {
        if (result != 0) {
          delete(req.session.currentUser);
          delete(req.session.currentUserProfile);
          delete(req.session.currentUserRoles);
          delete(req.session.authId);
          res.redirect('/login?reset-session='+result);
        } else {
          session.getUser(req.session.authId, function(u) {
            if (u) {
              req.session.currentUser = u;
              user.list({search: { username: u }}, function(r) {         
                if (r && r[0] && r[0].profile) {
                  r[0].profile.username = u;
                  req.session.currentUserProfile = r[0].profile;
                  if (r[0].roleList == null) {
                    r[0].roleList = [];
                  }
                }
                req.session.currentUserRoles = r[0].roleList;
                next(); 
              });
            } else {
              res.redirect('/login?expired-session');
            }
          });
        }
      });
    } else {

      // get the query string from previous request
      var q = "";

      // if we have query string
      if ( Object.keys(req.query).length > 0) {
        q = "?" + qs.stringify(req.query);
      }

      // then, put the redirect url + its query string to the cookie
      res.cookie('redirect', req.path + q);
      res.redirect('/login' + q);
    }
  }

  var requireLoginWithoutUpdate = function(req, res, next) {
    var session = require('../models/session.js')(app)
    if (req.session.authId) {
      var position = {
          ip: req.ip,
          lon: req.query.lon || 0,
          lat: req.query.lat || 0
      }
      session.getUser(req.session.authId, function(u) {
        if (u == null) {
          res.redirect('/login');
        } else {
          req.session.currentUser = u;
          next(); 
        }
      });
    } else {
      res.redirect('/login');
    }
  }


  var restricted = function(req, res, next) {
    vals = {
      title: 'Restricted page'
    }

    render(req, res, 'restricted', vals, 'base-authenticated');
  }

  var hasRoles = function(test, req, res) {
    var roles = req.session.currentUserRoles;
    var d = {};
    for (var i = 0; i < roles.length; i ++) {
      d[roles[i]] = 1;
    }
    var count = 0;
    for (var i = 0; i < test.length; i ++) {
      if (d[test[i]]) count ++;
    }
    return (count == test.length);
  }

  var bytesToSize = function(bytes, precision)
  { 
    var kilobyte = 1024;
    var megabyte = kilobyte * 1024;
    var gigabyte = megabyte * 1024;
    var terabyte = gigabyte * 1024;
    
    if ((bytes >= 0) && (bytes < kilobyte)) {
      return bytes + ' B';

    } else if ((bytes >= kilobyte) && (bytes < megabyte)) {
      return (bytes / kilobyte).toFixed(precision) + ' KB';

    } else if ((bytes >= megabyte) && (bytes < gigabyte)) {
      return (bytes / megabyte).toFixed(precision) + ' MB';

    } else if ((bytes >= gigabyte) && (bytes < terabyte)) {
      return (bytes / gigabyte).toFixed(precision) + ' GB';

    } else if (bytes >= terabyte) {
      return (bytes / terabyte).toFixed(precision) + ' TB';

    } else {
      return bytes + ' B';
    }
  }

  var getDurations = function(t) {
    var cd = 24 * 60 * 60 * 1000,
        ch = 60 * 60 * 1000,
        d = Math.floor(t / cd),
        h = '0' + Math.floor( (t - d * cd) / ch),
        m = '0' + Math.round( (t - d * cd - h * ch) / 60000);
    return [d, h.substr(-2), m.substr(-2)].join(':');
  }

  return {
    render: render,
    requireLogin: requireLogin,
    requireRoles: requireRoles,
    requireLoginWithoutUpdate: requireLoginWithoutUpdate,
    requireAdmin: requireAdmin,
    restricted: restricted,
    currentUserHasRoles: hasRoles,
    bytesToSize: bytesToSize,
    getDurations: getDurations
  }
};
