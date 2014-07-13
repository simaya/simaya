var utils = require('./utils.js');
var user = require('../sinergis/models/user.js')(utils.app);

var counter=0;
function bulkInsert(user, callback) {
  var p = {
    firstName: 'User ' + counter,
    lastName: 'Smith',
    gender: 'm'
  }
  user.create('user'+(counter++), 'password', p, function(e,v) {
    if (counter > 100) {
      callback();
      return;
    }
    bulkInsert(user, callback);
  });
}

testCases = {
  setUp: function(callback) {
    utils.db.open(function() {
      if(numberOfTestsRun == numberOfTests) {
        // Drop database in the first run 
        utils.db.dropDatabase(function(err, done) {
          console.log("Inserting user");
          bulkInsert(user, callback);
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

  "create user": function(test) {
    var p = {
      firstName: 'John',
      lastName: 'ABC',
      gender: 'm'
    }
   
    user.create('abc', 'defghi', p, function (v) {
      test.ok(!v.hasErrors(), "User creation is failed");
      test.done();
    });
  },
  
  "modify user": function(test) {
    var p = {
      firstName: 'Mimimi',
      lastName: 'Opopo',
      gender: 'f'
    }
   
    user.modifyProfile('abc', p, function (v) {
      if (!v.hasErrors()) {
        user.list({ search: { username: 'abc' }}, function(r) {
          var success = r[0].profile.firstName == 'Mimimi';
          test.ok(success);
          test.done();
        });
      } else {
        test.ok(false);
        test.done();
      }
    });
  },
 
  "modify user with wrong username [-]": function(test) {
    var p = {
      firstName: 'Mimimi',
      lastName: 'Opopo',
      gender: 'f'
    }
   
    user.modifyProfile('xxxabc', p, function (v) {
      if (v.hasErrors()) {
        test.ok(true);
        test.done();
      } else {
        test.ok(false);
        test.done();
      }
    });
  },
  
  "checks availability of existing user": function(test) {
    user.checkAvailability('abc', function(result) {
      test.ok(result, "User 'abc' is not found");
      test.done();
    });
  },
  
  "checks availability of non existing user [-]": function(test) {
    user.checkAvailability('abcd', function(result) {
      test.ok(result == false, "User 'abc' is not found");
      test.done();
    });
  },
  
  "create user again but with the same name [-]": function(test) {
    user.create('abc', 'defghi', {}, function (v) {
      utils.checkError(test, v, 'username', 'There is already a user with this name');
      test.done();
    });
  },
  
  "create user with password less than 5 characters [-]": function(test) {
    user.create('abc5', 'defgh', {}, function (v) {
      utils.checkError(test, v, 'password', 'Invalid password');
      test.done();
    });
  },

  "change password": function(test) {
    user.changePassword('abc', 'xdefghi', function (v) {
      test.ok(v, "Change password is failed");
      test.done();
    });
  },
  
  "change password with password less than 5 characters [-]": function(test) {
    user.changePassword('abc', 'dddi', function (v) {
      utils.checkError(test, v, 'password', 'Invalid password');
      test.done();
    });
  },
  
  "change password for non-existant user [-]": function(test) {
    user.changePassword('abcd', 'xdefghi', function (v) {
      utils.checkError(test, v, 'username', 'Non-existant user');
      test.done();
    });
  },
  
  "check user status, must be inactive first": function(test) {
    user.isActive('abc', function (result) {
      test.ok(result == false, "User 'abc' is inactive");
      test.done();
    });
  },
  
  "set user as active": function(test) {
    user.setActive('abc', function () {
      // check result
      user.isActive('abc', function (result) {
        test.ok(result, "User 'abc' is active");
        test.done();
      });
    });
  },
  
  "set user as inactive": function(test) {
    user.setInActive('abc', function () {
      // check result
      user.isActive('abc', function (result) {
        test.ok(result == false, "User 'abc' is active");
        test.done();
      });
    });
  },
  
  "authenticate": function(test) {
    // Must use same password as changed previously
    user.authenticate('abc', 'xdefghi', function (result) {
      test.ok(result, "Authentication failed");
      test.done();
    });
  },

  "authenticate with wrong password [-]": function(test) {
    // Must use same password as changed previously
    user.authenticate('abc', 'bogus', function (result) {
      test.ok(result == false, "Authentication failed");
      test.done();
    });
  },
 
  "authenticate with wrong username [-]": function(test) {
    // Must use same password as changed previously
    user.authenticate('non-existant', 'bogus', function (result) {
      test.ok(result == false, "Authentication failed");
      test.done();
    });
  },
 
  "set expiry date to a user to a future date": function(test) {
    var date = new Date("Mon, 20 Jul 2012 06:28:33 GMT");
    user.setExpireDate('abc', date, function (result) {
      test.ok(result, "set expiry date failed");
      test.done();
    });
  },
 
  "check expiry date with not yet expired user": function(test) {
    var date = new Date();
    user.isExpired('abc', date, function (result) {
      test.ok(result == false, "check expiry date failed");
      test.done();
    });
  },
 
  "set expiry date to a user with old date": function(test) {
    var date = new Date("Mon, 01 Jul 2012 06:28:33 GMT");
    user.setExpireDate('abc', date, function (result) {
      test.ok(result, "set expiry date failed");
      test.done();
    });
  },
 
 "check expiry date with already expired user": function(test) {
    var date = new Date();
    user.isExpired('abc', date, function (result) {
      test.ok(result, "check expiry date failed");
      test.done();
    });
  },
  
  "check the expiry date of a user": function(test) {
    user.expiryDate('abc', function (result) {
      test.ok(result, "check expiry date failed");
      test.done();
    });
  },
 
  "check expiry date with wrong username [-]": function(test) {
    var date = new Date();
    user.isExpired('abcddd', date, function (result) {
      test.ok(result == false, "check expiry date failed");
      test.done();
    });
  },
 
  "list users": function(test) {    
    user.list(function(result) {
      var isOk = (result instanceof Array && result != null);
      test.ok(isOk, 'list users failed');
      test.done();
    });
  },
 
  "list all users with limit argument": function(test) {
    var search = {
      page: 2,
      limit: 20
    };
    user.list(search, function(result) {
      var isArray = (result instanceof Array && result != null);
      var correctTotal = (result.length == search.limit);
      var isOk = (isArray && correctTotal);
      test.ok(isOk, 'list users failed');
      test.done();
    });
  },
  
  "list users with search argument": function(test) {
    var search = {
      search: {
        username: /abc/
      }
    };
  
    user.list(search, function(result) {
      var isArray = (result instanceof Array && result != null);
      var isValidResult = (result[0].username == 'abc');
      var isOk = (isArray && isValidResult);
      test.ok(isOk, 'list users failed');
      test.done();
    });
  },
  
  "list users with search argument and no result found": function(test) {
    var search = {
      search: {
        username: 'non-existant-record'
      }
    };
  
    user.list(search, function(result) {
      var isArray = (result instanceof Array && result != null);
      var isNoResult = (typeof result[0] === 'undefined');
      var isOk = (isArray && isNoResult);
      test.ok(isOk, 'list users failed');
      test.done();
    });
  },
  
  "list users with search and limit argument": function(test) {
    var search = {
      search: {
        username: /^user2/
      },
      page: 2,
      limit: 5 
    };
  
    user.list(search, function(result) {
      var isArray = (result instanceof Array && result != null);
      var isValidResult;
      var counter=5;
      result.forEach(function (element, index) {
        isValidResult = (element.username == "user2"+(counter++));
      });
      var isOk = (isArray && isValidResult);
      test.ok(isOk, 'list users failed');
      test.done();
    });
  },

  "associate user with email": function(test) {
    user.associateEmail("user2", "email@example.com", function(token, v) {
      user.emailList("user2", function(result) {
        if (result.length == 1 && result[0].isValidated == false) {
          user.activateEmailAssociation(token, "email@example.com", function(result) {
            user.emailList("user2", function(result) {
              test.ok(result.length == 1 && result[0].isValidated == true); 
              test.done();
            });
          });
        } else {
          console.log(result);
          test.ok(false, "associated emails shouldn't be active yet");
          test.done();
        }
      });
    });
  },

  "associate user with email which already used by some other user [-]": function(test) {
    user.associateEmail("user1", "email@example.com", function(token) {
      test.ok(typeof(token) === "undefined");
      test.done();
    });
  },


  "associate user with another email": function(test) {
    user.associateEmail("user2", "another-email@example.com", function(token, v) {
      user.emailList("user2", function(result) {
        if (result.length == 2 && result[1].isValidated == false) {
          user.activateEmailAssociation(token, "another-email@example.com", function(result) {
            user.emailList("user2", function(result) {
              test.ok(result.length == 2 && result[1].isValidated == true); 
              test.done();
            });
          });
        } else {
          console.log(result);
          test.ok(false, "associated emails shouldn't be active yet");
          test.done();
        }
      });
    });
  },

  "get a username from an email address": function(test) {
    user.getUserFromEmail("email@example.com", function(user) {
      test.ok(user == "user2", "email@example.com not found");
      test.done();
    });
  },

  "get a username from a not found email address": function(test) {
    user.getUserFromEmail("wrong-email@example.com", function(user) {
      test.ok(user == null, "getUserFromEmail return value is invalid");
      test.done();
    });
  },

  "get a username from a wrong email address": function(test) {
    user.getUserFromEmail("wrong-email", function(user) {
      test.ok(user == null, "getUserFromEmail return value is invalid");
      test.done();
    });
  },

  "removes an email address from a user": function(test) {
    user.associateEmail("user2", "yet-another-email@example.com", function(token, v) {
      user.activateEmailAssociation(token, "yet-another-email@example.com", function(result) {
        user.disassociateEmail("user2", ["another-email@example.com", "email@example.com"], function(result) {
          if (result == false) {
            test.ok(false);
            test.done();
            return;
          }
          user.emailList("user2", function(result) {
            var success = false;
            if (result.length == 1 && result[0].email == "yet-another-email@example.com") {
              success = true;
            }
            test.ok(success);
            test.done();
          });
        });
      });
    });
  },



  "associate a role to a user": function(test) {
    user.addRole("user3", "admin", function(r) {
      test.ok(r == true, "Adding role failed");
      test.done();
    });
  },

  "associate more role to a user": function(test) {
    user.addRole("user3", "user", function(r) {
      test.ok(r == true, "Adding role failed");
      test.done();
    });
  },

  "associate another more role to a user": function(test) {
    user.addRole("user3", "superuser", function(r) {
      test.ok(r == true, "Adding role failed");
      test.done();
    });
  },

  "list roles from a user": function(test) {
    user.roleList("user3", function(r) {
      var l = (r.length == 3);
      var d = (r[0] == "admin" && r[1] == "user" && r[2] == "superuser");
      
      test.ok((l && d) == true, "List role failed");
      test.done();
    });
  },

  "associate a role to an invalid user [-]": function(test) {
    user.addRole("no-user3", "user", function(r) {
      test.ok(r == false, "Result does not make sense");
      test.done();
    });
  },

  "check whether a user has some roles": function(test) {
    user.hasRoles("user3", ["admin", "user"], function(r) {
      test.ok(r == true);
      test.done();
    });
  },

  "check whether a user has a role": function(test) {
    user.hasRoles("user3", [ "user"], function(r) {
      test.ok(r == true);
      test.done();
    });
  },

  "check whether a user has an invalid role [-]": function(test) {
    user.hasRoles("user3", [ "no-user"], function(r) {
      test.ok(r == false);
      test.done();
    });
  },

  "check whether an invalid user has a role [-]": function(test) {
    user.hasRoles("no-user3", [ "user"], function(r) {
      test.ok(r == false);
      test.done();
    });
  },

  "check whether a user has some valid and invalid roles [-]": function(test) {
    user.hasRoles("user3", ["no-admin", "user"], function(r) {
      test.ok(r == false);
      test.done();
    });
  },

  "remove a role from a user": function(test) {
    user.removeRole("user3", "user", function(r) {
      if (r == true) {
        user.roleList("user3", function(r) {
          var l = (r.length == 2);
          var d = (r[0] == "admin" && r[1] == "superuser");
          
          test.ok((l && d) == true);
          test.done();
        });
      } else {
        test.ok(false);
        test.done();
      }
    });
  },

  "sets roles to a user": function(test) {
    user.setRoles("user3", [ "role1", "role2", "role3" ], function(r) {
      user.roleList("user3", function(r) {
        var s = (r.length == 3) &&
                (r[0] == "role1") &&
                (r[1] == "role2") &&
                (r[2] == "role3");
        test.ok(s);
        test.done();
      });
    });
  } 
}

var numberOfTests = Object.keys(testCases).length;
var numberOfTestsRun = numberOfTests; 
module.exports = testCases;
