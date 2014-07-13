module.exports = function(app) {
  // Private 
  var db = app.db('forgotPassword')
    , crypto = require('crypto')

  // Validation function
  db.validate = function(document, update, callback) {
    var validator = app.validator(document, update);

    // FILL: checks whether user/email exists 

    // FILL: Default path
    callback(null, validator);
  }

  // Public API
  return {
    // Creates a forgot password session 
    // Returns a callback
    //    token: the inserted token
    //    verificationCode: the verification Code
    //    validator: The validator
    create: function (user, email, callback) {
      db.getCollection(function (error, collection) {
        var expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 1);
        var data = {
          username: user,
          email: email,
          token: crypto.randomBytes(8).toString("hex"),
          verificationCode: crypto.randomBytes(8).toString("hex"),
          expireAt: expiryDate 
        };
        data._id = collection.pkFactory.createPk();

        db.validateAndInsert(data, function (error, validator) {
          callback(data.token, data.verificationCode, validator);
        }); 
      });
    },

    // Cleans expired sessions.
    // Returns a callback
    clean: function(callback) {
      db.remove({expireAt: { $lt: new Date() } }, function(e) {
        callback();
      });
    },

    // Activates a session when user clicks a link with a token and verificationCode.
    // The session is deleted afterwards, user has a single shot to activate this.
    // In the view, when this function returns true, a change password view is presented.
    // Returns a callback:
    //    result: true if session is activated
    activate: function(token, verificationCode, callback) {
      var result = {
        result: false
      };
      db.findOne({
        token: token, 
        verificationCode: verificationCode
      }, function(e, item) {
        if (e == null && item != null) {
          result.result = true;
          result.username = item.username;
          db.remove({_id: item._id});
        }
        callback(result);
      });
    },
  }
}
