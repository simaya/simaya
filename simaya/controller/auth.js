module.exports = function(app) {
  var ObjectID = app.ObjectID
    , OAuth2Provider = require("./oauth/lib/oauth2-provider/index.js").OAuth2Provider;
  var keys = ["blankon", "simaya"];
  var provider = new OAuth2Provider({crypt_key: keys[0], sign_key: keys[1]})
  var Serializer = require('serializer');
  var serializer = Serializer.createSecureSerializer(keys[0], keys[1]);

  var prefix  = "../../sinergis";
  var utils   = require(prefix + "/controller/utils")(app);
  var user    = require(prefix + "/models/user")(app);
  var session = require(prefix + "/models/session")(app);

  var error = function(res, status, message) {
    res.send(status, message);
  }

  var updateExpressSession = function(req, data, callback) {
    req.session.authId = data.sessionId;
    req.session.data = data.extra;
    req.session.currentUser = data.username;
    user.list({search: { username: data.username }}, function(r) {         
      r[0].profile.username = data.username;
      req.session.currentUserProfile = r[0].profile;

      if (r[0].roleList == null) {
        r[0].roleList = [];
      }

      req.session.currentUserRoles = r[0].roleList;
      callback();
    })

  }

  // TODO: Unify with the oauth version
  function enter(req, res){
    var position = { 
      ip: "", 
      lon: 0, 
      lat: 0,  
      device: {
        access: req.body.access,
        uuid: req.body.device, 
        platform: req.body.platform,
        version: req.body.version,
        clientVersion: req.body["client-version"],
        clientId: req.body["client-id"],
      },
      next: Serializer.randomString(128)
    }

    var tryLogin = function(sessionId, reason) {
      if (sessionId == null) {
        error(res, 404, {
          message: "session-not-found"
        });
      }else{
        session.getUser(sessionId, function(u) {
          if (!u) {
            return error(res, 404, {
              message: "user-not-found"
            });
          }

          var data = [sessionId, req.body.clientId, +new Date, "blankon"];
          var token = serializer.stringify(data);

          var sessionData = {
            sessionId: sessionId,
            username: u,
            extra: data[3]
          }
          updateExpressSession(req, sessionData, function() {
            res.header("X-token-next", position.next);
            res.send(200, { result: token});
          });
        })
      }
    } 

    req.session.tokenNext = position.next;
    session.login(req.body.username, position, tryLogin);
  }

  var updateSession = function(token, req, res, next) {
    try {
      data = serializer.parse(token);
      authId = data[0];
      clientId = data[1];
      grantDate = new Date(data[2]);
      extraData = data[3];
    } catch(e) {
      console.log(e);
      return error(res, 400, {
        message: "invalid-token",
        result: e.message
      })
    }

    var position = { 
      ip: '', 
      lon: 0, 
      lat: 0, 
      key: req.get("X-token-key"),
      next: req.session.tokenNext 
    };

    session.update(authId, position, function(result) {
      if (result != 0) {
        error(res, 500, {
          message: "invalid-session",
          code: result
        });
      } else {
        session.getUser(authId, function(u) {
          if (!u) {
            return error(res, 404, {
              message: "user-not-found"
            });
          }

          var sessionData = {
            sessionId: authId,
            username: u,
            extra: extraData
          }

          res.header("X-token-next", position.next);
          updateExpressSession(req, sessionData, function() {
            next();
          });
        });
      }
    });
  }

  var authCheck = function() {
    return function(req, res, next) {
    var data, token, username, clientId, grantDate, extraData;

    if (req.query && req.query.token) {
      token = req.query.token;
    } else if (req.body && req.body.token) {
      token = req.body.token;
    } else {
      return next();
    }

    updateSession(token, req, res, next);
  };
};

  var getToken = function(req, res) {
    if (req.body && 
        req.body.username && 
        req.body.password && 
        req.body.access &&
        req.body.device &&
        req.body.platform &&
        req.body.version &&
        req.body["client-version"] &&
        req.body["client-id"]) {
      var username = req.body.username;

      user.authenticate(username, req.body.password, function(r) {
        if (r) {
          return enter(req, res);
        } else {
          error(res, 401, {message: "auth-invalid"});
        }
      });
    } else {
      error(res, 400, {message: "bad-request"});
    }
  }

  return {
    getToken: getToken,
    authCheck: authCheck 
  }
};
