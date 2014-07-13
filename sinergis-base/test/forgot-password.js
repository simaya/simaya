var utils = require('./utils.js');
var forgotPassword = require('../sinergis/models/forgot-password.js')(utils.app);

testCases = {
  setUp: function(callback) {
    utils.db.open(function() {
      if(numberOfTestsRun == numberOfTests) {
        // Drop database in the first run 
        utils.db.dropDatabase(function(err, done) {
          callback();
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

  "create session": function(test) {
    // FILL: Create a user first
    forgotPassword.create('abc', 'email@email.com', function (token, code, v) {
      // FILL
      test.done();
    });
  },

  "create a session with invalid user [-]": function(test) {
    forgotPassword.create('abc', 'email@email.com', function (token, code, v) {
      // FILL
      test.done();
    });
  },

  "create a session with invalid email [-]": function(test) {
    forgotPassword.create('abc', 'email@email.com', function (token, code, v) {
      // FILL
      test.done();
    });
  },

  "create a session with invalid user AND email [-]": function(test) {
    forgotPassword.create('abc', 'email@email.com', function (token, code, v) {
      // FILL
      test.done();
    });
  },

  "activate a valid session": function(test) {
    var token, verificationCode;
    forgotPassword.activate(token, verificationCode, function (v) {
      // FILL
      // FILL also check whether the session is deleted
      test.done();
    });
  },

  "active a valid session with expired session [-]": function(test) {
    var token, verificationCode;
    forgotPassword.activate(token, verificationCode, function (v) {
      // FILL
      test.done();
    });
  },

  "active a session with invalid token [-]": function(test) {
    var token, verificationCode;
    forgotPassword.activate(token, verificationCode, function (v) {
      // FILL
      test.done();
    });
  },

  "active a session with invalid verificationCode [-]": function(test) {
    var token, verificationCode;
    forgotPassword.activate(token, verificationCode, function (v) {
      // FILL
      test.done();
    });
  },

  "active a session with invalid token and verificationCode [-]": function(test) {
    var token, verificationCode;
    forgotPassword.activate(token, verificationCode, function (v) {
      // FILL
      test.done();
    });
  },

  "active a session with invalid token and verificationCode and already expired [-]": function(test) {
    var token, verificationCode;
    forgotPassword.activate(token, verificationCode, function (v) {
      // FILL
      test.done();
    });
  },

  "delete expired session": function(test) {
    forgotPassword.clean(function () {
      // FILL
      test.done();
    });
  },



  

}

var numberOfTests = Object.keys(testCases).length;
var numberOfTestsRun = numberOfTests; 
module.exports = testCases;

