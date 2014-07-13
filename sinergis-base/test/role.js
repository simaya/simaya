var utils = require('./utils.js');
var role = require('../sinergis/models/role.js')(utils.app);

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

  "create a new role": function(test) {
    role.create('role1', 'description', function (v) {
      test.ok(!v.hasErrors(), 'create a new role failed');
      test.done();
    });
  },

  "create a new role with invalid name [-]": function(test) {
    role.create('r1', 'description', function (v) {
      console.log(v.hasErrors())
      test.ok(v.hasErrors() == true);
      test.done();
    });
  },

  "modify a role": function(test) {
    role.edit('role1', 'role1x', 'new description', function (v) {
      test.ok(!v.hasErrors());
      test.done();
    });
  },

  "create a new role with another invalid name [-]": function(test) {
    role.create('roe 2', 'description', function (v) {
      test.ok(v.hasErrors() == true);
      test.done();
    });
  },


  "list roles": function(test) {
    role.list(function (result) {
      var isArray = (result instanceof Array && result != null);
      var isValid;
      result.forEach(function(element) {
        isValid = (element.roleName == 'role1x' && element.roleDescription == 'new description');
      });
      var isOk = (isArray && isValid);
      test.ok(isOk, 'list roles failed');
      test.done();
    });
  },

  "delete a role": function(test) {
    role.remove('role1', function(result) {
      test.ok(result == true, 'delete a role failed');
      test.done();
    });
  },

}

var numberOfTests = Object.keys(testCases).length;
var numberOfTestsRun = numberOfTests; 
module.exports = testCases;

