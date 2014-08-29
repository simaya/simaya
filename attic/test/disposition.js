var utils = require('./utils.js');
var disposition = require('../simaya/models/disposition.js')(utils.app);

var counter = 1;
function bulkInsertDisposition(disposition, callback) {
  var data = {
    recipients: [{ username: 'abc', action: 'reply'}, {username: 'cba', action: 'confirm' }],
    message: 'Disposition message '+counter,
    status: 'sent'
  }
  
  disposition.create(data, function(e, v){
    if (counter == 10) {
      callback();
      return;
    }
    counter++;
    bulkInsertDisposition(disposition, callback);
  });
}

testCases = {
  setUp: function(callback) {
    utils.db.open(function() {
      if(numberOfTestsRun == numberOfTests) {
        // Drop database in the first run 
        utils.db.dropDatabase(function(err, done) {
          console.log("Inserting disposition");
          bulkInsertDisposition(disposition, callback);
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
  
  "create a new disposition": function(test) {
    var data = {
      recipients: [{ username: 'abcd', action: 'reply'}, {username: 'cba', action: 'confirm' }],
      message: 'Disposition message 11',
      status: 'sent'
    }
    
    disposition.create(data, function (e, v) {
      test.ok(!v.hasErrors(), "Disposition creation is failed");
      test.done();
    });
  },
  
  "create a new disposition with wrong recipients action [-]": function(test) {
    var data = {
      recipients: [{ username: 'abc', action: 'reply'}, {username: 'cba', action: 'wrong-action' }],
      message: 'Disposition message 11',
      status: 'sent'
    }
    
    disposition.create(data, function (e, v) {
      utils.checkError(test, v, 'Recipients', 'Not valid disposition action');
      test.done();
    });
  },
  
  "create a new disposition with wrong status [-]": function(test) {
    var data = {
      recipients: [{ username: 'abc', action: 'reply'}, {username: 'cba', action: 'confirm' }],
      message: 'Disposition message 11',
      status: 'demoted'
    }
    
    disposition.create(data, function (e, v) {
      utils.checkError(test, v, 'Status', 'Not valid disposition status');
      test.done();
    });
  },
  
  "list disposition without argument": function(test) {
    disposition.list(function(v){
      var isValid = true;
      v.forEach(function(e, i){
        if (e.message != 'Disposition message '+(i+1)) {
          isValid = false;
        }
      });
      test.ok(isValid, 'list disposition without argument failed');
      test.done();
    })
  },
  
  "list disposition with search by username": function(test) {
    var search = {
      search: {
        recipients: { username: 'abcd' }
      }
    }
    
    disposition.list(search, function(v){
      var isValid = (v[0].recipients[0].username == 'abcd');
      test.ok(isValid, 'list disposition with search failed');
      test.done();
    })
  },

  "list disposition with search by username action": function(test) {
    var search = {
      search: {
        recipients: { action: 'confirm' }
      }
    }
    
    disposition.list(search, function(v){
      var isValid = false;
      v.forEach(function(e) {
        e.recipients.forEach(function(ee) {
          if (ee.action == 'confirm' && ee.username == 'cba') {
            isValid = true;
          }
        });
      });
      test.ok(isValid, 'list disposition with search failed');
      test.done();
    })
  },
  
  "list disposition with search by username and action": function(test) {
    var search = {
      search: {
        recipients: { username: 'abcd', action: 'reply' }
      }
    }
    
    disposition.list(search, function(v){
      var isValid = (v[0].recipients[0].username == 'abcd' && v[0].recipients[0].action == 'reply');
      test.ok(isValid, 'list disposition with search failed');
      test.done();
    })
  },

  
  "remove disposition": function(test) {
    var search = {
      search: {
        recipients: { username: 'abcd' }
      }
    }
    
    // Get disposition _id 
    disposition.list(search, function(v){
      disposition.remove(v[0]._id, function(error){
        test.ok(error == null, 'remove disposition failed');
        test.done();
      });
    })
  },
}

var numberOfTests = Object.keys(testCases).length;
var numberOfTestsRun = numberOfTests; 
module.exports = testCases;