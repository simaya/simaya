module.exports = function(app) {
  // Private 
  var db = app.db('session');
  var user = app.db('user');
  var crypto = require('crypto');

  var DUPLICATE_MESSAGE = 'There is already a user with this name';
  var INVALID_USER_MESSAGE = 'Invalid username';
  var INACTIVE_USER_MESSAGE = 'Inactive user';
  var EXPIRE_TIME = 1000 * 30 * 60; // 30 minutes
  var IDLE_TIME = 1000 * 10 * 60;

  var rejectionReason = {
    NoError: 0,
    Duplicate: 1,
    InvalidUserName: 2,
    InactiveUser: 3,
    MismatchKey: 4,
  }
  
  var loginState = {
    Offline: 0,
    Idle: 1,
    Online: 2
  }

  // Validation function
  db.validate = function(document, update, callback) {
    var validator = app.validator(document, update);

    if (!validator.isInserting()) {
      // updating?
      return callback(null, validator);
    }

    // try to find a user
    user.findOne({username: update.username}, function(error, result) {

      // no user found
      if (error != null || result == null) {

        // put the error message
        validator.addError('username', INVALID_USER_MESSAGE);
      } 

      // we've found a user
      if (result != null) {

        // then check if user is activated
        if (!result.active) {

          // if not, add the error message
          validator.addError('active', INACTIVE_USER_MESSAGE);
        }
      }

      callback(null, validator);

    });
  }

  db.beforeInsert = function (documents, callback) {

    if (documents && documents.length == 1) {
      var update = documents[0];
      var isMobile = false;
      if (update.position && update.position.device && update.position.device.access == "mobile") {
        isMobile = true;
      }

      if (!isMobile) {
        // This is not mobile
        // So let's kick other web logins
        var date = new Date();

        db.remove({
          username: update.username,
          // skip mobile users
          "position.device.access": { $exists: false },
        }, { safe: true}, function(err, result) {
          return callback(null, documents);
        })
      } else {
        callback(null, documents);
      }
    } else {
      callback(null, documents);
    }
  }

  // XXX:
  // Remove these two when the real data is
  // coming from database
  // see the 'update' method
  var lastPosition = '';

  // Public API
  return {
    // Returns a login state of a user
    // States: 
    //  - Online
    //  - Idle
    //  - Offline
    getLoginState: function(username, callback) {
      var time = new Date();
      db.findOne({username: username, "position.access": { $ne: "mobile" }, expireAt: {$gt: time}}, function(error, item){
        if (item != null) {
          if ((item.expireAt - time) < IDLE_TIME) {
            callback(loginState.Idle);
          } else {
            callback(loginState.Online);
          }
        } else {
          callback(loginState.Offline);
        }
      })
    },

    // Log-ins a user. Subsequent login 
    // when the session is active (not logout)
    // will be rejected
    //    user: the username
    //    position: the position object of
    //        ip: the ip address
    //        lon: longitude
    //        lat: latitude
    // Returns a callback
    //    error: database error if any
    //    sessionId: the 32 bytes generated sessionId,
    //               null when rejected.
    login: function (username, position, callback) {
      var randomBytes = crypto.randomBytes(32);
      var sessionId = randomBytes.toString('hex');
      
      var date = new Date();
      date.setTime(date.getTime()+EXPIRE_TIME);
      var altData = {};
      if (app.simaya.installationId) {
        var altUser = "u" + app.simaya.installationId + ":" + username;
        altData = {
          username: altUser,
          position: position,
          sessionId: sessionId,
          expireAt: date
        };
      }
      var data = {
        username: username,
        position: position,
        sessionId: sessionId,
        expireAt: date
      };

      db.validateAndInsert(data, function (error, validator) {

        if (error != null) {
          callback(rejectionReason.MongoDBError);
          return;
        }
        var result = null;
        var reason = rejectionReason.NoError;
        if (!validator.hasErrors()) {
          result = sessionId; 
          user.update({ username: username }, 
            {
              '$set': { lastLogin: new Date() }
            } , function(e) {
              callback(result, reason);
            }
          );
        } else {
          db.validateAndInsert(altData, function (error, validator) {
            if (error != null) {
              callback(rejectionReason.MongoDBError);
              return;
            }
            var result = null;
            var reason = rejectionReason.NoError;
            if (!validator.hasErrors()) {
              result = sessionId; 
              user.update({ username: username }, 
                {
                  '$set': { lastLogin: new Date() }
                } , function(e) {
                  callback(result, reason);
                }
              );
            } else {
              var check = validator.errors.username;
              if (typeof(check) !== "undefined") {
                for (var i = 0; i < check.length; i ++) {
                  if (check[i] == DUPLICATE_MESSAGE) {
                    reason = rejectionReason.Duplicate;
                    break;
                  } else if (check[i] == INVALID_USER_MESSAGE) {
                    reason = rejectionReason.InvalidUserName;
                    break;
                  }
                }
              }
              callback(result, reason);
            }
          });
        }
      });
    },

    // Log-outs from a session 
    // Returns a callback
    //    error: database error if any
    logout: function (sessionId, callback) {
      db.remove({sessionId: sessionId}, function(error, result) {
        callback(); 
      });
    },

    // Update a session. This should be called 
    // before a session is considered expired.
    // If the position changed, which is either:
    //    - ip address is changed
    //    - lon/lat is changed > 0.01 (~1 Km)
    // or expired, then the session is invalidated and 
    // must be removed.
    //    user: the username
    //    position: the position object of
    //        ip: the ip address
    //        lon: longitude
    //        lat: latitude
    // Returns a callback
    //    error: database error if any
    //    result: 0 if session is still valid
    //            1 if session is expired
    //            2 if user is in different position
    //            3 if session is not found in db
    update: function (sessionId, position, callback) {
      db.findOne({sessionId: sessionId}, function(error, item){
        var result = 1;
        var time = new Date();
        
        if (item != null) {
          var stillValid = (item.expireAt > time);
          if (stillValid || (item.position && item.position.device && item.position.device.access == "mobile")) {
            result = 0;
          }
          
          var LOCATION_CHANGE_THRESHOLD = 0.01
          var lastPosition = item.position;
          var positionIsChanged = (
            position.ip != lastPosition.ip
            || (Math.abs(position.lon - lastPosition.lon) > LOCATION_CHANGE_THRESHOLD)
            || (Math.abs(position.lat - lastPosition.lat) > LOCATION_CHANGE_THRESHOLD)
          );
          
          if (positionIsChanged) {
            result = 2;
          }
          if (item.position.next) {
            if (position.key != item.position.next) {
              // mismatch key
              result = 4;
            }
            delete(position.key);
          }
        } else {
          result = 3;
        }
        
        if (result != 0) {
          db.remove({sessionId: sessionId}, function(error) {
            callback(result);
          });
        } else {
          time.setTime(time.getTime()+EXPIRE_TIME);
          db.update({ _id: item._id }, 
            {
              '$set': { 
                expireAt: time,
                position: position
              }
            }, function(error) { 
            callback(result);
         });
       }
      });
    },

    // Gets a user from the specified id
    // Returns a callback
    //    error: Error object when error happens
    //    user: null if not found
    getUser: function(id, callback) { 
      db.findOne({sessionId: id}, function(error, result) {
        var user = null;
        if (result != null) {
          user = result.username;
        }
        callback(user);
      });
    },

		// Gets a profile from the specified id
    // Returns a callback
    //    error: Error object when error happens
    //    profile: object, null if not found
    getProfile: function(id, callback) { 
      db.findOne({sessionId: id}, function(error, result) {
        var username = null;
        if (result != null) {
          username = result.username;
        }
        user.findOne({username: username}, function(error, result) {
          var profile = null;
          if (result != null) {
            profile = result.profile;
          }
          callback(profile);
        });
      });
    },
    
    // Lists user with optional search object of
    //    search: object query
    //    page: page index
    //    limit: number of records per page
    // Returns a callback:
    //    result: array of object of
    //      user: username
    //      createdDate: created date
    //      isActive: is active
    //      expireAt: expiry date
    list: function() {
      var callback;
      if (arguments.length == 1) {
        callback = arguments[0];
        
        db.findArray(function(error, result) {
          callback(result);
        });
      } else {
        search = arguments[0];
        callback = arguments[1];
        
        if (typeof(search.page) !== "undefined") {
          var offset = ((search.page - 1) * search.limit);
          var limit = search.limit;
          if (typeof(limit) === "undefined") {
            limit = 200; // default limit
          }

          db.find(search.search, function(error, cursor) {
            cursor.limit(limit).skip(offset).toArray(function (error, result) {
              callback(result);
            });
          });
        } else {
          db.findArray(search.search, function(error, result) {
            callback(result);
          });
        } 
      }
    },

    // -------------------------------------------------------------
    // TEST ONLY FUNCTIONS
    // MUST NOT BE CALLED FROM CONTROLLERS

    // Makes a session expire 
    // Returns a callback
    //    error: database error if any
    __test__makeExpire: function (sessionId, callback) {
      var date = new Date();
      date.setDate(date.getDate()-1);
      
      db.findAndModify(
        {sessionId: sessionId},
        [],
        {$set: {expireAt: date}},
        {new: true},
        function(error, result) {
          callback();
        }
      );
    },

    rejectionReason: rejectionReason,
    loginState: loginState
    

  }
}
