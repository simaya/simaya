module.exports = function(app) {
  var oauth2orize = require('oauth2orize');
  var server = oauth2orize.createServer();
  var utils = require('../../../sinergis/controller/utils')(app);
  var passport = require('passport');
  var url = require("url");

  var client = require("../../models/oauth2/client")(app);
  var authCode = require("../../models/oauth2/authCode")(app);
  var atok = require("../../models/oauth2/accessToken")(app);

  var session = require('../../../sinergis/models/session')(app);

  var user = require('../../../sinergis/models/user')(app);

  var DEFAULT_CALLBACK = "/oauth2/callback"
  var DEFAULT_XCALLBACK = "/xauth/callback"
  var MONTH = 30;

  function getUser(id, fn) {
    user.list({ search : { username : id }}, function(users){
      if (users && users.length > 0) {
        fn(null, users[0]);
      } else {
        fn(new Error("User not found"));
      }
    });
  }

  // random uid
  function uid(len) {
    var buf = []
      , chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
      , charlen = chars.length;

    for (var i = 0; i < len; ++i) {
      buf.push(chars[getRandomInt(0, charlen - 1)]);
    }

    return buf.join('');
  };

  // random int
  function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  server.serializeClient(function(client, done) {
    return done(null, client.id);
  });

  server.deserializeClient(function(id, done) {
    return client.get(id, done);
  });

  // handlers
  server.grant(oauth2orize.grant.code(function(client, redirectUri, user, ares, done) {
    
    // generate authorization code
    var authorizationCode = uid(16);

    delete client.secret;

    var data = {
      code : authorizationCode,
      client : client,
      redirectUri : redirectUri,
      user : user,
      scope : ares.scope
    };

    authCode.set(data, function(err, result){
      if (err) {
        return done(new Error("Authorization cannot be saved"));
      }
      done(null, authorizationCode);
    });

  }));

  server.exchange(oauth2orize.exchange.code(function(client, code, redirectUri, done) {

    authCode.get({ code : code }, function(err, theCode) {

      if (err) {
        return done(new Error ("Authorization code invalid"));
      }

      if (!theCode) {
        return done(null, false);
      }

      if(theCode.client.id != client.id) {
        return done(null, false);
      }

      atok.get({"client.id" : client.id, user : theCode.user}, function(err, token){

        if (err) {
          return done(null, false);
        }

        if (!token) {
          var accessToken = uid(128);

          atok.set(

          {
            code : code,
            client : client,
            user : theCode.user,
            accessToken : accessToken
          }, 

          function(err, result){
            var date = new Date();
            date.setDate(date.getDate() + MONTH);
            date = result.date || date;
            done(err, accessToken, null, { 'expired_at': date });
          });


        } else {
          done(null, token.accessToken, null, { 'expired_at': token.expire_at });
        }

      });
    });

  }));

  server.exchange(oauth2orize.exchange.refreshToken(function(client, refreshToken, scope, done) {

    // todo: refresh token

  }));

  var webUsersCheck = function(req, res, next) {
    if (req.session && req.session.authId) {
      var position = {
          ip: req.ip,
          lon: req.query.lon || 0,
          lat: req.query.lat || 0
      }
      session.update(req.session.authId, position, function(result) {
        var last = req.route.callbacks[req.route.callbacks.length - 1];
        return last(req, res);
      });
    } else next();
  }

  var protectedResource = [
    // Let the web users pass
    webUsersCheck,
    // authenticate using bearer strategy: query string, body or header
    passport.authenticate('bearer', { session: false }),
    filter,
    function (req, res, next) {

      user.list({ search: { username: req.user.id } }, function(r) {

        if (!r || r.length == 0) {
          return res.send(403, { error_type : "access_denied", error_message : "Access denied" }); // user invalid
        }

        req.session.currentUser = req.user.id;
        req.session.currentUserProfile = r[0].profile;
        req.session.currentUserProfile.id = r[0]._id;
        req.session.currentUserProfile.username = req.session.currentUser;

        if (r[0].roleList == null) {
          r[0].roleList = [];
        }

        req.session.currentUserRoles = r[0].roleList;

        // TODO: do something interesting here, e.g. check scope based on user's roles

        next();
      })

    } 

  ];

  // mobile and desktop callback, trusted
  function defaultCallback(req, res, next) {
    
    if (req.params && req.params.clientId) {
      req.user = req.params.clientId;  
    }

    req.body = { 
      grant_type : "authorization_code",
      code : req.query.code
    };

    next();
  }

  function serverAuthorization (clientId, redirectUri, scope, state, done) {

    client.get(clientId, function(err, clientApp) {

      if (err) { 
        return done(new Error("Client not found")); 
      }

      if (!clientApp) {
        return done(null, false);
      }

      var redirectUriPath = url.parse(redirectUri).path;
      var isDefaultCallback = redirectUriPath == DEFAULT_CALLBACK || redirectUriPath == DEFAULT_XCALLBACK ;

      if (!isDefaultCallback && clientApp.redirectUri != redirectUri) {
        return done(null, false);
      }

      redirectUri =  redirectUri + (isDefaultCallback ? ("/" + clientApp.id ) : "");
      return done(null, clientApp, redirectUri);  

    });
  }

  function pre (req, res, next) {

    client.get(req.query.client_id, function(err, clientApp) {

      req.query.client_title = clientApp.title;

      if (err) { 
        return next(new Error("Client not found")); 
      }

      if (!clientApp) {
        return next(false);
      }

      next();
    });
  }

  function renderDecision (req, res, next) {

    // get the client
    var client = req.oauth2.client;

    // if trusted
    if (client.trusted) {

      // do following procedures

      // hack
      req.user = req.user || req.session.currentUser || req.oauth2.req.state;

      req.body = {
        transaction_id : req.oauth2.transactionID,
        scope : req.query['scope'],
        user : req.user
      }

      next();

    }
    else {

      var obj = { 
        transactionId : req.oauth2.transactionID, 
        user : {
          id : req.session.currentUser, 
          profile : req.session.currentUserProfile
        },
        client : client, 
        scope : req.query['scope'] 
      };

      req.user = req.session.currentUser;
      req.scope = req.query['scope'];

      utils.render(req, res, 'oauth2-dialog-grant', obj, "base-empty-body");
    }
  }

  function userAuth (req, res, next) {

    var username = req.body.username;
    var password = req.body.password;
    var position = req.body.position || {}; // for testing purpose

    if ( !username 
      || !password 
      || !position ) 
    {
      return res.send(401, {"error":"unauthorized","error_description":"not authorized"});
    }

    req.query.state = username;

    // simulate mobile
    position.ip = position.ip || "0.0.0.0";
    position.lon = position.lon || -1;
    position.lat = position.lat || -1;
    position.device = position.device || { access : "mobile" };

    // authenticate user
    user.authenticate (username, password, function (authenticated) {
      if (authenticated) {
        
        // get sessionId for retrieving token
        session.login( username, position, function(sessionId, reason) {
          
          if (reason > 0) {
            return res.send(401, {"error":"unauthorized","error_description":"not authorized"});
          }

          next();
          
        });

        // TODO: check clientId and clientSecret
      }
      else {
        return res.send(401, {"error":"unauthorized","error_description":"not authorized"});
      }

    });
  }

  function defaultXtoken(req, res) {
    // delete session
    session.logout(req.session.authId, function(err){
      if (err) {
        return res.send(500, err);
      }
      res.send(JSON.parse(req.session.body));  
    })
  }

  function filter (req, res, next) {
    res.header("X-powered-by", "siMAYA");
    next();
  };

  // 1.
  var authorization = [
    filter,
    pre,
    utils.requireLogin,
    server.authorization(serverAuthorization),
    renderDecision,
    server.decision(),
    server.errorHandler()
  ];

  // 2.
  var decision = [
    filter,
    utils.requireLogin,
    function (req, res, next) {
      req.user = req.session.currentUser;
      next();
    },
    server.decision(),
    server.errorHandler()
  ];

  // 3. 
  var token = [
    // todo: basic auth
    filter,
    passport.authenticate(["basic", "oauth2-client-password"], { session: false }),
    server.token(),
    server.errorHandler()
  ];

  // 4. 
  var callback = [
    filter,
    utils.requireLogin,
    defaultCallback,
    passport.authenticate(["basic", "oauth2-client-password"], { session: false }),

    function(req, res, next){

      // this is a hack to use default callback
      var code = req.body.code; 

      if (req.query.error) {
        return res.send(403, { error_type : "access_denied", error_message : "Access denied" });
      }

      if (req.body.grant_type == "authorization_code") {

        authCode.get({ code : code }, function(err, theCode){
          if (err) {
            return next(err);
          }

          var client = theCode.client;

          atok.get({"client.id" : client.id, user : theCode.user}, function(err, token){

            if (err) {
              return next(err)
            }

            if (!token) {
              var accessToken = uid(128);

              atok.set(

              {
                code : code,
                client : client,
                user : theCode.user,
                accessToken : accessToken
              }, 

              function(err, result){

                if (err) {
                  return next(err);
                }

                var date = new Date();
                date.setDate(date.getDate() + MONTH);

                date = result.date || date;

                req.session.body = JSON.stringify({
                  access_token : accessToken,
                  expired_at : date,
                  token_type : "bearer"
                });

                res.redirect("/xauth/token#access_token=" + accessToken + "&type=bearer&expired_at=" + date.toISOString());
              
              });


            } else {

              req.session.body = JSON.stringify({
                access_token : token.accessToken,
                expired_at : token.expire_at,
                token_type : "bearer"
              });

              res.redirect("/xauth/token#access_token=" + token.accessToken + "&type=bearer&expired_at=" + token.expire_at.toISOString());
            }

          });
          
        });  
      }

    },
    server.errorHandler()
  ]

  // xauth
  var xauthorization = [
    filter,
    userAuth,
    server.authorization(serverAuthorization),
    renderDecision,
    server.decision(decision),
    server.errorHandler()
  ];

  var xcallback = [
    filter,
    defaultCallback,
    passport.authenticate(["basic", "oauth2-client-password"], { session: false }),
    server.token(),
    server.errorHandler()
  ]

  var xtoken = [
    filter,
    utils.requireLogin,
    defaultXtoken,
    server.errorHandler()
  ]

  return {

    // Public APIs
    authorization : authorization,
    xauthorization : xauthorization,
    decision : decision,
    token : token,
    protectedResource : protectedResource,
    callback : callback,
    xcallback : xcallback,
    xtoken : xtoken
  };
}


