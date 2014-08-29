var utils = require('./utils.js');
var organization = require('../simaya/models/organization.js')(utils.app);

function bulkInsertOrganization(counter, parent, name, callback) {
  var data = {
    name: name + counter,
  }
  
  organization.create(parent, data, function(v){
    if (counter == 10) {
      callback();
      return;
    }
    bulkInsertOrganization(counter + 1, parent, name, callback);
  });
}

testCases = {
  setUp: function(callback) {
    utils.db.open(function() {
      if(numberOfTestsRun == numberOfTests) {
        // Drop database in the first run 
        utils.db.dropDatabase(function(err, done) {
          console.log("Inserting organization");
          bulkInsertOrganization(1, null, 'ORG', function() {
            bulkInsertOrganization(1, 'ORG1', 'Org', function() {
              bulkInsertOrganization(1, 'ORG1;Org1', 'org', function() {
                bulkInsertOrganization(1, 'ORG2', 'Org', function() {
                  bulkInsertOrganization(1, 'ORG2;Org1', 'org', function() {
                    bulkInsertOrganization(1, null, 'org', function() {
                      callback();
                    });
                  });
                });
              });
            });
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
  
  "create a new organization": function(test) {
    var name = 'org1';
    var data = {
      name: name, 
    }
    
    organization.create('ORG1;Org2', data, function (v) {
      test.ok(!v.hasErrors());
      test.done();
    });
  },


  "create a new organization with null parent": function(test) {
    var name = 'xorg2';
    var data = {
      name: name, 
    }
    
    organization.create(null, data, function (v) {
      test.ok(!v.hasErrors());
      test.done();
    });
  },

  "create a new organization with already existing path [-]": function(test) {
    var name = 'org1';
    var data = {
      name: name, 
    }
    
    organization.create('ORG1;Org1', data, function (v) {
      utils.checkError(test, v, 'path', 'There is already a path with this name');
      test.done();
    });
  },

  "list root organizations": function(test) {
    organization.list(null, function (r) {
      var ok = (r.length == 21);
      test.ok(ok);
      test.done();
    });
  },

  "list root organizations with empty params": function(test) {
    organization.list(null, { }, function (r) {
      if (r != null) {
        var ok = (r.length == 21);
        test.ok(ok);
      } else {
        test.ok(false, 'no result');
      }
      test.done();
    });
  },


  "list root organizations with params": function(test) {
    organization.list(null, { search: { name: 'org1' }}, function (r) {
      if (r != null) {
        var ok = (r.length == 1);
        test.ok(ok);
      } else {
        test.ok(false, 'no result');
      }
      test.done();
    });
  },

  "list organizations": function(test) {
    organization.list('ORG1', function (r) {
      var ok = (r.length == 21);
      test.ok(ok);
      test.done();
    });
  },

  "list organizations with empty params": function(test) {
    organization.list('ORG1', { }, function (r) {
      if (r != null) {
        var ok = (r.length == 21);
        test.ok(ok);
      } else {
        test.ok(false, 'no result');
      }
      test.done();
    });
  },


  "list organizations with params": function(test) {
    organization.list('ORG1', { search: { name: 'org1' }}, function (r) {
      if (r != null) {
        var ok = (r.length == 2);
        test.ok(ok);
      } else {
        test.ok(false, 'no result');
      }
      test.done();
    });
  },

  "replace an organization": function(test) {
    organization.edit('ORG2;Org1', 'ORG2;XOrg1', function (r) {
      test.ok(!r.hasErrors()); 
      test.done();
    });
  },

  "replace an organization by also renaming path [-]": function(test) {
    organization.edit('ORG2;XOrg1', 'ORG1;XOrg1', function (r) {
      utils.checkError(test, r,  'path', 'You can only rename, not change the whole path');
      test.done();
    });
  },

  "replace an invalid organization  [-]": function(test) {
    organization.edit('ORG2;Org1', 'ORG1;XOrg1', function (r) {
      utils.checkError(test, r,  'data', 'Non-existant id');
      test.done();
    });
  },

  "remove an organization": function(test) {
    organization.remove('ORG2;XOrg1', function(r) {
      organization.list('ORG2;XOrg1', function(r) {
        test.ok(r.length == 0);
        test.done();
      });
    });
  },

  "remove a root organization": function(test) {
    organization.remove('ORG1', function(r) {
      organization.list('ORG1', function(r) {
        test.ok(r.length == 0);
        test.done();
      });
    });
  },


}

var numberOfTests = Object.keys(testCases).length;
var numberOfTestsRun = numberOfTests; 
module.exports = testCases;
