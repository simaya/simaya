var utils = require('./utils.js');
var calendar = require('../simaya/models/calendar.js')(utils.app);

testCases = {
  setUp: function(callback) {
    utils.db.open(function() {
      if(numberOfTestsRun == numberOfTests) {
        // Drop database in the first run 
        utils.db.dropDatabase(function(err, done) {
          callback();  
        });                
      } else {
        callback();        
      }    
    });
  },

  tearDown: function(callback) {
    numberOfTestsRun = numberOfTestsRun - 1;

    utils.db.close();
    callback();
  },

  "create": function(test) {
    var from = new Date();
    var until = new Date();
    until.setDate(until.getDate()+1);

    var data = {
      start: from,
      end: until,
      active: true
    }  
        
    calendar.create(data, function (v) {
      if (v.hasErrors()) {
        console.log(v.errors)
      }
      test.ok(!v.hasErrors(), "calendar creation is failed");
      test.done();
    });
  },


  "create with wrong dates": function(test) {
    var from = new Date();
    var until = new Date();
    from.setDate(until.getDate()+1);

    var data = {
      start: from,
      end: until,
      active: true
    }  
        
    calendar.create(data, function (v) {
      if (v.hasErrors()) {
        console.log(v.errors)
      }
      test.ok(v.hasErrors(), "calendar creation is failed");
      test.done();
    });
  },

}

var numberOfTests = Object.keys(testCases).length;
var numberOfTestsRun = numberOfTests; 
module.exports = testCases;
