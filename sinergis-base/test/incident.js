var utils = require('./utils.js');
var incident = require('../sinergis/models/incident.js')(utils.app);

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

  "log incident": function(test) {
    var username, position, severity, category, description;
    incident.log(username, position, severity, category, description, function (e) {
      // FILL
      test.done();
    });
  },

  "list incident": function(test) {
    // FILL incident log first with data
    incident.list(function (e, result) {
      // FILL
      test.done();
    });
  },
   
  "list incident with argument: user": function(test) {
    // FILL incident log first with data
    var search;
    incident.list(search, function (e, result) {
      // FILL
      test.done();
    });
  },
   
  "list incident with argument: position": function(test) {
    // FILL incident log first with data
    var search;
    incident.list(search, function (e, result) {
      // FILL
      test.done();
    });
  },

  "list incident with argument: severity": function(test) {
    // FILL incident log first with data
    var search;
    incident.list(search, function (e, result) {
      // FILL
      test.done();
    });
  },

  "list incident with argument: category": function(test) {
    // FILL incident log first with data
    var search;
    incident.list(search, function (e, result) {
      // FILL
      test.done();
    });
  },

  "list incident with argument: date": function(test) {
    // FILL incident log first with data
    var search;
    incident.list(search, function (e, result) {
      // FILL
      test.done();
    });
  },

}

var numberOfTests = Object.keys(testCases).length;
var numberOfTestsRun = numberOfTests; 
module.exports = testCases;

