module.exports = function(app) {
  var utils = require('./utils.js')(app)
    , session = require('../models/session.js')(app)
    , user = require('../models/user.js')(app)
    , sidebar = require('./sidebar.js')(app)
    , captcha = require('../models/captcha.js')(app)
    , sinergisVar = app.get('sinergisVar');

  var redirect = function(req, res, path) {
    if (req.proto == "https") {
      res.redirect("https://" + req.host + path);
    } else {
      res.redirect(path);
    }
  }

  // Do real login if everything is OK
  var doLogin = function(req, res, vals) {
    var pos = {
        ip: req.ip,
        lon: req.query.lon || 0,
        lat: req.query.lat || 0
      }
      var username = req.body.user.user;
      if (username != "admin" && app.simaya.installationId && username.indexOf("u" + app.simaya.installationId + ":") == -1) {
        username = "u" + app.simaya.installationId + ":" + username;
      }
      session.login(username, pos, function(sessionId, reason) {
        if (sessionId == null) {
          if (reason == session.rejectionReason.Duplicate) {
            vals.user = username;
            vals.duplicate = true;
          } else {
            vals.broken = true;
          }
          renderLogin(req, res, vals);
        } else {
          req.session.authId = sessionId;
          if (req.session.loginRetryNumber) {
            // reset login retry number
            req.session.loginRetryNumber = 0;
          }

          if (req.cookies.redirect) {
            // Go to redirected page if set
            var path = req.cookies.redirect;
            res.cookie('redirect','');
            console.log(path);
            redirect(req, res, path);
          } else {
            // Otherwise go to /
            redirect(req, res, '/');
          }
        }
      });
  }

  // Render login page 
  var renderLogin = function(req, res, vals) {

    vals.dialog = vals.dialog || {};

    if (req.query.dialog_type == "mobile" || vals.dialog["type"] == "mobile") {

      vals.client = vals.client || {
        title : req.query.client_title,
        id : req.query.client_id
      }

      vals.login = true;

      utils.render(req, res, 'oauth2-dialog-grant', vals, "base-empty-body");
    }
    else {
      utils.render(req, res, "login", vals, 'base-not-authenticated');
    }
    
  }

  // Render login page with captcha box
  var doLoginWithCaptcha = function(req, res, vals) {
    captcha.create(function(token, text) {
      vals.captcha = true;
      vals.captchaId = token;
      renderLogin(req, res, vals);
    });
  }

  var login = function(req, res) {
    var vals = {
      title: 'Login',
    }
    if (typeof(req.body.user) !== "undefined") {

      if (req.body.client) {
        vals.client = {
          title : req.body.client["title"],
          id : req.body.client["id"]
        };
      }

      if (req.body.dialog) {
        vals.dialog = {
          type : req.body.dialog["type"]
        };
      }

      var username = req.body.user.user;
      if (username != "admin" && app.simaya.installationId && username.indexOf("u" + app.simaya.installationId + ":") == -1) {
        username = "u" + app.simaya.installationId + ":" + username;
      }
      user.authenticate(username, req.body.user.password, function(r) {
        if (r == true) {
          user.isActive(username, function(isActive) {
            if (isActive == true) {
              if (typeof(req.body.captcha) !== "undefined") {
                captcha.validate(req.body.captcha.id, req.body.captcha.text, function(captchaResult) {
                  if (captchaResult == true) {
                    doLogin(req, res, vals);
                  } else {
                    vals.captchaUnsuccessful = true;
                    doLoginWithCaptcha(req, res, vals);
                  }
                });
              } else {
                doLogin(req, res, vals);
              }
            } else {
              vals.unsuccessful = true;
              vals.inactive = true;
              renderLogin(req, res, vals);
            }
          })
        } else {
          vals.unsuccessful = true;
          if (req.session.loginRetryNumber) {
            doLoginWithCaptcha(req, res, vals);
          } else {
            req.session.loginRetryNumber = 1;
            renderLogin(req, res, vals);
          }
        }
      });
    } else {
      renderLogin(req, res, vals);
    }
  };

  var index = function(req, res) {
    var vals = {
      title: sinergisVar.appName,
    }
 
    utils.render(req, res, 'index', vals, 'base-authenticated');
  }

  var logout = function(req, res) {
    var vals = {
      title: sinergisVar.appName,
    }
 
    delete(req.session.currentUser);
    delete(req.session.currentUserProfile);
    delete(req.session.currentUserRoles);
    session.logout(req.session.authId, function() {
      delete(req.session.authId);
      vals.messages = [{}]
      utils.render(req, res, 'login', vals, 'base-not-authenticated');
    });
  }
  
  // Decides which page to go when requested by the router
  var isAdmin = function(req, res, next) {
    // Proceed to the next action given whether the current
    // user is an admin (isAdmin == true) and/or is a local admin
    // (isLocal == true and isAdmin == true)
    var proceed = function(isAdmin, isLocal) {
      var roles = req.session.currentUserRoles;
      var list = sidebar.list(req, res, function(r) {
        if (r.length == 0) {
          // if the user doesn't have any capabilities
          // other than admin, just go to dashboard
          res.redirect("/" + (isLocal? "local":"") + "admin");
        }

        // Otherwise just get the first sidebar menu
        // when it is applicable
        roles.forEach(function(role) {
          if (r[role]) {
            res.redirect(r[role]);
          }
        });
      });
      // fallback to what routes/index.js says
      next();
    }

    // Workaround of the hasRoles' poor API
    user.hasRoles(req.session.currentUser, ['admin'], function(result) {
      if (result) {
        proceed(result);
      } else {
        user.hasRoles(req.session.currentUser, ['localadmin'], function(result) {
          proceed(result, true);
        });
      }
    });
  }

  return {
    login: login
    , index: index
    , logout: logout
    , isAdmin: isAdmin
  }
};
