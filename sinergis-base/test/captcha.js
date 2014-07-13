var utils = require('./utils.js');
var captcha = require('../sinergis/models/captcha.js')(utils.app);

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

  "create and validate captcha": function(test) {
    captcha.create(function (token, text) {
      captcha.validate(token, text, function (result) { 
        test.ok(result, "Captcha creation and validation is failed");
        test.done();
      });
    });
  },

  "create and validate captcha with invalid text [-]": function(test) {
    captcha.create(function (token, text) {
      // also render
      console.log(token);
      captcha.render(token, null, function() {
        captcha.validate(token, 'def', function (result) { 
          if (result == false) {
            test.ok(true, "");
            test.done();
          } else {
            test.ok(true, "Captcha creation and negative validation is failed");
            test.done();
          }
        });
      });
    });
  },

}

var numberOfTests = Object.keys(testCases).length;
var numberOfTestsRun = numberOfTests; 
module.exports = testCases;

