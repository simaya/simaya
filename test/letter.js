var utils = require('./utils.js');
var letter = require('../simaya/models/letter.js')(utils.app);
var user = require('../sinergis/models/user.js')(utils.app);

function bulkInsert(user, counter, callback) {
  user.create('user'+counter, 'password', {}, function(e,v) {
    if (counter > 10) {
      callback();
      return;
    }
    bulkInsert(user, counter + 1, callback);
  });
}

function bulkInsertLetter(letter, counter, callback) {
  var date = new Date();
  date.setDate(date.getDate()+1);
  var data = {
    receivedDate: date,
    creationDate: new Date(),
    mailId: "123"+counter,
    fileAttachments: [ {path: "./test/file1-test.txt", name: "file1-test.txt", type: "application/txt"}, {path: "./test/file2-test.doc", name: "file2-test.doc", type: "application/doc"}, {path: "./test/file3-test.pdf", name: "file3-test.pdf", type: "application/pdf"}],
    recipients: [ "user1", "user2" ],
    ccList: [ "user3", "user4" ],
    originator: [ "user5" ],
    type: 0,
    template: [ "template1" ],
    title: "title",
    priority: 0,
    classification: 0,
    comments: "comments",
    reviewers: [ "user5", "user6" ]
  }
    
  letter.createNormal(data, function (v) {
    if (counter > 20) {
      callback();
      return;
    }
    bulkInsertLetter(letter, counter + 1, callback);
  });
}

testCases = {
  setUp: function(callback) {
    utils.db.open(function() {
      if(numberOfTestsRun == numberOfTests) {
        // Drop database in the first run 
        utils.db.dropDatabase(function(err, done) {
          console.log("Inserting user");
          bulkInsert(user, 1, function() {
            bulkInsertLetter(letter, 1, function() {
              callback();  
            });  
          });
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

  "import letter manually": function(test) {
    var date = new Date();
    date.setDate(date.getDate()+1);
    var data = {
      receivedDate: date,
      creationDate: new Date(),
      mailId: "12322",
      fileAttachments: [ {path: "./test/file1-test.txt", name: "file1-test.txt", type: "application/txt"}, {path: "./test/file2-test.doc", name: "file2-test.doc", type: "application/doc"}, {path: "./test/file3-test.pdf", name: "file3-test.pdf", type: "application/pdf"}],
      recipients: [ "user1", "user2" ],
      ccList: [ "user3", "user4" ],
      originator: [ "user5" ],
      type: 0,
      template: [ "template1" ],
      title: "title",
      priority: 0,
      classification: 0,
      comments: "comments",
      reviewers: [ "user5", "user6" ]
    }  
        
    letter.createFromExternal(data, function (v) {
      test.ok(!v.hasErrors(), "User creation is failed");
      test.done();
    });
  },

  "create normal letter": function(test) {
    var date = new Date();
    date.setDate(date.getDate()+1);
    var data = {
      receivedDate: date,
      creationDate: new Date(),
      mailId: "12323",
      fileAttachments: [ {path: "./test/file1-test.txt", name: "file1-test.txt", type: "application/txt"}, {path: "./test/file2-test.doc", name: "file2-test.doc", type: "application/doc"}, {path: "./test/file3-test.pdf", name: "file3-test.pdf", type: "application/pdf"}],
      recipients: [ "user1", "user2" ],
      ccList: [ "user3", "user4" ],
      originator: [ "user5" ],
      type: 0,
      template: [ "template1" ],
      title: "title",
      priority: 0,
      classification: 0,
      comments: "comments",
      reviewers: [ "user5", "user6" ]
    }  
        
    letter.createNormal(data, function (v) {
      test.ok(!v.hasErrors(), "User creation is failed");
      test.done();
    });
  },
  
  "create normal letter with same mailId [-]": function(test) {
    var date = new Date();
    date.setDate(date.getDate()+1);
    var data = {
      receivedDate: date,
      creationDate: new Date(),
      mailId: "12323",
      fileAttachments: [ {path: "./test/file1-test.txt", name: "file1-test.txt", type: "application/txt"}, {path: "./test/file2-test.doc", name: "file2-test.doc", type: "application/doc"}, {path: "./test/file3-test.pdf", name: "file3-test.pdf", type: "application/pdf"}],
      recipients: [ "user1", "user2" ],
      ccList: [ "user3", "user4" ],
      originator: [ "user5" ],
      type: 0,
      template: [ "template1" ],
      title: "title",
      priority: 0,
      classification: 0,
      comments: "comments",
      reviewers: [ "user5", "user6" ]
    }  
        
    letter.createNormal(data, function (v) {
      utils.checkError(test, v, 'mailId', 'There is already a letter with this mailId');
      test.done();
    });
  },
  
  "create normal letter with null mailId [-]": function(test) {
    var date = new Date();
    date.setDate(date.getDate()+1);
    var data = {
      receivedDate: date,
      creationDate: new Date(),
      mailId: null,
      fileAttachments: [ {path: "./test/file1-test.txt", name: "file1-test.txt", type: "application/txt"}, {path: "./test/file2-test.doc", name: "file2-test.doc", type: "application/doc"}, {path: "./test/file3-test.pdf", name: "file3-test.pdf", type: "application/pdf"}],
      recipients: [ "user1", "user2" ],
      ccList: [ "user3", "user4" ],
      originator: [ "user5" ],
      type: 0,
      template: [ "template1" ],
      title: "title",
      priority: 0,
      classification: 0,
      comments: "comments",
      reviewers: [ "user5", "user6" ]
    }  
        
    letter.createNormal(data, function (v) {
      utils.checkError(test, v, 'Data', 'mailId is not set');
      test.done();
    });
  },
  
  "create normal letter with undefined recipients [-]": function(test) {
    var date = new Date();
    date.setDate(date.getDate()+1);
    var data = {
      receivedDate: date,
      creationDate: new Date(),
      mailId: "12324",
      fileAttachments: [ {path: "./test/file1-test.txt", name: "file1-test.txt", type: "application/txt"}, {path: "./test/file2-test.doc", name: "file2-test.doc", type: "application/doc"}, {path: "./test/file3-test.pdf", name: "file3-test.pdf", type: "application/pdf"}],
      ccList: [ "user3", "user4" ],
      originator: [ "user5" ],
      type: 0,
      template: [ "template1" ],
      title: "title",
      priority: 0,
      classification: 0,
      comments: "comments",
      reviewers: [ "user5", "user6" ]
    }  
        
    letter.createNormal(data, function (v) {
      utils.checkError(test, v, 'Data', 'Recipients is not set');
      test.done();
    });
  },
  
  "create normal letter with null originator [-]": function(test) {
    var date = new Date();
    date.setDate(date.getDate()+1);
    var data = {
      receivedDate: date,
      creationDate: new Date(),
      mailId: "12325",
      fileAttachments: [ {path: "./test/file1-test.txt", name: "file1-test.txt", type: "application/txt"}, {path: "./test/file2-test.doc", name: "file2-test.doc", type: "application/doc"}, {path: "./test/file3-test.pdf", name: "file3-test.pdf", type: "application/pdf"}],
      recipients: [ "user1", "user2" ],
      ccList: [ "user3", "user4" ],
      originator: null,
      type: 0,
      template: [ "template1" ],
      title: "title",
      priority: 0,
      classification: 0,
      comments: "comments",
      reviewers: [ "user5", "user6" ]
    }  
        
    letter.createNormal(data, function (v) {
      utils.checkError(test, v, 'Data', 'Originator is not set');
      test.done();
    });
  },
  
 
  "create normal letter with null title [-]": function(test) {
    var date = new Date();
    date.setDate(date.getDate()+1);
    var data = {
      receivedDate: date,
      creationDate: new Date(),
      mailId: "12327",
      fileAttachments: [ {path: "./test/file1-test.txt", name: "file1-test.txt", type: "application/txt"}, {path: "./test/file2-test.doc", name: "file2-test.doc", type: "application/doc"}, {path: "./test/file3-test.pdf", name: "file3-test.pdf", type: "application/pdf"}],
      recipients: [ "user1", "user2" ],
      ccList: [ "user3", "user4" ],
      originator: [ "user5" ],
      type: 0,
      template: [ "template1" ],
      title: null,
      priority: 0,
      classification: 0,
      comments: "comments",
      reviewers: [ "user5", "user6" ]
    }  
        
    letter.createNormal(data, function (v) {
      utils.checkError(test, v, 'Data', 'Title is not set');
      test.done();
    });
  },
  
  "create normal letter with undefined classification [-]": function(test) {
    var date = new Date();
    date.setDate(date.getDate()+1);
    var data = {
      receivedDate: date,
      creationDate: new Date(),
      mailId: "12328",
      fileAttachments: [ {path: "./test/file1-test.txt", name: "file1-test.txt", type: "application/txt"}, {path: "./test/file2-test.doc", name: "file2-test.doc", type: "application/doc"}, {path: "./test/file3-test.pdf", name: "file3-test.pdf", type: "application/pdf"}],
      recipients: [ "user1", "user2" ],
      ccList: [ "user3", "user4" ],
      originator: [ "user5" ],
      type: 0,
      template: [ "template1" ],
      title: "title",
      priority: 0,
      comments: "comments",
      reviewers: [ "user5", "user6" ]
    }  
        
    letter.createNormal(data, function (v) {
      utils.checkError(test, v, 'Data', 'Classification is not set');
      test.done();
    });
  },
  
  "create normal letter with undefined creationDate [-]": function(test) {
    var date = new Date();
    date.setDate(date.getDate()+1);
    var data = {
      receivedDate: date,
      mailId: "12330",
      fileAttachments: [ {path: "./test/file1-test.txt", name: "file1-test.txt", type: "application/txt"}, {path: "./test/file2-test.doc", name: "file2-test.doc", type: "application/doc"}, {path: "./test/file3-test.pdf", name: "file3-test.pdf", type: "application/pdf"}],
      recipients: [ "user1", "user2" ],
      ccList: [ "user3", "user4" ],
      originator: [ "user5" ],
      type: 0,
      template: [ "template1" ],
      title: "title",
      priority: 0,
      classification: 0,
      comments: "comments",
      reviewers: [ "user5", "user6" ]
    }  
        
    letter.createNormal(data, function (v) {
      utils.checkError(test, v, 'Data', 'creationDate is not set');
      test.done();
    });
  },
  
  "create normal letter with null fileAttachments [-]": function(test) {
    var date = new Date();
    date.setDate(date.getDate()+1);
    var data = {
      receivedDate: date,
      creationDate: new Date(),
      mailId: "12331",
      fileAttachments: null,
      recipients: [ "user1", "user2" ],
      ccList: [ "user3", "user4" ],
      originator: [ "user5" ],
      type: 0,
      template: [ "template1" ],
      title: "title",
      priority: 0,
      classification: 0,
      comments: "comments",
      reviewers: [ "user5", "user6" ]
    }  
        
    letter.createNormal(data, function (v) {
      utils.checkError(test, v, 'Data', 'fileAttachments is not set');
      test.done();
    });
  },

  "list data without search arguments": function(test) {
    letter.list({}, function(r) {
      // Check:
      // 0. number of rows returned
      // 1. data correctnes
      var numberOfRows = (r.length == 24);
      var validMailId = false;
      r.forEach(function(element, index){
        if (element.mailId == "123"+(index+1)) {
          validMailId = true;
        }
      });
      console.log(r);
      var isOk = (numberOfRows && validMailId);
      test.ok(isOk == true, 'list data without search arguments failed');
      test.done();
    });
  },
  
  "list data": function(test) {
    var search = {
    }
    letter.list(search, function(r) {
      // Check:
      // 0. number of rows returned
      // 1. data correctnes
      var numberOfRows = (r.length == 24);
      var validMailId = false;
      r.forEach(function(element, index){
        if (element.mailId == "123"+(index+1)) {
          validMailId = true;
        }
      });
      var isOk = (numberOfRows && validMailId);
      test.ok(isOk == true, 'list data without search arguments failed');
      test.done();
    });
  },
  
  "list data with paging": function(test) {
    var search = {
      _limit: 5,
      _page: 2,
    }
    letter.list(search, function(r) {
      // Check:
      // 0. number of rows returned
      // 1. data correctnes
      var numberOfRows = (r.length == 5);
      var validMailId = false;
      r.forEach(function(element, index){
        if (element.mailId == "123"+(index+6)) {
          validMailId = true;
        } else {
          validMailId = false;
        }
      });
      var isOk = (numberOfRows && validMailId);
      test.ok(isOk == true, 'list data without search arguments failed');
      test.done();
    });
  },

  "edit data": function(test) {
    letter.list({}, function(r) {
      var data = {
        recipients: ['user3'],
        priority: 1
      }
      letter.edit(r[0]._id, data, function(v) {
        letter.list({ search: {_id: r[0]._id}},function(r) {
        console.log(r[0]);
          test.ok(r[0].priority == 1);
          test.done();
        });
      });
    });
  },
  
  "edit data with file attachment": function(test) {
    letter.list({}, function(r) {
      var data = {
        recipients: ['user3'],
        priority: 1,
        fileAttachments: [ {path: "./test/file1-test.txt", name: "file1-test.txt", type: "application/txt"}]
      }
      letter.edit(r[0]._id, data, function(v) {
        letter.list({ search: {_id: r[0]._id}},function(r) {
        console.log(r[0]);
          test.ok(r[0].priority == 1);
          test.done();
        });
      });
    });
  }
}

var numberOfTests = Object.keys(testCases).length;
var numberOfTestsRun = numberOfTests; 
module.exports = testCases;
