var utils = require('./utils.js');
var session = require('../sinergis/models/session.js')(utils.app);
var user = require('../sinergis/models/user.js')(utils.app);
var position = {
  ip: '192.168.1.1',
  lot: 0,
  lat: 0
};


testCases = {
  setUp: function(callback) {
    utils.db.open(function() {
      if(numberOfTestsRun == numberOfTests) {
        // Drop database in the first run 
        utils.db.dropDatabase(function(err, done) {
          user.create('username', 'defghi', {}, function (v) {
            callback();
          });
        });
      } else {
        return callback();        
      }    
    });
  },

  tearDown: function(callback) {
    numberOfTestsRun = numberOfTestsRun - 1;

    utils.db.close();
    callback();
  },
  
  "login to session and logout": function(test) {
    session.login('username', position, function (sessionId) {
      test.ok(sessionId != null, 'login to session failed');
      session.logout(sessionId, function() {
        test.done();
      });
    });
  },

  "login to session with incorrect username [-]": function(test) {
    session.login('wrong-username', position, function (sessionId, reason) {
      test.ok(sessionId == null 
        && reason == session.rejectionReason.InvalidUserName, 'login to session failed');
      test.done();
    });
  },
  
  "login to session when username is already login [-]": function(test) {
    session.login('username', position, function (ignored) {
      session.login('username', position, function (sessionId, reason) {
        test.ok(sessionId == null 
          && reason == session.rejectionReason.Duplicate, 'login to session failed');
        // Clear session for this username
        session.logout(ignored, function() {
          test.done();
        });
      });
    });
  },
  
  "login, update, and logout session": function(test) {
    session.login('username', position, function (sessionId) {
      session.update(sessionId, position, function (result) {
        test.ok(result == 0, 'Update session failed');
        if (result == 0) {
          session.logout(sessionId, function () {
            test.done();
          });
        } else {
          test.ok(false, 'Failed to update');
          test.done();
        }
      });
    });
  },

  
  "login and update in different position [-]": function(test) {
    session.login('username', position, function (sessionId) {
      var newPosition = {
        ip: '202',
        lon: 0,
        lat: 0
      };
  
      session.update(sessionId, newPosition, function (result) {
        test.ok(result == 2, 'Update session failed');
        if (result == 2) {
          test.done();
        } else { 
          test.ok(false, 'This should not be happening');
          session.logout(sessionId, function () {
            test.done();
          });
        }
      });
    });
  },
  
  "login and update after session is expired [-]": function(test) {
    session.login('username', position, function (sessionId) {
      session.__test__makeExpire(sessionId, function () {
        session.update(sessionId, position, function (result) {
          test.ok(result == 1, 'Update session failed');
          if (result == 1) {
            test.done();
          } else {
            test.ok(false, 'This should return 1');
            test.done();
          }
        });
      });
    });
  },

  "login and check with get user": function(test) {
    session.login('username', position, function (sessionId) {
      session.getUser(sessionId, function (result) {
        test.ok(result == 'username', 'User is not found in the session');
        test.done();
      });
    });
  },

  "check and invalid session id [-]": function(test) {
    session.getUser('non-existing-id', function (result) {
      test.ok(result == null, 'User found in the session, while it should not');
      test.done();
    });
  },


}

var numberOfTests = Object.keys(testCases).length;
var numberOfTestsRun = numberOfTests; 
module.exports = testCases;

