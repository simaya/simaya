module.exports = function(app) {

  // dependencies, to the ownbox
  var OwnBox = require("../../ownbox").OwnBox;
  // leave it for testing purpose
  // var OwnBox = require("../../node_modules/ownbox-dev").OwnBox;

  // mongo client is needed to make sure the app uses the save version of mongo driver
  var mongo = require("mongodb");

  // the connected db client, exposed from the app
  var db = app.dbClient;

  // Return a new handle for a box, using current user's session
  var box = function (session) {

    // check if session has currentUser and currentUserProfile
    if (session.currentUser && session.currentUserProfile) {

      // set owner from session
      var owner = {
        user : session.currentUser,
        profile : session.currentUserProfile
      };

      // this is the box!
      return new OwnBox({ owner : owner, db : db, mongo : mongo });

    } else {

      // we have no box, sorry.
      return null;
    }
  }

  return {
    // public API, the box
    box : box
  }
}