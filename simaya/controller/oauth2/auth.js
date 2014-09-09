module.exports = function(app) {

  /**
   * Module dependencies.
   */
  var passport = require("passport");
  var BasicStrategy = require('passport-http').BasicStrategy;
  var BearerStrategy = require('passport-http-bearer').Strategy;
  var ClientPasswordStrategy = require('passport-oauth2-client-password').Strategy;

  var client = require("../../models/oauth2/client")(app);
  var atok = require("../../models/oauth2/accessToken")(app);

  function getClient(id, secret, done) {
    client.get(id, function(err, c){

      if (err) {
        return done (err);
      }

      if (!c) {
        return done (null, false);
      }
      
      if (secret != c.secret) {
        return done (null, false);
      }

      done(null, c);

    });
  }

  passport.use(new BasicStrategy(getClient));
  passport.use(new ClientPasswordStrategy(getClient));

  /**
   * BearerStrategy
   *
   */
  passport.use(new BearerStrategy(

    function(accessToken, done) {
      atok.get({accessToken : accessToken}, function(err, result){

        console.log(result);
        if (err) {
          return done(err);
        }

        if (!result) {
          return done(null, false);
        }

        // err, user, info
        done(null, { id : result.user }, { accessToken : accessToken, client : result.client });
        
      });
    }
  ));
}
