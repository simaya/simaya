var should = require("should");
var _ = require("lodash");
var chance = require("chance").Chance(9); // use exactly same seed for deterministic tests
var path = require("path");
var os = require("os");
var utils = require(__dirname + "/../helper/utils");
var letter = require(__dirname + "/../simaya/models/letter.js")(utils.app);
var notification = require(__dirname + "/../simaya/models/notification.js")(utils.app);
var user = utils.app.db("user");
var orgDb = utils.app.db("organization");
var fs = require("fs");
var async = require("async");

function bulkInsert(counter, callback) {
  user.insert({
    username: "user" + counter,
    profile: {
      organization: "org" + counter
    }
  }, function(e,v) {
    if (counter > 10) {
      callback();
      return;
    }
    bulkInsert(counter + 1, callback);
  });
}

var clearUser = function(cb) {
  user.remove({}, {j:false}, cb);
}

var clearOrg = function(cb) {
  orgDb.remove({}, {j:false}, cb);
}


var clearLetter = function(cb) {
  var l = utils.app.db("letter");
  l.remove({}, {j:false}, cb);
}

var clearNotification  = function(cb) {
  var l = utils.app.db("notification");
  l.remove({}, {j:false}, cb);
}

var insertUser = function(u, cb) {
  user.insert({
    username: u.username,
    profile: {
      organization: u.org,
    },
    roleList: u.roleList
  }, cb);
}

var insertOrg = function(org, cb) {
  orgDb.insert({
    name: org.name,
    path: org.path,
    head: org.head
  }, cb);
}

var createFile = function() {
  var filename = chance.string({length: 20});
  var fullFilename = path.join(os.tmpdir(), filename);
  var data = '';
  for (var i = 0; i < 100; i ++) {
    data += chance.paragraph();
  }
  fs.writeFileSync(fullFilename, data);

  return {
    name: filename,
    path: fullFilename,
    type: "text/plain",
    size: fs.statSync(fullFilename).size
  };
}

var saveAttachment = function(data, cb) {
  var file = createFile();
  var selector = {_id: data._id};
  letter.saveAttachmentFile(file, function(err, r0) {
    should(err).not.be.ok;

    var selector = {_id: data._id};
    file.path = r0.fileId;

    letter.addFileAttachment(selector, file, function(err) {
      should(err).not.be.ok;
      letter.editLetter(selector, data, function(err, r1) {
        should(err).not.be.ok;
        var filePath = path.join(os.tmpdir(), chance.string({length:20}));
        var stream = fs.createWriteStream(filePath);
        // mock http response stream
        stream.contentType = function() {};
        stream.attachment = function() {};

        var done = function(err) {
          should(err).not.be.ok;
        };

        stream.on("finish", function(){
          file.size.should.equal(fs.statSync(filePath).size);
          fs.unlinkSync(filePath);
          cb (r1);
        });

        letter.downloadAttachment({
          id:file.path,
          stream:stream
        }, done);
      });
    });
  });
}

describe("Letter structure", function() {
  var orgs = [
  { name: "A", path: "A", head: "a" },
  { name: "A A", path: "A;A", head: "aa" },
  { name: "A A B", path: "A;A;B", head: "aab" },
  { name: "A A B C", path: "A;A;B;C", head: "aabc" },
  { name: "B", path: "B", head: "b1" },
];
var users = [
  { username: "a", org: "A", roleList: [ "sender" ] },
  { username: "tu.a", org: "A", roleList: [ utils.simaya.administrationRole ]},
  { username: "a1", org: "A" },
  { username: "aa", org: "A;A", roleList: [ "sender" ] },
  { username: "aa1", org: "A;A" },
  { username: "aa2", org: "A;A" },
  { username: "aab", org: "A;A;B", roleList: [ "sender" ] },
  { username: "aab1", org: "A;A;B" },
  { username: "aab2", org: "A;A;B" },
  { username: "aabc", org: "A;A;B;C" },
  { username: "aabc1", org: "A;A;B;C" },
  { username: "aabc2", org: "A;A;B;C" },
]

  before(function(done) {
    var setup = function() {
      async.series([
        function(cb) {
          clearUser(function(err, r) {
            clearOrg(function(err, r) {
              clearLetter(function(err, r) {
                clearNotification(cb);
              });
            });
          });
        },
        function(cb) {
          async.map(orgs, insertOrg, cb);
        },
        function(cb) {
          async.map(users, insertUser, cb);
        },
        ], function(e,v) {
          bulkInsert(1, function(){
            done();
          });
        }
      );
    }
    if (utils.db.openCalled) {
      setup();
    } else {
      utils.db.open(function() {
        setup();
      });
    }

  });

  describe("Senders", function() {
    it ("should list senders", function(done) {
      letter.getSenders("A;A;B;C", function(err, data) {
        data.should.have.property("length");
        data.should.have.length(3);
        done();
      });
    });
  });

  describe("Reviewers", function() {
    it ("should list all possible reviewers", function(done) {
      letter.allPossibleReviewers("A;A", [], function(err, data) {
        var u = [];
        _.each(data, function(item) {
          u.push(item.username);
        });
        data.should.have.length(4);
        u.should.be.eql(["a", "aa", "aab", "aabc"]);
        done();
      });
    });

    it ("should list all possible reviewers with an exclusion", function(done) {
      letter.allPossibleReviewers("A;A", ["aab"], function(err, data) {
        var u = [];
        _.each(data, function(item) {
          u.push(item.username);
        });
        data.should.have.length(3);
        u.should.be.eql(["a", "aa", "aabc"]);
        done();
      });
    });

    it ("should list all possible reviewers with some exclusions", function(done) {
      letter.allPossibleReviewers("A;A", ["aab", "a"], function(err, data) {
        var u = [];
        _.each(data, function(item) {
          u.push(item.username);
        });
        data.should.have.length(2);
        u.should.be.eql(["aa", "aabc"]);
        done();
      });
    });


  });



});

describe("Letter", function() {
  var orgs = [
    { name: "A", path: "A", head: "a" },
    { name: "B", path: "B", head: "b1" },
  ];
  var users = [
    { username: "a", org: "A" },
    { username: "tu.a", org: "A", roleList: [ utils.simaya.administrationRole ]},
    { username: "a1", org: "A" },
    { username: "b", org: "B" },
    { username: "b1", org: "B" },
    { username: "tu.b", org: "B", roleList: [ utils.simaya.administrationRole ]},
  ]

  before(function(done) {
    var setup = function (){
      async.series([
        function(cb) {
          clearUser(function(err, r) {
            clearLetter(function(err, r) {
              clearNotification(cb);
            });
          });
        },
        function(cb) {
          async.map(orgs, insertOrg, cb);
        },
        function(cb) {
          async.map(users, insertUser, cb);
        },
        ], function(e,v) {
          bulkInsert(1, function(){
            done();
          });
        }
      );
    }

    if (utils.db.openCalled) {
      setup();
    } else {
      utils.db.open(function() {
        setup();
      });
    }
  });



  describe("Letter[Draft]", function() {
    it ("should fail when creating draft with empty data", function(done) {
      letter.createLetter({}, function(err, data) {
        should(err).be.ok;
        done();
      });
    });

    it ("should fail when missing originator", function(done) {
      letter.createLetter({sender:"abc", creationDate: new Date}, function(err, data) {
        should(err).be.ok;
        data.should.have.property("fields");
        data.fields.should.containEql("originator");
        done();
      });
    });

    it ("should fail when missing sender", function(done) {
      letter.createLetter({originator:"abc", creationDate: new Date}, function(err, data) {
        should(err).be.ok;
        data.should.have.property("fields");
        data.fields.should.containEql("sender");
        done();
      });
    });

    it ("should fail when missing creationDate", function(done) {
      letter.createLetter({originator:"abc", sender: "abc"}, function(err, data) {
        should(err).be.ok;
        data.should.have.property("fields");
        data.fields.should.containEql("creationDate");
        done();
      });
    });

    it ("should create an empty draft", function(done) {
      letter.createLetter({originator:"abc", sender: "abc", creationDate: new Date}, function(err, data) {
        should(err).not.be.ok;
        data.should.be.type("object");
        data.should.have.length(1);
        data[0].should.have.property("_id");
        done();
      });
    });
  });

  var letterData = [
    {
      operation: "manual-incoming",
      date: new Date,
      receivedDate: new Date,
      mailId: "123",
      incomingAgenda: "A123",
      recipient: "a",
      senderManual: {
        id: "id",
        name: "omama",
        organization: "org",
        address: "address"
      },
      title: "title",
      classification: "0",
      priority: "0",
      type: "11",
      comments: "comments 0"
    },
    {
      operation: "manual-incoming",
      date: new Date,
      receivedDate: new Date,
      mailId: "123",
      incomingAgenda: "A123",
      recipient: "a",
      ccList: "a1,b1",
      senderManual: {
        id: "id",
        name: "omama",
        organization: "org",
        address: "address"
      },
      title: "title",
      classification: "0",
      priority: "0",
      type: "11",
      comments: "comments 1"
    },
    {
      operation: "manual-outgoing",
      date: new Date,
      receivedDate: new Date,
      mailId: "123",
      outgoingAgenda: "A123",
      ccList: "",
      sender: "a",
      recipientManual: {
        id: "id",
        name: "omama",
        organization: "org",
        address: "address"
      },
      title: "title",
      classification: "0",
      priority: "0",
      type: "11",
      comments: "comments 2"
    },
    {
      operation: "manual-outgoing",
      date: new Date,
      receivedDate: new Date,
      mailId: "123",
      outgoingAgenda: "A123",
      ccList: "a1,b1",
      sender: "a",
      recipientManual: {
        id: "id",
        name: "omama",
        organization: "org",
        address: "address"
      },
      title: "title",
      classification: "0",
      priority: "0",
      type: "11",
      comments: "comments 3"
    },
    {
      operation: "manual-outgoing",
      date: new Date,
      receivedDate: new Date,
      mailId: "123",
      outgoingAgenda: "A123",
      ccList: "a1,b1",
      sender: "a",
      recipientManual: {
        id: "id",
        name: "omama",
        organization: "org",
        address: "address"
      },
      title: "title",
      classification: "0",
      priority: "0",
      type: "11",
      comments: "comments 4"
    },

  ];

  describe("Letter[manual-incoming]", function() {
    it ("should fail on incomplete data: sender", function(done) {
      var check = function(err, data) {
        var d = _.clone(letterData[0]);
        delete(d.senderManual);

        letter.editLetter({_id: data[0]._id}, d, function(err, data) {
          should(err).be.ok;
          data.should.have.property("success");
          data.should.have.property("fields");
          data.success.should.not.be.ok;
          data.fields.should.containEql("sender");
          done();
        });
      }

      letter.createLetter({originator:"abc", sender: "abc", creationDate: new Date}, check);
    });

    it ("should fail on invalid data: date", function(done) {
      var check = function(err, data) {
        var d = _.clone(letterData[0]);
        d.date = new Date("a");

        letter.editLetter({_id: data[0]._id}, d, function(err, data) {
          should(err).be.ok;
          data.should.have.property("success");
          data.should.have.property("fields");
          data.success.should.not.be.ok;
          data.fields.should.containEql("date");
          done();
        });
      }

      letter.createLetter({originator:"abc", sender: "abc", creationDate: new Date}, check);
    });

    it ("should fail on invalid data: receivedDate", function(done) {
      var check = function(err, data) {
        var d = _.clone(letterData[0]);
        d.receivedDate = new Date("a");

        letter.editLetter({_id: data[0]._id}, d, function(err, data) {
          should(err).be.ok;
          data.should.have.property("success");
          data.should.have.property("fields");
          data.success.should.not.be.ok;
          data.fields.should.containEql("receivedDate");
          done();
        });
      }

      letter.createLetter({originator:"abc", sender: "abc", creationDate: new Date}, check);
    });


    it ("should create an incoming letter", function(done) {
      var check = function(err, data) {
        var d = _.clone(letterData[0]);
        d._id = data[0]._id;
        saveAttachment(d, function(record) {
          record.should.have.length(1);
          record[0].should.have.property("fileAttachments");
          record[0].fileAttachments.should.have.length(1);
          done();
        });
      }

      letter.createLetter({originator:"tu.a", sender: "tu.a", creationDate: new Date}, check);
    });

    it ("should create an incoming letter with cc", function(done) {
      var check = function(err, data) {
        var d = _.clone(letterData[1]);
        d._id = data[0]._id;
        d.mailId = "321";
        d.incomingAgenda = "A321";
        saveAttachment(d, function(record) {
          record.should.have.length(1);
          record[0].should.have.property("fileAttachments");
          record[0].fileAttachments.should.have.length(1);
          record[0].should.have.property("ccList");
          record[0].ccList.should.have.length(2);
          done();
        });
      }

      letter.createLetter({originator:"tu.a", sender: "tu.a", creationDate: new Date}, check);
    });
    it ("should fail on creating manual incoming with duplicated data : mailId & Agenda", function(done) {
      var check = function(err, data) {
        var d = _.clone(letterData[0]);
        d.mailId = "12";
        d.outgoingAgenda = "A12";
        letter.editLetter({_id: data[0]._id}, d, function(err, data) {
          should(err).be.ok;
          done();
        });
        letter.editLetter({_id: data[0]._id}, d, function(err, data) {
        });

      }

      letter.createLetter({originator:"tu.a", sender: "tu.a", creationDate: new Date}, check);
    });
  });

  describe("Letter[manual-outgoing]", function() {
    it ("should fail on incomplete data: recipientManual", function(done) {
      var check = function(err, data) {
        var d = _.clone(letterData[2]);
        delete (d.recipientManual);

        letter.editLetter({_id: data[0]._id}, d, function(err, data) {
          should(err).be.ok;
          data.should.have.property("success");
          data.should.have.property("fields");
          data.success.should.not.be.ok;
          data.fields.should.containEql("recipientManual");
          done();
        });
      }

      letter.createLetter({originator:"tu.a", sender: "tu.a", creationDate: new Date}, check);
    });

    it ("should fail on invalid data: date", function(done) {
      var check = function(err, data) {
        var d = _.clone(letterData[2]);
        d.date = new Date("a");

        letter.editLetter({_id: data[0]._id}, d, function(err, data) {
          should(err).be.ok;
          data.should.have.property("success");
          data.should.have.property("fields");
          data.success.should.not.be.ok;
          data.fields.should.containEql("date");
          done();
        });
      }

      letter.createLetter({originator:"tu.a", sender: "tu.a", creationDate: new Date}, check);
    });

    it ("should create a manual outgoing letter", function(done) {
      var check = function(err, data) {
        var d = _.clone(letterData[2]);
        d._id = data[0]._id;
        d.mailId = "213";
        d.outgoingAgenda = "A213";
        saveAttachment(d, function(record) {
          record.should.have.length(1);
          record[0].status.should.be.eql(letter.Stages.SENT);
          record[0].should.have.property("fileAttachments");
          record[0].fileAttachments.should.have.length(1);
          done();
        });
      }

      letter.createLetter({originator:"tu.a", sender: "tu.a", creationDate: new Date}, check);
    });

    it ("should create a manual outgoing letter with cc", function(done) {
      var check = function(err, data) {
        var d = _.clone(letterData[4]);
        d._id = data[0]._id;
        d.mailId = "1234";
        d.outgoingAgenda = "A1234";
        saveAttachment(d, function(record) {
          record.should.have.length(1);
          record[0].status.should.be.eql(letter.Stages.SENT);
          record[0].should.have.property("fileAttachments");
          record[0].fileAttachments.should.have.length(1);
          //record[0].should.have.property("ccList");
          //record[0].ccList.should.have.length(2);
          record[0].should.have.property("receivingOrganizations");
          record[0].receivingOrganizations.should.have.property("A");
          record[0].receivingOrganizations.should.have.property("B");
          done();
        });
      }

      letter.createLetter({originator:"tu.a", sender: "tu.a", creationDate: new Date}, check);
    });
    it ("should fail on creating manual outgoing with duplicated data : mailId & Agenda", function(done) {
      var check = function(err, data) {
        var d = _.clone(letterData[3]);
        d.mailId = "123456";
        d.outgoingAgenda = "A123456";
        letter.editLetter({_id: data[0]._id}, d, function(err, data) {
          letter.editLetter({_id: data[0]._id}, d, function(err, data) {
            should(err).be.ok;
            done();
          });
        });

      }
      letter.createLetter({originator:"tu.a", sender: "tu.a", creationDate: new Date}, check);
    });
  });
});

describe("Letter Process", function() {
  before(function(done) {
  var orgs = [
    { name: "A", path: "A", head: "a1" },
    { name: "B", path: "A;B", head: "b1" },
    { name: "C", path: "A;B;C", head: "c" },
    { name: "BX", path: "A;B;X", head: "abx" },
    { name: "ABCD", path: "A;B;C;D", head: "abcd" },
    { name: "D", path: "D", head: "d" },
    { name: "Da", path: "D;DA", head: "da" },
    { name: "DA F", path: "D;DA;F", head: "daf" },
    { name: "E", path: "E", head: "e" },
  ];
  var users = [
    { username: "a", org: "A", roleList: [ "sender" ] },
    { username: "a1", org: "A" },
    { username: "abah", org: "A" },
    { username: "tu.a", org: "A", roleList: [ utils.simaya.administrationRole ]},    { username: "b", org: "A;B" },
    { username: "b", org: "A;B" },
    { username: "b1", org: "A;B", roleList: ["sender"] },
    { username: "b2", org: "A;B" },
    { username: "b3", org: "A;B" },
    { username: "b4", org: "A;B" },
    { username: "tu.b", org: "A;B", roleList: [ utils.simaya.administrationRole ]},
    { username: "c", org: "A;B;C" },
    { username: "abx", org: "A;B;X" },
    { username: "c1", org: "A;B;C" },
    { username: "abcd", org: "A;B;C;D" },
    { username: "d", org: "D", roleList: ["sender"] },
    { username: "d1", org: "D" },
    { username: "da", org: "D;DA", roleList: [ "sender" ] },
    { username: "daf", org: "D;DA;F" },
    { username: "daf1", org: "D;DA;F" },
    { username: "tu.d", org: "D", roleList: [ utils.simaya.administrationRole ]},
    { username: "e", org: "E" },
    { username: "tu.e", org: "E", roleList: [ utils.simaya.administrationRole ]},
  ]

    var setup = function() {
      async.series([
        function(cb) {
          clearUser(function(err, r) {
            clearLetter(function(err, r) {
              clearNotification(cb);
            });
          });
        },
        function(cb) {
          async.map(orgs, insertOrg, cb);
        },
        function(cb) {
          async.map(users, insertUser, cb);
        },
        ], function(e,v) {
          done();
        }
      );
    };

    if (utils.db.openCalled) {
      setup();
    } else {
      utils.db.open(function() {
        setup();
      });
    }
  });

  describe("Get reviewer list by user", function() {
    it ("should return correct list", function(done) {
      letter.reviewerListByLetter(null, "c1", "a", function(data) {
        data.should.have.length(4);
        var names = _.pluck(data, "username");
        names.should.eql(["c", "b1", "a1", "a"]);
        done();
      });
    });

    it ("should also return correct list", function(done) {
      letter.reviewerListByLetter(null, "b", "a", function(data) {
        data.should.have.length(3);
        var names = _.pluck(data, "username");
        names.should.eql(["b1", "a1", "a"]);
        done();
      });
    });

    it ("should also return correct list again", function(done) {
      letter.reviewerListByLetter(null, "c1", "b", function(data) {
        data.should.have.length(3);
        var names = _.pluck(data, "username");
        names.should.eql(["c", "b1", "b"]);
        done();
      });
    });

    it ("should also return correct list again", function(done) {
      letter.reviewerListByLetter(null, "c", "b", function(data) {
        data.should.have.length(2);
        var names = _.pluck(data, "username");
        names.should.eql(["b1", "b"]);
        done();
      });
    });

    it ("should also return correct list again", function(done) {
      letter.reviewerListByLetter(null, "c1", "c1", function(data) {
        data.should.have.length(1);
        var names = _.pluck(data, "username");
        names.should.eql(["c"]);
        done();
      });
    });

    it ("should also return correct list", function(done) {
      letter.reviewerListByLetter(null, "b1", "b1", function(data) {
        data.should.have.length(1);
        var names = _.pluck(data, "username");
        names.should.eql(["b1"]);
        done();
      });
    });


     it ("should fail", function(done) {
      letter.reviewerListByLetter(null, "c1", "d", function(data) {
        data.should.have.length(0);
        done();
      });
    });

     it ("should fail again", function(done) {
      letter.reviewerListByLetter(null, "a", "c", function(data) {
        data.should.have.length(0);
        done();
      });
    });
  });

  var ccId;
  var letterData = [
    {
      operation: "outgoing",
      date: new Date,
      recipients: "d",
      sender: "a",
      originator: "c",
      title: "title",
      classification: "0",
      priority: "0",
      type: "11",
      comments: "comments"
    },
    {
      operation: "outgoing",
      date: new Date,
      recipients: "d,e",
      sender: "a",
      originator: "c",
      title: "title",
      classification: "0",
      priority: "0",
      type: "11",
      comments: "comments"
    },
    {
      operation: "outgoing",
      date: new Date,
      recipients: "d,e",
      ccList: "b3,b4",
      sender: "a",
      originator: "c",
      title: "title",
      classification: "0",
      priority: "0",
      type: "11",
      comments: "comments"
    },
    {
      operation: "outgoing",
      date: new Date,
      recipients: "d",
      sender: "b1",
      originator: "c",
      title: "title",
      classification: "0",
      priority: "0",
      type: "11",
      comments: "comments"
    },
    {
      operation: "outgoing",
      date: new Date,
      recipients: "d,e",
      sender: "b1",
      originator: "c",
      title: "title",
      classification: "0",
      priority: "0",
      type: "11",
      comments: "comments"
    },
    {
      operation: "outgoing",
      date: new Date,
      recipients: "d,e",
      ccList: "b3",
      sender: "b1",
      originator: "c",
      title: "title",
      classification: "0",
      priority: "0",
      type: "11",
      comments: "comments"
    },
    {
      operation: "outgoing",
      date: new Date,
      recipients: "d",
      ccList: "",
      sender: "abah",
      originator: "c",
      title: "title",
      classification: "0",
      priority: "0",
      type: "11",
      comments: "comments"
    },
    {
      operation: "outgoing",
      date: new Date,
      recipients: "d",
      sender: "b1",
      originator: "c",
      title: "title",
      classification: "1",
      priority: "0",
      type: "11",
      comments: "comments",
      body: "body"
    },
    {
      operation: "outgoing",
      date: new Date,
      recipients: "daf1",
      sender: "b1",
      originator: "c",
      title: "direct letter",
      classification: "1",
      priority: "0",
      type: "11",
      comments: "comments",
      body: "body"
    },

  ];

  describe("Letter[outgoing]", function() {
    it ("should fail on incomplete data: sender", function(done) {
      var check = function(err, data) {
        var d = _.clone(letterData[0]);
        delete(d.sender);

        letter.editLetter({_id: data[0]._id}, d, function(err, data) {
          should(err).be.ok;
          data.should.have.property("success");
          data.should.have.property("fields");
          data.success.should.not.be.ok;
          data.fields.should.containEql("sender");
          done();
        });
      }

      letter.createLetter({originator:"abc", sender: "abc", creationDate: new Date}, check);
    });

    it ("should list no draft letter in c", function(done) {
      letter.listDraftLetter("c", {}, function(err, data) {
        data.should.have.property("total");
        data.total.should.eql(0);
        done();
      });
    });

    var id;
    it ("create outgoing letter", function(done) {
      var check = function(err, data) {
        var d = _.clone(letterData[0]);

        letter.editLetter({_id: data[0]._id}, d, function(err, data) {
          data.should.have.length(1);
          data[0].should.have.property("_id");
          id = data[0]._id;
          data[0].should.have.property("reviewers");
          data[0].should.have.property("receivingOrganizations");
          data[0].should.have.property("currentReviewer");
          data[0].reviewers.should.be.eql(["b1", "a1", "a"]);
          data[0].currentReviewer.should.be.eql("b1");
          data[0].should.have.property("status");
          data[0].status.should.be.eql(2);
          done();
        });
      }

      letter.createLetter({originator:letterData[0].originator, sender: "abc", creationDate: new Date}, check);
    });

    it ("should list notification for first reviewer B1", function(done) {
      setTimeout(function() { // put timeout because notifications are fire and forget
      notification.get("b1", function(data) {
        data.should.have.length(1);
        data[0].should.have.property("url");
        data[0].url.should.eql("/letter/check/" + id);
        data[0].should.have.property("message");
        data[0].message.should.eql("@letter-outgoing");
        data[0].should.have.property("sender");
        data[0].sender.should.eql("c");
        data[0].should.have.property("username");
        data[0].username.should.eql("b1");
        done();
      });
      }, 500);
    });


    it ("should list draft letter in c", function(done) {
      letter.listDraftLetter("c", {}, function(err, data) {
        data.should.have.property("total");
        data.total.should.eql(1);
        done();
      });
    });

    it ("should list draft letter in b1", function(done) {
      letter.listDraftLetter("b1", {}, function(err, data) {
        data.should.have.property("total");
        data.total.should.eql(1);
        done();
      });
    });

    it ("should list draft letter in a", function(done) {
      letter.listDraftLetter("a", {}, function(err, data) {
        data.should.have.property("total");
        data.total.should.eql(1);
        done();
      });
    });

    it ("should list no draft letter in tu.a", function(done) {
      letter.listDraftLetter("tu.a", {}, function(err, data) {
        data.should.have.property("total");
        data.total.should.eql(0);
        done();
      });
    });

    it ("review outgoing letter", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        data[0].should.have.property("_id");
        id = data[0]._id;
        data[0].should.have.property("reviewers");
        data[0].should.have.property("receivingOrganizations");
        data[0].should.have.property("currentReviewer");
        data[0].currentReviewer.should.be.eql("a1");
        data[0].should.have.property("log");
        data[0].log.should.have.length(2);
        data[0].should.have.property("status");
        data[0].status.should.be.eql(2);
        data[0].comments.should.be.eql("commented");

        done();
      }

      var data = {
        message: "OK",
        comments: "commented"
      };
      letter.reviewLetter(id, "b1", "approved", data, check);
    });

    it ("should return reviewer list along with their statuses", function(done) {
      letter.reviewerListByLetter(id, "c", "a", function(data) {
        data.should.have.length(3);
        data[0].should.have.property("action");
        data[0].action.should.be.eql("approved");
        data[1].should.have.property("current");
        data[1].current.should.be.eql(true);
        done();
      });
    });

    it ("reject outgoing letter", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        data[0].should.have.property("_id");
        id = data[0]._id;
        data[0].should.have.property("reviewers");
        data[0].should.have.property("receivingOrganizations");
        data[0].should.have.property("currentReviewer");
        data[0].currentReviewer.should.be.eql("b1");
        data[0].should.have.property("log");
        data[0].log.should.have.length(3);
        data[0].should.have.property("status");
        data[0].status.should.be.eql(2);
        data[0].title.should.be.eql("changed");

        done();
      }

      var data = {
        message: "Not OK",
        title: "changed"
      };
      letter.reviewLetter(id, "a1", "declined", data, check);
    });

    it ("should list notification for reviewer B1", function(done) {
      setTimeout(function() { // put timeout because notifications are fire and forget
      notification.get("b1", function(data) {
        data.should.have.length(2);
        data[1].should.have.property("url");
        data[1].url.should.eql("/letter/check/" + id);
        data[1].should.have.property("message");
        data[1].message.should.eql("@letter-review-declined");
        data[1].should.have.property("sender");
        data[1].sender.should.eql("a1");
        data[1].should.have.property("username");
        data[1].username.should.eql("b1");
        done();
      });
      }, 500);
    });
    it ("should list notification for originator C", function(done) {
      setTimeout(function() { // put timeout because notifications are fire and forget
      notification.get("c", function(data) {
        data.should.have.length(2);
        data[1].should.have.property("url");
        data[1].url.should.eql("/letter/check/" + id);
        data[1].should.have.property("message");
        data[1].message.should.eql("@letter-review-declined");
        data[1].should.have.property("sender");
        data[1].sender.should.eql("a1");
        data[1].should.have.property("username");
        data[1].username.should.eql("c");
        done();
      });
      }, 500);
    });

    it ("should return reviewer list along with their statuses after rejecting", function(done) {
      letter.reviewerListByLetter(id, "c", "a", function(data) {
        data.should.have.length(3);
        data[0].should.have.property("action");
        data[0].action.should.be.eql("approved");
        data[0].should.have.property("current");
        data[0].current.should.be.eql(true);
        data[1].should.have.property("action");
        data[1].action.should.be.eql("declined");
        done();
      });
    });

    it ("reject outgoing letter", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        data[0].should.have.property("_id");
        id = data[0]._id;
        data[0].should.have.property("reviewers");
        data[0].should.have.property("receivingOrganizations");
        data[0].should.have.property("currentReviewer");
        data[0].currentReviewer.should.be.eql("c");
        data[0].should.have.property("log");
        data[0].log.should.have.length(4);
        data[0].should.have.property("status");
        data[0].status.should.be.eql(2);
        data[0].recipients.should.be.eql(["e"]);

        done();
      }

      var data = {
        message: "Not OK",
        recipients: "e"
      };
      letter.reviewLetter(id, "b1", "declined", data, check);
    });

    it ("should return reviewer list along with their statuses after rejecting", function(done) {
      letter.reviewerListByLetter(id, "c", "a", function(data) {
        data.should.have.length(3);
        data[0].should.have.property("action");
        data[0].action.should.be.eql("declined");
        data[1].should.have.property("action");
        data[1].action.should.be.eql("declined");
        done();
      });
    });

    it ("approve outgoing letter", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        data[0].should.have.property("_id");
        id = data[0]._id;
        data[0].should.have.property("reviewers");
        data[0].should.have.property("receivingOrganizations");
        data[0].should.have.property("currentReviewer");
        data[0].currentReviewer.should.be.eql("b1");
        data[0].should.have.property("log");
        data[0].log.should.have.length(5);
        data[0].should.have.property("status");
        data[0].status.should.be.eql(2);

        done();
      }

      var data = {
        message: "OK",
        comments: "commented"
      };
      letter.reviewLetter(id, "c", "approved", data, check);
    });

    it ("should not list notification for originator C", function(done) {
      setTimeout(function() { // put timeout because notifications are fire and forget
      notification.get("c", function(data) {
        var index = _.findIndex(data, { url: "/letter/check/" + id, message: "@letter-review-approved-originator", sender: "c"});
        index.should.eql(-1);
        done();
      });
      }, 500);
    });

    it ("should list notification for reviewer B1", function(done) {
      setTimeout(function() { // put timeout because notifications are fire and forget
      notification.get("b1", function(data) {
        data.should.have.length(3);
        var index = _.findIndex(data, { url: "/letter/check/" + id, message: "@letter-review-approved-next-reviewer"});
        data[index].should.have.property("url");
        data[index].url.should.eql("/letter/check/" + id);
        data[index].should.have.property("message");
        data[index].message.should.eql("@letter-review-approved-next-reviewer");
        data[index].should.have.property("sender");
        data[index].sender.should.eql("c");
        data[index].should.have.property("username");
        data[index].username.should.eql("b1");
        done();
      });
      }, 500);
    });

    it ("should return reviewer list along with their statuses after approving", function(done) {
      letter.reviewerListByLetter(id, "c", "a", function(data) {
        data.should.have.length(3);
        data[0].should.have.property("current");
        data[0].current.should.be.eql(true);
        data[0].should.have.property("action");
        data[0].action.should.be.eql("declined");
        data[1].should.have.property("action");
        data[1].action.should.be.eql("declined");
        done();
      });
    });

    it ("approve outgoing letter", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        data[0].should.have.property("_id");
        id = data[0]._id;
        data[0].should.have.property("reviewers");
        data[0].should.have.property("receivingOrganizations");
        data[0].should.have.property("currentReviewer");
        data[0].currentReviewer.should.be.eql("a1");
        data[0].should.have.property("log");
        data[0].log.should.have.length(6);
        data[0].should.have.property("status");
        data[0].status.should.be.eql(2);

        done();
      }

      var data = {
        message: "OK",
        comments: "commented"
      };
      letter.reviewLetter(id, "b1", "approved", data, check);
    });

    it ("should return reviewer list along with their statuses after approving", function(done) {
      letter.reviewerListByLetter(id, "c", "a", function(data) {
        data.should.have.length(3);
        data[0].should.have.property("action");
        data[0].action.should.be.eql("approved");
        data[1].should.have.property("action");
        data[1].action.should.be.eql("declined");
        data[1].should.have.property("current");
        data[1].current.should.be.eql(true);
        done();
      });
    });

    it ("should list no draft letter in tu.a before it is approved", function(done) {
      letter.listDraftLetter("tu.a", {}, function(err, data) {
        data.should.have.property("total");
        data.total.should.eql(0);
        done();
      });
    });

    it ("finally approve outgoing letter by the last head", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        data[0].should.have.property("_id");
        id = data[0]._id;
        data[0].should.have.property("reviewers");
        data[0].should.have.property("receivingOrganizations");
        data[0].should.have.property("currentReviewer");
        data[0].currentReviewer.should.be.eql("a");
        data[0].should.have.property("log");
        data[0].log.should.have.length(7);
        data[0].should.have.property("status");
        data[0].status.should.be.eql(2);

        done();
      }

      var data = {
        message: "OK",
        comments: "commented"
      };
      letter.reviewLetter(id, "a1", "approved", data, check);
    });

    it ("finally approve outgoing letter by the sender", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        data[0].should.have.property("_id");
        id = data[0]._id;
        data[0].should.have.property("reviewers");
        data[0].should.have.property("receivingOrganizations");
        data[0].should.have.property("currentReviewer");
        data[0].currentReviewer.should.be.eql("a");
        data[0].should.have.property("log");
        data[0].log.should.have.length(8);
        data[0].should.have.property("status");
        data[0].status.should.be.eql(3);

        done();
      }

      var data = {
        message: "OK",
        comments: "commented"
      };
      letter.reviewLetter(id, "a", "approved", data, check);
    });

    it ("should list notification for reviewer C", function(done) {
      setTimeout(function() { // put timeout because notifications are fire and forget
      notification.get("c", function(data) {
        data.should.have.length(6);
        var index = _.findIndex(data, { url: "/letter/read/" + id, message: "@letter-review-finally-approved-originator"});
        data[index].should.have.property("url");
        data[index].url.should.eql("/letter/read/" + id);
        data[index].should.have.property("message");
        data[index].message.should.eql("@letter-review-finally-approved-originator");
        data[index].should.have.property("sender");
        data[index].sender.should.eql("a");
        data[index].should.have.property("username");
        data[index].username.should.eql("c");
        done();
      });
      }, 500);
    });

    it ("should list notification for reviewer B1", function(done) {
      setTimeout(function() { // put timeout because notifications are fire and forget
      notification.get("b1", function(data) {
        data.should.have.length(4);
        var index = _.findIndex(data, { url: "/letter/read/" + id, message: "@letter-review-finally-approved-reviewers"});
        data[index].should.have.property("url");
        data[index].url.should.eql("/letter/read/" + id);
        data[index].should.have.property("message");
        data[index].message.should.eql("@letter-review-finally-approved-reviewers");
        data[index].should.have.property("sender");
        data[index].sender.should.eql("a");
        data[index].should.have.property("username");
        data[index].username.should.eql("b1");
        done();
      });
      }, 500);
    });


    it ("should return reviewer list along with their statuses after approving", function(done) {
      letter.reviewerListByLetter(id, "c", "a1", function(data) {
        data.should.have.length(3);
        data[0].should.have.property("action");
        data[0].action.should.be.eql("approved");
        data[0].should.have.property("date");
        data[1].should.have.property("action");
        data[1].action.should.be.eql("approved");
        data[1].should.have.property("date");
        done();
      });
    });


    it ("should list draft letter in tu.a", function(done) {
      letter.listDraftLetter("tu.a", {}, function(err, data) {
        data.should.have.property("total");
        data.total.should.eql(1);
        done();
      });
    });


    var id;
    it ("create outgoing letter multiple recipients", function(done) {
      var check = function(err, data) {
        var d = _.clone(letterData[1]);

        letter.editLetter({_id: data[0]._id}, d, function(err, data) {
          data.should.have.length(1);
          data[0].should.have.property("_id");
          id = data[0]._id;
          data[0].should.have.property("reviewers");
          data[0].should.have.property("receivingOrganizations");
          data[0].should.have.property("currentReviewer");
          data[0].reviewers.should.be.eql(["b1", "a1", "a"]);
          data[0].currentReviewer.should.be.eql("b1");
          data[0].should.have.property("status");
          data[0].status.should.be.eql(2);
          var orgs = Object.keys(data[0].receivingOrganizations);
          orgs.should.have.length(2);
          orgs.should.be.eql(["D", "E"]);
          done();
        });
      }

      letter.createLetter({originator:letterData[0].originator, sender: "abc", creationDate: new Date}, check);
    });

    it ("create outgoing letter multiple recipients and ccList", function(done) {
      var check = function(err, data) {
        var d = _.clone(letterData[2]);

        letter.editLetter({_id: data[0]._id}, d, function(err, data) {
          data.should.have.length(1);
          data[0].should.have.property("_id");
          ccId = data[0]._id;
          data[0].should.have.property("reviewers");
          data[0].should.have.property("receivingOrganizations");
          data[0].should.have.property("currentReviewer");
          data[0].reviewers.should.be.eql(["b1", "a1", "a"]);
          data[0].currentReviewer.should.be.eql("b1");
          data[0].should.have.property("status");
          data[0].status.should.be.eql(2);
          var orgs = Object.keys(data[0].receivingOrganizations);
          orgs.should.have.length(3);
          orgs.should.be.eql(["D", "E", "A;B"]);
          done();
        });
      }

      letter.createLetter({originator:letterData[0].originator, sender: "abc", creationDate: new Date}, check);
    });

    it ("should not list incoming cc for b3", function(done) {
      letter.listIncomingLetter("b3", {}, function(err, data) {
        data.should.have.property("data");
        data.data.should.have.length(0);
        done();
      });
    });
  });

  describe("Letter[sending]", function() {
    var id;
    it ("create outgoing letter", function(done) {
      var check = function(err, data) {
        var d = _.clone(letterData[3]);

        letter.editLetter({_id: data[0]._id}, d, function(err, data) {
          data.should.have.length(1);
          data[0].should.have.property("_id");
          id = data[0]._id;
          data[0].should.have.property("reviewers");
          data[0].should.have.property("receivingOrganizations");
          data[0].should.have.property("currentReviewer");
          data[0].reviewers.should.be.eql(["b1"]);
          data[0].currentReviewer.should.be.eql("b1");
          data[0].should.have.property("status");
          data[0].status.should.be.eql(2);
          done();
        });
      }

      letter.createLetter({originator:letterData[0].originator, sender: "abc", creationDate: new Date}, check);
    });

    it ("save outgoing letter", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        data[0].should.have.property("_id");
        id = data[0]._id;
        data[0].should.have.property("reviewers");
        data[0].should.not.have.property("junk");
        data[0].should.have.property("receivingOrganizations");
        data[0].should.have.property("currentReviewer");
        data[0].currentReviewer.should.be.eql("b1");
        data[0].should.have.property("status");
        data[0].status.should.be.eql(2);

        done();
      }

      var data = {
        message: "OK",
        junk: "junk",
        comments: "commented"
      };
      letter.reviewLetter(id, "b1", "save", data, check);
    });

    it ("should be able to view the letter by the reviewer", function(done) {
      letter.readLetter(id, "b1", function(err, data) {
        data.should.have.property("meta");
        data.meta.should.have.property("underReview");
        data.meta.underReview.should.eql(true);
        done();
      });
    });

    it ("approve outgoing letter", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        data[0].should.have.property("_id");
        id = data[0]._id;
        data[0].should.have.property("reviewers");
        data[0].should.have.property("receivingOrganizations");
        data[0].should.have.property("currentReviewer");
        data[0].currentReviewer.should.be.eql("b1");
        data[0].should.have.property("status");
        data[0].status.should.be.eql(3);

        done();
      }

      var data = {
        message: "OK",
        comments: "commented"
      };
      letter.reviewLetter(id, "b1", "approved", data, check);
    });

    it ("should list notification for tu.b", function(done) {
      setTimeout(function() {
      notification.get("tu.b", function(data) {
        data.should.have.length(1);
        var index = _.findIndex(data, { url: "/letter/review/" + id});
        data[index].should.have.property("url");
        data[index].url.should.eql("/letter/review/" + id);
        data[index].should.have.property("message");
        data[index].message.should.eql("@letter-review-finally-approved-administration-sender");
        data[index].should.have.property("sender");
        data[index].sender.should.eql("b1");
        data[index].should.have.property("username");
        data[index].username.should.eql("tu.b");
        done();
      });
      }, 300);
    });



    it ("should list draft letter in tu.b", function(done) {
      letter.listDraftLetter("tu.b", {}, function(err, data) {
        data.should.have.property("total");
        data.total.should.eql(1);
        done();
      });
    });

    it ("send outgoing letter, but forgot to include mailId", function(done) {
      var check = function(err, data) {
        should(err).be.ok;
        done();
      }

      var data = {
        outgoingAgenda: "o123",
      };
      letter.sendLetter(id, "tu.b", data, check);
    });

    it ("tu.b adds an attachment", function(done) {
      var data = {
        _id: id
      }
      saveAttachment(data, function(record) {
        record.should.have.length(1);
        record[0].should.have.property("fileAttachments");
        record[0].fileAttachments.should.have.length(1);
        done();
      });
    });

    it ("send outgoing letter, but forgot to include outgoingAgenda", function(done) {
      var check = function(err, data) {
        should(err).be.ok;
        done();
      }

      var data = {
        mailId: "123",
      };
      letter.sendLetter(id, "tu.b", data, check);
    });


    it ("send outgoing letter, but performed by unauthorized user", function(done) {
      var check = function(err, data) {
        should(err).be.ok;
        data.should.have.property("reason");
        data.reason.should.be.eql("user is not authorized");
        done();
      }

      var data = {
        mailId: "123",
        outgoingAgenda: "o123",
      };
      letter.sendLetter(id, "b1", data, check);
    });

    it ("should list no outgoing letter in b1", function(done) {
      letter.listOutgoingLetter("b1", {}, function(err, data) {
        data.should.have.property("total");
        data.total.should.eql(0);
        done();
      });
    });

    it ("should list draft letter in b1 before sending", function(done) {
      letter.listDraftLetter("b1", {}, function(err, data) {
        data.should.have.property("total");
        data.total.should.eql(4);
        done();
      });
    });


    it ("send outgoing letter", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        data[0].should.have.property("_id");
        id = data[0]._id;
        data[0].should.have.property("fileAttachments");
        data[0].fileAttachments.should.have.length(1);
        data[0].should.have.property("reviewers");
        data[0].should.have.property("receivingOrganizations");
        data[0].should.have.property("currentReviewer");
        data[0].currentReviewer.should.be.eql("b1");
        data[0].should.have.property("status");
        data[0].status.should.be.eql(letter.Stages.SENT);
        data[0].should.have.property("outgoingAgenda");
        data[0].should.have.property("mailId");
        data[0].outgoingAgenda.should.be.eql("o123");
        data[0].mailId.should.be.eql("123");
        done();
      }

      var data = {
        outgoingAgenda: "o123",
        mailId: "123"
      };
      letter.sendLetter(id, "tu.b", data, check);
    });

    it ("should show last outgoing agenda number of A;B", function(done) {
      var check = function(err, data) {
        data.should.eql("o123");
        done();
      }

      letter.lastAgenda("A;B", 1, check);
    });

    it ("should show last outgoing letter number of A;B", function(done) {
      var check = function(err, data) {
        data.should.eql("123");
        done();
      }

      letter.lastAgenda("A;B", 2, check);
    });

    it ("should list notification for sender", function(done) {
      notification.get("b1", function(data) {
        data.should.have.length(8);
        var index = _.findIndex(data, { url: "/letter/read/" + id});
        data[index].should.have.property("url");
        data[index].url.should.eql("/letter/read/" + id);
        data[index].should.have.property("message");
        data[index].message.should.eql("@letter-sent-sender");
        data[index].should.have.property("sender");
        data[index].sender.should.eql("tu.b");
        data[index].should.have.property("username");
        data[index].username.should.eql("b1");
        done();
      });
    });

    it ("should list notification for recipient", function(done) {
      notification.get("tu.d", function(data) {
        data.should.have.length(1);
        data[0].should.have.property("url");
        data[0].url.should.eql("/letter/check/" + id);
        data[0].should.have.property("message");
        data[0].message.should.eql("@letter-sent-recipient");
        data[0].should.have.property("sender");
        data[0].sender.should.eql("tu.b");
        data[0].should.have.property("username");
        data[0].username.should.eql("tu.d");
        done();
      });
    });



    it ("should list no draft letter in tu.b after sending", function(done) {
      letter.listDraftLetter("tu.b", {}, function(err, data) {
        data.should.have.property("total");
        data.total.should.eql(0);
        done();
      });
    });

    it ("should list less draft letter in b1 after sending", function(done) {
      letter.listDraftLetter("b1", {}, function(err, data) {
        data.should.have.property("total");
        data.total.should.eql(3);
        done();
      });
    });

    it ("should list outgoing letter in b1", function(done) {
      letter.listOutgoingLetter("b1", {}, function(err, data) {
        data.should.have.property("total");
        data.total.should.eql(1);
        done();
      });
    });

    it ("should list one outgoing letter in tu.b", function(done) {
      letter.listOutgoingLetter("tu.b", {}, function(err, data) {
        data.should.have.property("total");
        data.total.should.eql(1);
        done();
      });
    });



    it ("approve outgoing letter multiple recipients", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        data[0].should.have.property("_id");
        data[0].should.have.property("reviewers");
        data[0].should.have.property("receivingOrganizations");
        data[0].should.have.property("currentReviewer");
        data[0].currentReviewer.should.be.eql("a1");
        data[0].should.have.property("status");
        data[0].status.should.be.eql(letter.Stages.REVIEWING);

        done();
      }

      var data = {
        message: "OK",
        comments: "commented"
      };
      letter.reviewLetter(ccId, "b1", "approved", data, check);
    });

    it ("approve outgoing letter multiple recipients step 2", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        data[0].should.have.property("_id");
        data[0].should.have.property("reviewers");
        data[0].should.have.property("receivingOrganizations");
        data[0].should.have.property("currentReviewer");
        data[0].currentReviewer.should.be.eql("a");
        data[0].should.have.property("status");
        data[0].status.should.be.eql(letter.Stages.REVIEWING);

        done();
      }

      var data = {
        message: "OK",
        comments: "commented"
      };
      letter.reviewLetter(ccId, "a1", "approved", data, check);
    });

    it ("approve outgoing letter multiple recipients step 2 by sender", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        data[0].should.have.property("_id");
        data[0].should.have.property("reviewers");
        data[0].should.have.property("receivingOrganizations");
        data[0].should.have.property("currentReviewer");
        data[0].currentReviewer.should.be.eql("a");
        data[0].should.have.property("status");
        data[0].status.should.be.eql(letter.Stages.APPROVED);

        done();
      }

      var data = {
        message: "OK",
        comments: "commented"
      };
      letter.reviewLetter(ccId, "a", "approved", data, check);
    });


    it ("should list no incoming letter in tu.b", function(done) {
      letter.listIncomingLetter("tu.b", {}, function(err, data) {
        data.should.have.property("data");
        data.data.should.have.length(0);
        done();
      });
    });

    it ("tu.a adds an attachment", function(done) {
      var data = {
        _id: ccId
      }
      saveAttachment(data, function(record) {
        record.should.have.length(1);
        record[0].should.have.property("fileAttachments");
        record[0].fileAttachments.should.have.length(1);
        done();
      });
    });

    it ("send outgoing letter multiple recipients and cc", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        data[0].should.have.property("_id");
        data[0].should.have.property("reviewers");
        data[0].should.have.property("fileAttachments");
        data[0].fileAttachments.should.have.length(0);
        data[0].should.have.property("receivingOrganizations");
        data[0].should.have.property("currentReviewer");
        data[0].currentReviewer.should.be.eql("a");
        data[0].should.have.property("status");
        data[0].should.have.property("outgoingAgenda");
        data[0].should.have.property("mailId");
        data[0].outgoingAgenda.should.be.eql("o123");
        data[0].mailId.should.be.eql("123");
        data[0].status.should.be.eql(letter.Stages.SENT);
        done();
      }

      var data = {
        outgoingAgenda: "o123",
        mailId: "123",
        ignoreFileAttachments: "true"
      };
      letter.sendLetter(ccId, "tu.a", data, check);
    });

    it ("should list notification for the last head", function(done) {
      notification.get("a", function(data) {
        data.should.have.length(3);
        var index = _.findIndex(data, { url: "/letter/read/" + ccId});
        data[index].should.have.property("url");
        data[index].url.should.eql("/letter/read/" + ccId);
        data[index].should.have.property("message");
        data[index].message.should.eql("@letter-sent-sender");
        data[index].should.have.property("sender");
        data[index].sender.should.eql("tu.a");
        data[index].should.have.property("username");
        data[index].username.should.eql("a");
        done();
      });
    });

    it ("should list notification for recipient D", function(done) {
      setTimeout(function() {
      notification.get("tu.d", function(data) {
        data.should.have.length(2);
        data[1].should.have.property("url");
        data[1].url.should.eql("/letter/check/" + ccId);
        data[1].should.have.property("message");
        data[1].message.should.eql("@letter-sent-recipient");
        data[1].should.have.property("sender");
        data[1].sender.should.eql("tu.a");
        data[1].should.have.property("username");
        data[1].username.should.eql("tu.d");
        done();
      });
      },500);
    });

    it ("should list notification for recipient E", function(done) {
      setTimeout(function() {
      notification.get("tu.e", function(data) {
        data.should.have.length(1);
        data[0].should.have.property("url");
        data[0].url.should.eql("/letter/check/" + ccId);
        data[0].should.have.property("message");
        data[0].message.should.eql("@letter-sent-recipient");
        data[0].should.have.property("sender");
        data[0].sender.should.eql("tu.a");
        data[0].should.have.property("username");
        data[0].username.should.eql("tu.e");
        done();
      });
      },500);
    });

    it ("should list notification for recipient A;B", function(done) {
      setTimeout(function() {
      notification.get("tu.b", function(data) {
        data.should.have.length(2);
        data[1].should.have.property("url");
        data[1].url.should.eql("/letter/check/" + ccId);
        data[1].should.have.property("message");
        data[1].message.should.eql("@letter-sent-recipient");
        data[1].should.have.property("sender");
        data[1].sender.should.eql("tu.a");
        data[1].should.have.property("username");
        data[1].username.should.eql("tu.b");
        done();
      });
      },500);
    });


  });

  describe("Letter[receiving]", function() {
    var id;
    it ("create outgoing letter", function(done) {
      var check = function(err, data) {
        var d = _.clone(letterData[3]);

        letter.editLetter({_id: data[0]._id}, d, function(err, data) {
          data.should.have.length(1);
          data[0].should.have.property("_id");
          id = data[0]._id;
          data[0].should.have.property("reviewers");
          data[0].should.have.property("receivingOrganizations");
          data[0].should.have.property("currentReviewer");
          data[0].reviewers.should.be.eql(["b1"]);
          data[0].currentReviewer.should.be.eql("b1");
          data[0].should.have.property("status");
          data[0].status.should.be.eql(2);
          done();
        });
      }

      letter.createLetter({originator:letterData[0].originator, sender: "abc", creationDate: new Date}, check);
    });

    it ("approve outgoing letter", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        data[0].should.have.property("_id");
        id = data[0]._id;
        data[0].should.have.property("reviewers");
        data[0].should.have.property("receivingOrganizations");
        data[0].should.have.property("currentReviewer");
        data[0].currentReviewer.should.be.eql("b1");
        data[0].should.have.property("status");
        data[0].status.should.be.eql(3);

        done();
      }

      var data = {
        message: "OK",
        comments: "commented"
      };
      letter.reviewLetter(id, "b1", "approved", data, check);
    });

    it ("send outgoing letter", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        data[0].should.have.property("_id");
        id = data[0]._id;
        data[0].should.have.property("reviewers");
        data[0].should.have.property("receivingOrganizations");
        data[0].should.have.property("currentReviewer");
        data[0].currentReviewer.should.be.eql("b1");
        data[0].should.have.property("status");
        data[0].status.should.be.eql(letter.Stages.SENT);
        data[0].should.have.property("outgoingAgenda");
        data[0].should.have.property("mailId");
        data[0].outgoingAgenda.should.be.eql("o123");
        data[0].mailId.should.be.eql("123");
        done();
      }

      var data = {
        outgoingAgenda: "o123",
        mailId: "123"
      };
      letter.sendLetter(id, "tu.b", data, check);
    });

    it ("receive incoming letter from unauthorized user from other org", function(done) {
      var check = function(err, data) {
        should(err).be.ok;
        data.should.have.property("reason");
        data.reason.should.be.eql("receiving organization mismatch");
        done();
      }

      var data = {
        incomingAgenda: "o123",
      };
      letter.receiveLetter(id, "tu.e", data, check);
    });


    it ("receive incoming letter from unauthorized user from inside org", function(done) {
      var check = function(err, data) {
        should(err).be.ok;
        data.should.have.property("reason");
        data.reason.should.be.eql("user is not authorized");
        done();
      }

      var data = {
        incomingAgenda: "o123",
      };
      letter.receiveLetter(id, "d", data, check);
    });

    it ("receive incoming letter but forgot to specify incoming agenda", function(done) {
      var check = function(err, data) {
        should(err).be.ok;
        data.should.have.property("fields");
        data.fields.should.be.eql(["incomingAgenda"]);
        done();
      }

      var data = {
      };
      letter.receiveLetter(id, "tu.d", data, check);
    });

    it ("should be able to open letter from tu.d prior before accepting", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        done();
      }
      letter.openLetter(id, "tu.d", {}, check);
    });

    it ("should not be able to open letter by d prior before accepting", function(done) {
      var check = function(err, data) {
        data.should.have.length(0);
        done();
      }
      letter.openLetter(id, "d", {}, check);
    });


    it ("should receive incoming letter successfully", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        data[0].should.have.property("_id");
        id = data[0]._id;
        data[0].should.have.property("status");
        data[0].status.should.be.eql(letter.Stages.SENT);
        data[0].should.have.property("receivingOrganizations");
        var r = data[0].receivingOrganizations;
        r.should.have.property("D");
        r.D.should.have.property("agenda");
        r.D.should.have.property("status");
        r.D.agenda.should.be.eql("o123");
        r.D.status.should.be.eql(letter.Stages.RECEIVED);
        done();
      }

      var data = {
        incomingAgenda: "o123",
      };
      letter.receiveLetter(id, "tu.d", data, check);
    });

    it ("should show last incoming agenda number of D", function(done) {
      var check = function(err, data) {
        data.should.eql("o123");
        done();
      }

      letter.lastAgenda("D", 0, check);
    });


    it ("should list incoming letter successfully in tu.b", function(done) {
      letter.listIncomingLetter("tu.b", {}, function(err, data) {
        data.should.have.property("data");
        data.data.should.have.length(1);
        done();
      });
    });

    it ("should list no cc letter in b3", function(done) {
      letter.listCcLetter("b3", {}, function(err, data) {
        data.should.have.length(0);
        done();
      });
    });

    it ("should receive incoming letter multiple recipients and cc successfully", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        data[0].should.have.property("_id");
        data[0].should.have.property("status");
        data[0].status.should.be.eql(letter.Stages.SENT);
        data[0].should.have.property("receivingOrganizations");
        var r = data[0].receivingOrganizations;
        r.should.have.property("A;B");
        r["A;B"].should.have.property("agenda");
        r["A;B"].should.have.property("status");
        r["A;B"].agenda.should.be.eql("o123");
        r["A;B"].status.should.be.eql(letter.Stages.RECEIVED);
        done();
      }

      var data = {
        incomingAgenda: "o123",
      };
      letter.receiveLetter(ccId, "tu.b", data, check);
    });

    it ("should show last incoming agenda number of A;B", function(done) {
      var check = function(err, data) {
        data.should.eql("o123");
        done();
      }

      letter.lastAgenda("A;B", 0, check);
    });


    it ("should list notification for sender B3 in cc list", function(done) {
      setTimeout(function() { // put timeout because notifications are fire and forget
      notification.get("b3", function(data) {
        data.should.have.length(1);
        data[0].should.have.property("url");
        data[0].url.should.eql("/letter/read/" + ccId);
        data[0].should.have.property("message");
        data[0].message.should.eql("@letter-received-recipient");
        data[0].should.have.property("sender");
        data[0].sender.should.eql("tu.b");
        data[0].should.have.property("username");
        data[0].username.should.eql("b3");
        done();
      });
      }, 500);
    });

    it ("should list notification for sender B4 in cc list", function(done) {
      setTimeout(function() { // put timeout because notifications are fire and forget
      notification.get("b4", function(data) {
        data.should.have.length(1);
        data[0].should.have.property("url");
        data[0].url.should.eql("/letter/read/" + ccId);
        data[0].should.have.property("message");
        data[0].message.should.eql("@letter-received-recipient");
        data[0].should.have.property("sender");
        data[0].sender.should.eql("tu.b");
        data[0].should.have.property("username");
        data[0].username.should.eql("b4");
        done();
      });
      }, 500);
    });

    it ("should receive for recipient D, incoming letter multiple recipients and cc successfully", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        data[0].should.have.property("_id");
        data[0].should.have.property("status");
        data[0].status.should.be.eql(letter.Stages.SENT);
        data[0].should.have.property("receivingOrganizations");
        var r = data[0].receivingOrganizations;
        r.should.have.property("D");
        r["D"].should.have.property("agenda");
        r["D"].should.have.property("status");
        r["D"].agenda.should.be.eql("do123");
        r["D"].status.should.be.eql(letter.Stages.RECEIVED);
        done();
      }

      var data = {
        incomingAgenda: "do123",
      };
      letter.receiveLetter(ccId, "tu.d", data, check);
    });

    it ("should list notification for sender D in recipient list", function(done) {
      setTimeout(function() { // put timeout because notifications are fire and forget
      notification.get("d", function(data) {
        data.should.have.length(2);
        var index = _.findIndex(data, { url: "/letter/read/" + id, message: "@letter-received-recipient", "username": "d" });
        data[index].should.have.property("url");
        data[index].url.should.eql("/letter/read/" + id);
        data[index].should.have.property("message");
        data[index].message.should.eql("@letter-received-recipient");
        data[index].should.have.property("sender");
        data[index].sender.should.eql("tu.d");
        data[index].should.have.property("username");
        data[index].username.should.eql("d");
        done();
      });
      }, 500);
    });

    it ("should not list notification for sender E in recipient list", function(done) {
      setTimeout(function() { // put timeout because notifications are fire and forget
      notification.get("e", function(data) {
        data.should.have.length(0);
        done();
      });
      }, 500);
    });


    it ("should list cc letter in b3", function(done) {
      letter.listCcLetter("b3", {}, function(err, data) {
        data.should.have.length(1);
        done();
      });
    });

    it ("should list no cc letter in b1", function(done) {
      letter.listCcLetter("b1", {}, function(err, data) {
        data.should.have.length(0);
        done();
      });
    });

  });

  describe("Letter[rejecting]", function() {
    var id;
    it ("create outgoing letter", function(done) {
      var check = function(err, data) {
        var d = _.clone(letterData[3]);

        letter.editLetter({_id: data[0]._id}, d, function(err, data) {
          data.should.have.length(1);
          data[0].should.have.property("_id");
          id = data[0]._id;
          data[0].should.have.property("reviewers");
          data[0].should.have.property("receivingOrganizations");
          data[0].should.have.property("currentReviewer");
          data[0].reviewers.should.be.eql(["b1"]);
          data[0].currentReviewer.should.be.eql("b1");
          data[0].should.have.property("status");
          data[0].status.should.be.eql(2);
          done();
        });
      }

      letter.createLetter({originator:letterData[0].originator, sender: "abc", creationDate: new Date}, check);
    });

    it ("approve outgoing letter", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        data[0].should.have.property("_id");
        id = data[0]._id;
        data[0].should.have.property("reviewers");
        data[0].should.have.property("receivingOrganizations");
        data[0].should.have.property("currentReviewer");
        data[0].currentReviewer.should.be.eql("b1");
        data[0].should.have.property("status");
        data[0].status.should.be.eql(3);

        done();
      }

      var data = {
        message: "OK",
        comments: "commented"
      };
      letter.reviewLetter(id, "b1", "approved", data, check);
    });

    it ("send outgoing letter", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        data[0].should.have.property("_id");
        id = data[0]._id;
        data[0].should.have.property("reviewers");
        data[0].should.have.property("receivingOrganizations");
        data[0].should.have.property("currentReviewer");
        data[0].currentReviewer.should.be.eql("b1");
        data[0].should.have.property("status");
        data[0].status.should.be.eql(letter.Stages.SENT);
        data[0].should.have.property("outgoingAgenda");
        data[0].should.have.property("mailId");
        data[0].outgoingAgenda.should.be.eql("o123");
        data[0].mailId.should.be.eql("123");
        done();
      }

      var data = {
        outgoingAgenda: "o123",
        mailId: "123"
      };
      letter.sendLetter(id, "tu.b", data, check);
    });

    it ("reject incoming letter from unauthorized user from other org", function(done) {
      var check = function(err, data) {
        should(err).be.ok;
        data.should.have.property("reason");
        data.reason.should.be.eql("receiving organization mismatch");
        done();
      }

      var data = {
        reason: "OK"
      };
      letter.rejectLetter(id, "tu.e", data, check);
    });

    it ("reject incoming letter from unauthorized user from inside org", function(done) {
      var check = function(err, data) {
        should(err).be.ok;
        data.should.have.property("reason");
        data.reason.should.be.eql("user is not authorized");
        done();
      }

      var data = {
        reason: "OK"
      };
      letter.rejectLetter(id, "d", data, check);
    });

    it ("reject incoming letter but forgot to specify reason", function(done) {
      var check = function(err, data) {
        should(err).be.ok;
        data.should.have.property("fields");
        data.fields.should.be.eql(["reason"]);
        done();
      }

      var data = {
      };
      letter.rejectLetter(id, "tu.d", data, check);
    });
    it ("should reject incoming letter successfully", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        data[0].should.have.property("_id");
        id = data[0]._id;
        data[0].should.have.property("status");
        data[0].status.should.be.eql(letter.Stages.SENT);
        data[0].should.have.property("receivingOrganizations");
        var r = data[0].receivingOrganizations;
        r.should.have.property("D");
        r.D.should.not.have.property("agenda");
        r.D.should.have.property("status");
        r.D.status.should.be.eql(letter.Stages.REJECTED);
        r.D.should.have.property("rejectedBy");
        r.D.should.have.property("rejectionReason");
        r.D.rejectedBy.should.be.eql("tu.d");
        r.D.rejectionReason.should.be.eql("OK");
        done();
      }

      var data = {
        reason: "OK",
      };
      letter.rejectLetter(id, "tu.d", data, check);
    });

    it ("should list notification for recipient A;B", function(done) {
      setTimeout(function() { // put timeout because notifications are fire and forget
      notification.get("tu.b", function(data) {
        data.should.have.length(5);
        var index = _.findIndex(data, { url: "/letter/read/" + id, message: "@letter-rejected-administration-sender" });
        data[index].should.have.property("url");
        data[index].url.should.eql("/letter/read/" + id);
        data[index].should.have.property("message");
        data[index].message.should.eql("@letter-rejected-administration-sender");
        data[index].should.have.property("sender");
        data[index].sender.should.eql("tu.d");
        data[index].should.have.property("username");
        data[index].username.should.eql("tu.b");
        done();
      });
      }, 500);
    });

    it ("should list notification for originator C", function(done) {
      setTimeout(function() { // put timeout because notifications are fire and forget
      notification.get("c", function(data) {
        data.should.have.length(13);
        var index = _.findIndex(data, { url: "/letter/read/" + id, message: "@letter-rejected-originator" });
        data[index].should.have.property("url");
        data[index].url.should.eql("/letter/read/" + id);
        data[index].should.have.property("message");
        data[index].message.should.eql("@letter-rejected-originator");
        data[index].should.have.property("sender");
        data[index].sender.should.eql("tu.d");
        data[index].should.have.property("username");
        data[index].username.should.eql("c");
        done();
      });
      }, 500);
    });

    it ("should list notification for sender B1", function(done) {
      setTimeout(function() { // put timeout because notifications are fire and forget
      notification.get("b1", function(data) {
        data.should.have.length(15);
        var index = _.findIndex(data, { url: "/letter/read/" + id, message: "@letter-rejected-sender" });
        data[index].should.have.property("url");
        data[index].url.should.eql("/letter/read/" + id);
        data[index].should.have.property("message");
        data[index].message.should.eql("@letter-rejected-sender");
        data[index].should.have.property("sender");
        data[index].sender.should.eql("tu.d");
        data[index].should.have.property("username");
        data[index].username.should.eql("b1");
        done();
      });
      }, 500);
    });



  });

  describe("Letter[read]", function() {
    var id;
    it ("create outgoing letter", function(done) {
      var check = function(err, data) {
        var d = _.clone(letterData[3]);

        letter.editLetter({_id: data[0]._id}, d, function(err, data) {
          id = data[0]._id;
          done();
        });
      }

      letter.createLetter({originator:letterData[0].originator, sender: "abc", creationDate: new Date}, check);
    });

    it ("should not be able to open letter from tu.b prior approval", function(done) {
      var check = function(err, data) {
        data.should.have.length(0);
        done();
      }
      letter.openLetter(id, "tu.b", {}, check);
    });


    it ("approve outgoing letter", function(done) {
      var check = function(err, data) {
        done();
      }

      var data = {
        message: "OK",
        comments: "commented"
      };
      letter.reviewLetter(id, "b1", "approved", data, check);
    });

    it ("send outgoing letter", function(done) {
      var check = function(err, data) {
        done();
      }

      var data = {
        outgoingAgenda: "o123",
        mailId: "123"
      };
      letter.sendLetter(id, "tu.b", data, check);
    });

    it ("read incoming not yet accepted letter", function(done) {
      var check = function(err, data) {
        should(err).be.ok;
        done();
      }

      letter.readLetter(id, "d", check);
    });

    it ("should not be able to open a not yet accepted letter", function(done) {
      var check = function(err, data) {
        data.should.have.length(0);
        done();
      }

      letter.openLetter(id, "d", {}, check);
    });



    it ("should list incoming letter successfully in tu.d", function(done) {
      letter.listIncomingLetter("tu.d", {}, function(err, data) {
        data.should.have.property("data");
        data.data.should.have.length(2);
        done();
      });
    });

    it ("should not be able to open letter by d prior receiving", function(done) {
      var check = function(err, data) {
        data.should.have.length(0);
        done();
      }
      letter.openLetter(id, "d", {}, check);
    });

    it ("should not be able to open letter by d's peer prior receiving", function(done) {
      var check = function(err, data) {
        data.should.have.length(0);
        done();
      }
      letter.openLetter(id, "d1", {}, check);
    });

    it ("should not be able to open letter by another d's peer prior receiving", function(done) {
      var check = function(err, data) {
        data.should.have.length(0);
        done();
      }
      letter.openLetter(id, "da", {}, check);
    });

    it ("should receive incoming letter successfully", function(done) {
      var check = function(err, data) {
        done();
      }

      var data = {
        incomingAgenda: "o123",
      };
      letter.receiveLetter(id, "tu.d", data, check);
    });

    it ("should list incoming letter successfully in d", function(done) {
      letter.listIncomingLetter("d", {}, function(err, data) {
        data.should.have.property("data");
        data.data.should.have.length(3);
        done();
      });
    });

    it ("should list incoming letter successfully in d", function(done) {
      letter.listIncomingLetter("d", {}, function(err, data) {
        data.should.have.property("data");
        data.data.should.have.length(3);
        done();
      });
    });

    it ("should list no incoming letter in d1", function(done) {
      letter.listIncomingLetter("d1", {}, function(err, data) {
        data.should.have.property("data");
        data.data.should.have.length(0);
        done();
      });
    });

    it ("should list incoming agenda in d1", function(done) {
      letter.listIncomingLetter("d1", {agenda : true}, function(err, data) {
        data.should.have.property("data");
        data.data.should.have.length(3);
        done();
      });
    });

    it ("read incoming letter from unauthorized user from other org", function(done) {
      var check = function(err, data) {
        should(err).be.ok;
        done();
      }

      letter.readLetter(id, "tu.e", check);
    });

    it ("read incoming letter from inside org", function(done) {
      var check = function(err, data) {
        data.should.have.property("data");
        data.data.should.have.property("readStates");
        var r = data.data.readStates;
        r.should.have.property("others");
        r.others.should.have.property("d1");

        done();
      }

      letter.readLetter(id, "d1", check);
    });

    it ("read incoming letter from inside sub-org  ", function(done) {
      var check = function(err, data) {
        should(err).not.be.ok;
        done();
      }

      letter.readLetter(id, "da", check);
    });

    it ("should read incoming letter successfully", function(done) {
      var check = function(err, data) {
        data.should.have.property("data");
        data.data.should.have.property("_id");
        data.data.should.have.property("status");
        data.data.status.should.be.eql(letter.Stages.SENT);
        data.data.should.have.property("readStates");
        var r = data.data.readStates;
        r.should.have.property("recipients");
        r.recipients.should.have.property("d");
        r.recipients.d.should.be.type("object");
        var d = new Date(r.recipients.d);
        d.valueOf().should.not.be.NaN;

        data.data.should.have.property("receivingOrganizations");
        var r = data.data.receivingOrganizations;
        r.should.have.property("D");
        r.D.should.have.property("agenda");
        r.D.should.have.property("status");
        r.D.status.should.be.eql(letter.Stages.RECEIVED);
        done();
      }

      letter.readLetter(id, "d", check);
    });

    it ("should be able to open letter by d", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        data[0].should.have.property("_id");
        done();
      }
      letter.openLetter(id, "d", {}, check);
    });

    it ("should be able to open letter by d's peer within org", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        data[0].should.have.property("_id");
        done();
      }
      letter.openLetter(id, "d1", {}, check);
    });

    it ("should be able to open letter by d's peer outside org", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        done();
      }
      letter.openLetter(id, "da", {}, check);
    });

    it ("should be able to open letter from c", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        data[0].should.have.property("_id");
        done();
      }
      letter.openLetter(id, "c", {}, check);
    });

    it ("should be able to open letter from b1", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        data[0].should.have.property("_id");
        done();
      }
      letter.openLetter(id, "b1", {}, check);
    });

    it ("should be able to open letter from tu.b", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        data[0].should.have.property("_id");
        done();
      }
      letter.openLetter(id, "tu.b", {}, check);
    });



  });

  describe("Letter[approval by non-head sender]", function() {
    var id;
    it ("create outgoing letter", function(done) {
      var check = function(err, data) {
        var d = _.clone(letterData[6]);

        letter.editLetter({_id: data[0]._id}, d, function(err, data) {
          id = data[0]._id;
          done();
        });
      }

      letter.createLetter({originator:letterData[0].originator, sender: "abc", creationDate: new Date}, check);
    });

    it ("should not be approve by a prior b1'a approval", function(done) {
      var check = function(err, data) {
        should(err).be.ok;
        done();
      }

      var data = {
        message: "OK",
        comments: "commented"
      };
      letter.reviewLetter(id, "a", "approved", data, check);
    });

    it ("should approve outgoing letter by b1", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        data[0].should.have.property("status");
        data[0].status.should.eql(letter.Stages.REVIEWING);
        done();
      }

      var data = {
        message: "OK",
        comments: "commented"
      };
      letter.reviewLetter(id, "b1", "approved", data, check);
    });

    it ("should approve outgoing letter by a1", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        data[0].should.have.property("status");
        data[0].status.should.eql(letter.Stages.REVIEWING);
        done();
      }

      var data = {
        message: "OK",
        comments: "commented"
      };
      letter.reviewLetter(id, "a1", "approved", data, check);
    });

    it ("should approve outgoing letter by a", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        data[0].should.have.property("status");
        data[0].status.should.eql(letter.Stages.REVIEWING);
        done();
      }

      var data = {
        message: "OK",
        comments: "commented"
      };
      letter.reviewLetter(id, "a", "approved", data, check);
    });

    it ("should not be able to send outgoing letter prior abah's approval", function(done) {
      var check = function(err, data) {
        should(err).be.ok;
        done();
      }

      var data = {
        outgoingAgenda: "o123",
        mailId: "123"
      };
      letter.sendLetter(id, "tu.b", data, check);
    });


    it ("should approve outgoing letter by abah", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        data[0].should.have.property("status");
        data[0].status.should.eql(letter.Stages.APPROVED);
        done();
      }

      var data = {
        message: "OK",
        comments: "commented"
      };
      letter.reviewLetter(id, "abah", "approved", data, check);
    });

    it ("should list notification for tu.a", function(done) {
      setTimeout(function() {
      notification.get("tu.a", function(data) {
        var index = _.findIndex(data, { url: "/letter/review/" + id});
        data[index].should.have.property("url");
        data[index].url.should.eql("/letter/review/" + id);
        data[index].should.have.property("message");
        data[index].message.should.eql("@letter-review-finally-approved-administration-sender");
        data[index].should.have.property("sender");
        data[index].sender.should.eql("abah");
        data[index].should.have.property("username");
        data[index].username.should.eql("tu.a");
        done();
      });
      }, 500);
    });

    it ("finally send outgoing letter", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        done();
      }

      var data = {
        outgoingAgenda: "o123",
        mailId: "123"
      };
      letter.sendLetter(id, "tu.b", data, check);
    });


  });

  describe("Letter[secret]", function() {
    var id;
    it ("create outgoing letter", function(done) {
      var check = function(err, data) {
        var d = _.clone(letterData[7]);

        letter.editLetter({_id: data[0]._id}, d, function(err, data) {
          id = data[0]._id;
          done();
        });
      }

      letter.createLetter({originator:letterData[0].originator, sender: "abc", creationDate: new Date}, check);
    });

    it ("approve outgoing letter", function(done) {
      var check = function(err, data) {
        done();
      }

      var data = {
        message: "OK",
        comments: "commented"
      };
      letter.reviewLetter(id, "b1", "approved", data, check);
    });

    it ("should not be able to view the letter contents by the tu.b", function(done) {
      letter.readLetter(id, "tu.b", function(err, data) {
        data.should.have.property("data");
        data.data.should.have.property("body");
        data.data.body.should.not.be.ok;
        done();
      });
    });

    it ("send outgoing letter", function(done) {
      var check = function(err, data) {
        done();
      }

      var data = {
        outgoingAgenda: "o123",
        mailId: "123"
      };
      letter.sendLetter(id, "tu.b", data, check);
    });


    it ("should receive incoming letter successfully", function(done) {
      var check = function(err, data) {
        done();
      }

      var data = {
        incomingAgenda: "o123",
      };
      letter.receiveLetter(id, "tu.d", data, check);
    });


    it ("should be able to view the letter by the sender", function(done) {
      letter.readLetter(id, "b1", function(err, data) {
        data.should.have.property("data");
        data.data.should.have.property("body");
        data.data.body.should.eql("body");
        done();
      });
    });

    it ("should be able to view the letter by the recipient", function(done) {
      letter.readLetter(id, "d", function(err, data) {
        data.should.have.property("data");
        data.data.should.have.property("body");
        data.data.body.should.eql("body");
        done();
      });
    });

    it ("should not be able to view the letter by the recipient organization member", function(done) {
      letter.readLetter(id, "d1", function(err, data) {
        data.should.have.property("data");
        data.data.should.have.property("body");
        data.data.body.should.not.be.ok
        done();
      });
    });
  });

  var ccId;
  var letterDataSingle =
    {
      operation: "outgoing",
      date: new Date,
      recipients: "d",
      sender: "a",
      originator: "c",
      title: "title",
      classification: "0",
      priority: "0",
      type: "11",
      comments: "comments"
    };

  var letterDataNoApprovals =
    {
      operation: "outgoing",
      date: new Date,
      recipients: "d",
      sender: "b1",
      originator: "b1",
      title: "title",
      classification: "0",
      priority: "0",
      type: "11",
      comments: "comments"
    };


  describe("Letter[head sending letter with no approvals]", function() {
    var id;
    it ("should create outgoing letter", function(done) {
      var check = function(err, data) {
        var d = _.clone(letterDataNoApprovals);

        letter.editLetter({_id: data[0]._id}, d, function(err, data) {
          data.should.have.length(1);
          data[0].should.have.property("_id");
          id = data[0]._id;
          data[0].should.have.property("reviewers");
          data[0].should.have.property("receivingOrganizations");
          data[0].should.have.property("currentReviewer");
          data[0].reviewers.should.be.eql(["b1"]);
          data[0].currentReviewer.should.be.eql("b1");
          data[0].should.have.property("status");
          data[0].status.should.be.eql(3);
          done();
        });
      }

      letter.createLetter({originator:letterDataNoApprovals.originator, sender: "b1", creationDate: new Date}, check);
    });

    it ("send outgoing letter", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        data[0].should.have.property("_id");
        id = data[0]._id;
        data[0].should.have.property("mailId");
        data[0].outgoingAgenda.should.be.eql("o123");
        done();
      }

      var data = {
        outgoingAgenda: "o123",
        mailId: "123"
      };
      letter.sendLetter(id, "tu.b", data, check);
    });
  });

  describe("Letter with additional reviewers", function() {
    var id;
    it ("create outgoing letter", function(done) {
      var check = function(err, data) {
        var d = _.clone(letterDataSingle);
        d.additionalReviewers = ["abx", "abcd"];

        letter.editLetter({_id: data[0]._id}, d, function(err, data) {
          data.should.have.length(1);
          data[0].should.have.property("_id");
          id = data[0]._id;
          data[0].should.have.property("reviewers");
          data[0].should.have.property("receivingOrganizations");
          data[0].should.have.property("currentReviewer");
          data[0].reviewers.should.be.eql(["b1", "a1", "abx", "abcd", "a"]);
          data[0].currentReviewer.should.be.eql("b1");
          data[0].should.have.property("status");
          data[0].status.should.be.eql(2);
          done();
        });
      }

      letter.createLetter({originator:letterData[0].originator, sender: "abc", creationDate: new Date}, check);
    });


    it ("review outgoing letter", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        data[0].should.have.property("_id");
        id = data[0]._id;
        data[0].should.have.property("reviewers");
        data[0].should.have.property("receivingOrganizations");
        data[0].should.have.property("currentReviewer");
        data[0].currentReviewer.should.be.eql("a1");
        data[0].should.have.property("log");
        data[0].log.should.have.length(2);
        data[0].should.have.property("status");
        data[0].status.should.be.eql(2);
        data[0].comments.should.be.eql("commented");

        done();
      }

      var data = {
        message: "OK",
        comments: "commented"
      };
      letter.reviewLetter(id, "b1", "approved", data, check);
    });

    it ("approve outgoing letter", function(done) {
      var check = function(err, data) {
        should(err).not.be.ok;
        data.should.have.length(1);
        data[0].should.have.property("_id");
        id = data[0]._id;
        data[0].should.have.property("reviewers");
        data[0].should.have.property("receivingOrganizations");
        data[0].should.have.property("currentReviewer");
        data[0].currentReviewer.should.be.eql("abx");
        data[0].should.have.property("log");
        data[0].log.should.have.length(3);
        data[0].should.have.property("status");
        data[0].status.should.be.eql(2);

        done();
      }

      var data = {
        message: "OK",
        comments: "commented"
      };
      letter.reviewLetter(id, "a1", "approved", data, check);
    });

    it ("approve outgoing letter by additional reviewer #1", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        data[0].should.have.property("_id");
        id = data[0]._id;
        data[0].should.have.property("reviewers");
        data[0].should.have.property("receivingOrganizations");
        data[0].should.have.property("currentReviewer");
        data[0].currentReviewer.should.be.eql("abcd");
        data[0].should.have.property("log");
        data[0].log.should.have.length(4);
        data[0].should.have.property("status");
        data[0].status.should.be.eql(2);

        done();
      }

      var data = {
        message: "OK",
        comments: "commented"
      };
      letter.reviewLetter(id, "abx", "approved", data, check);
    });

    it ("finally approve outgoing letter by additional reviewer #2", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        data[0].should.have.property("_id");
        id = data[0]._id;
        data[0].should.have.property("reviewers");
        data[0].should.have.property("receivingOrganizations");
        data[0].should.have.property("currentReviewer");
        data[0].currentReviewer.should.be.eql("a");
        data[0].should.have.property("log");
        data[0].log.should.have.length(5);
        data[0].should.have.property("status");
        data[0].status.should.be.eql(2);

        done();
      }

      var data = {
        message: "OK",
        comments: "commented"
      };
      letter.reviewLetter(id, "abcd", "approved", data, check);
    });

    it ("finally approve outgoing letter by the sender", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        data[0].should.have.property("_id");
        id = data[0]._id;
        data[0].should.have.property("reviewers");
        data[0].should.have.property("receivingOrganizations");
        data[0].should.have.property("currentReviewer");
        data[0].currentReviewer.should.be.eql("a");
        data[0].should.have.property("log");
        data[0].log.should.have.length(6);
        data[0].should.have.property("status");
        data[0].status.should.be.eql(3);

        done();
      }

      var data = {
        message: "OK",
        comments: "commented"
      };
      letter.reviewLetter(id, "a", "approved", data, check);
    });

  });

  describe("Letter with additional reviewers with duplicates", function() {
    var id;
    it ("create outgoing letter", function(done) {
      var check = function(err, data) {
        var d = _.clone(letterDataSingle);
        d.additionalReviewers = ["abx", "a1", "abcd"];

        letter.editLetter({_id: data[0]._id}, d, function(err, data) {
          data.should.have.length(1);
          data[0].should.have.property("_id");
          id = data[0]._id;
          data[0].should.have.property("reviewers");
          data[0].should.have.property("receivingOrganizations");
          data[0].should.have.property("currentReviewer");
          data[0].reviewers.should.be.eql(["b1", "a1", "abx", "abcd", "a"]);
          data[0].currentReviewer.should.be.eql("b1");
          data[0].should.have.property("status");
          data[0].status.should.be.eql(2);
          done();
        });
      }

      letter.createLetter({originator:letterData[0].originator, sender: "abc", creationDate: new Date}, check);
    });


    it ("review outgoing letter", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        data[0].should.have.property("_id");
        id = data[0]._id;
        data[0].should.have.property("reviewers");
        data[0].should.have.property("receivingOrganizations");
        data[0].should.have.property("currentReviewer");
        data[0].currentReviewer.should.be.eql("a1");
        data[0].should.have.property("log");
        data[0].log.should.have.length(2);
        data[0].should.have.property("status");
        data[0].status.should.be.eql(2);
        data[0].comments.should.be.eql("commented");

        done();
      }

      var data = {
        message: "OK",
        comments: "commented"
      };
      letter.reviewLetter(id, "b1", "approved", data, check);
    });

    it ("approve outgoing letter", function(done) {
      var check = function(err, data) {
        should(err).not.be.ok;
        data.should.have.length(1);
        data[0].should.have.property("_id");
        id = data[0]._id;
        data[0].should.have.property("reviewers");
        data[0].should.have.property("receivingOrganizations");
        data[0].should.have.property("currentReviewer");
        data[0].currentReviewer.should.be.eql("abx");
        data[0].should.have.property("log");
        data[0].log.should.have.length(3);
        data[0].should.have.property("status");
        data[0].status.should.be.eql(2);

        done();
      }

      var data = {
        message: "OK",
        comments: "commented"
      };
      letter.reviewLetter(id, "a1", "approved", data, check);
    });

    it ("approve outgoing letter by additional reviewer #1", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        data[0].should.have.property("_id");
        id = data[0]._id;
        data[0].should.have.property("reviewers");
        data[0].should.have.property("receivingOrganizations");
        data[0].should.have.property("currentReviewer");
        data[0].currentReviewer.should.be.eql("abcd");
        data[0].should.have.property("log");
        data[0].log.should.have.length(4);
        data[0].should.have.property("status");
        data[0].status.should.be.eql(2);

        done();
      }

      var data = {
        message: "OK",
        comments: "commented"
      };
      letter.reviewLetter(id, "abx", "approved", data, check);
    });

    it ("finally approve outgoing letter by additional reviewer #2", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        data[0].should.have.property("_id");
        id = data[0]._id;
        data[0].should.have.property("reviewers");
        data[0].should.have.property("receivingOrganizations");
        data[0].should.have.property("currentReviewer");
        data[0].currentReviewer.should.be.eql("a");
        data[0].should.have.property("log");
        data[0].log.should.have.length(5);
        data[0].should.have.property("status");
        data[0].status.should.be.eql(2);

        done();
      }

      var data = {
        message: "OK",
        comments: "commented"
      };
      letter.reviewLetter(id, "abcd", "approved", data, check);
    });

    it ("finally approve outgoing letter by the sender", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        data[0].should.have.property("_id");
        id = data[0]._id;
        data[0].should.have.property("reviewers");
        data[0].should.have.property("receivingOrganizations");
        data[0].should.have.property("currentReviewer");
        data[0].currentReviewer.should.be.eql("a");
        data[0].should.have.property("log");
        data[0].log.should.have.length(6);
        data[0].should.have.property("status");
        data[0].status.should.be.eql(3);

        done();
      }

      var data = {
        message: "OK",
        comments: "commented"
      };
      letter.reviewLetter(id, "a", "approved", data, check);
    });

  });

  describe("Direct letter to staff", function() {
    var id;
    var directLetter = letterData[8];
    it ("create outgoing letter", function(done) {
      var check = function(err, data) {
        var d = _.clone(directLetter);

        letter.editLetter({_id: data[0]._id}, d, function(err, data) {
          id = data[0]._id;
          done();
        });
      }

      letter.createLetter({originator:directLetter.originator, sender: directLetter.sender, creationDate: new Date}, check);
    });

    it ("approve outgoing letter", function(done) {
      var check = function(err, data) {
        done();
      }

      var data = {
        message: "OK",
        comments: "commented"
      };
      letter.reviewLetter(id, "b1", "approved", data, check);
    });

    it ("send outgoing letter", function(done) {
      var check = function(err, data) {
        done();
      }

      var data = {
        outgoingAgenda: "o123",
        mailId: "123"
      };
      letter.sendLetter(id, "tu.b", data, check);
    });

    it ("should list notification recipient daf1", function(done) {
      setTimeout(function() { // put timeout because notifications are fire and forget
      notification.get("daf1", function(data) {
        var index = _.findIndex(data, { url: "/letter/read/" + id, message: "@letter-received-recipient" });
        index.should.not.eql(-1);
        data[index].should.have.property("username");
        data[index].username.should.eql("daf1");
        done();
      });
      }, 500);
    });

    it ("should not list incoming letter in tu.d", function(done) {
      letter.listIncomingLetter("tu.d", {}, function(err, data) {
        data.should.have.property("data");
        var index = _.findIndex(data.data, { _id: id});
        index.should.eql(-1);
        done();
      });
    });

    it ("should list incoming letter successfully in daf1", function(done) {
      letter.listIncomingLetter("daf1", {}, function(err, data) {
        data.should.have.property("data");
        var index = _.findIndex(data.data, { _id: id});
        index.should.not.eql(-1);
        done();
      });
    });

    it ("should not end up in incoming agenda in d1", function(done) {
      letter.listIncomingLetter("daf", {agenda : true}, function(err, data) {
        data.should.have.property("data");
        var index = _.findIndex(data.data, { _id: id});
        index.should.eql(-1);
        done();
      });
    });

    it ("read incoming letter from unauthorized user from other org", function(done) {
      var check = function(err, data) {
        should(err).be.ok;
        done();
      }

      letter.readLetter(id, "tu.e", check);
    });

    it ("read incoming letter from recipient", function(done) {
      var check = function(err, data) {
        data.should.have.property("data");
        data.data.should.have.property("readStates");
        var r = data.data.readStates;
        r.should.have.property("recipients");
        r.recipients.should.have.property("daf1");

        done();
      }

      letter.readLetter(id, "daf1", check);
    });

  });

  describe("Link letter", function() {
    var id1, id2, id3, idForeign;
    var letter1 = letterData[3];
    var letter2 = letterData[3];
    var letter3 = letterData[3];
    var foreignLetter = letterData[0];

    it ("create outgoing letter 1", function(done) {
      var approve = function(id, fn) {
        var data = {
          message: "OK",
          comments: "commented"
        };
        letter.reviewLetter(id, "b1", "approved", data, fn);
      }

      var send = function(id, fn) {
        var data = {
          outgoingAgenda: "o123",
          mailId: "123"
        };
        letter.sendLetter(id, "tu.b", data, fn);
      }

      var create= function(l) {
        var d = _.clone(l);
        d.title = "letter1";

        letter.createLetter({originator:l.originator, sender: l.sender, creationDate: new Date}, function(err, data) {
          letter.editLetter({_id: data[0]._id}, d, function(err, data) {
            should(err).not.be.ok;
            id1 = data[0]._id;
            approve(id1, function(err) {
              should(err).not.be.ok;
              send(id1, function(err) {
                should(err).not.be.ok;
                done();
              });
            });
          });
        });
      }
      create(letter1);

    });

    it ("create outgoing letter 2", function(done) {
      var approve = function(id, fn) {
        var data = {
          message: "OK",
          comments: "commented"
        };
        letter.reviewLetter(id, "b1", "approved", data, fn);
      }

      var send = function(id, fn) {
        var data = {
          outgoingAgenda: "o123",
          mailId: "123"
        };
        letter.sendLetter(id, "tu.b", data, fn);
      }

      var receive = function(id, fn) {
        var data = {
          incomingAgenda: "o123",
        };
        letter.receiveLetter(id, "tu.d", data, fn);
      }

      var create= function(l) {
        var d = _.clone(l);
        d.title = "letter2";

        letter.createLetter({originator:l.originator, sender: l.sender, creationDate: new Date}, function(err, data) {
          letter.editLetter({_id: data[0]._id}, d, function(err, data) {
            should(err).not.be.ok;
            id2 = data[0]._id;
            approve(id2, function(err) {
              should(err).not.be.ok;
              send(id2, function(err) {
                should(err).not.be.ok;
                receive(id2, function(err) {
                  should(err).not.be.ok;
                  done();
                });
              });
            });
          });
        });
      }
      create(letter2);

    });

    it ("create outgoing letter 3", function(done) {
      var approve = function(id, fn) {
        var data = {
          message: "OK",
          comments: "commented"
        };
        letter.reviewLetter(id, "b1", "approved", data, fn);
      }

      var send = function(id, fn) {
        var data = {
          outgoingAgenda: "o123",
          mailId: "123"
        };
        letter.sendLetter(id, "tu.b", data, fn);
      }

      var receive = function(id, fn) {
        var data = {
          incomingAgenda: "o123",
        };
        letter.receiveLetter(id, "tu.d", data, fn);
      }

      var create= function(l) {
        var d = _.clone(l);
        d.title = "letter3";

        letter.createLetter({originator:l.originator, sender: l.sender, creationDate: new Date}, function(err, data) {
          letter.editLetter({_id: data[0]._id}, d, function(err, data) {
            should(err).not.be.ok;
            id3 = data[0]._id;
            approve(id3, function(err) {
              should(err).not.be.ok;
              send(id3, function(err) {
                should(err).not.be.ok;
                receive(id3, function(err) {
                  should(err).not.be.ok;
                  done();
                });
              });
            });
          });
        });
      }
      create(letter3);

    });

    it ("create outgoing foreign letter", function(done) {
      var approve = function(id, fn) {
        var data = {
          message: "OK",
          comments: "commented"
        };
        letter.reviewLetter(id, "a", "approved", data, fn);
      }

      var approveA1 = function(id, fn) {
        var data = {
          message: "OK",
          comments: "commented"
        };
        letter.reviewLetter(id, "a1", "approved", data, fn);
      }

      var approveB1 = function(id, fn) {
        var data = {
          message: "OK",
          comments: "commented"
        };
        letter.reviewLetter(id, "b1", "approved", data, fn);
      }

      var send = function(id, fn) {
        var data = {
          outgoingAgenda: "o123",
          mailId: "123"
        };
        letter.sendLetter(id, "tu.a", data, fn);
      }

      var create= function(l) {
        var d = _.clone(l);

        letter.createLetter({originator:l.originator, sender: l.sender, creationDate: new Date}, function(err, data) {
          letter.editLetter({_id: data[0]._id}, d, function(err, data) {
            should(err).not.be.ok;
            idForeign = data[0]._id;
            approveB1(idForeign, function(err) {
              should(err).not.be.ok;
              approveA1(idForeign, function(err) {
                if (err) console.log(arguments);
                should(err).not.be.ok;
                approve(idForeign, function(err) {
                  should(err).not.be.ok;
                  send(idForeign, function(err) {
                    should(err).not.be.ok;
                    done();
                  });
                });
              });
            });
          });
        });
      }
      create(foreignLetter);
    });

    it ("should create outgoing letter and link", function(done) {
      var approve = function(id, fn) {
        var data = {
          message: "OK",
          comments: "commented"
        };
        letter.reviewLetter(id, "b1", "approved", data, fn);
      }

      var send = function(id, fn) {
        var data = {
          outgoingAgenda: "o123",
          mailId: "123"
        };
        letter.sendLetter(id, "tu.b", data, fn);
      }

      var create= function(l) {
        var d = _.clone(l);

        letter.createLetter({originator:l.originator, sender: l.sender, creationDate: new Date}, function(err, data) {
          letter.editLetter({_id: data[0]._id}, d, function(err, data) {
            should(err).not.be.ok;
            var id = data[0]._id;
            letter.link("c", id, [ id1, id2, id3 ], function(err, data) {
              should(err).not.be.ok;
              letter.openLetter(id, "tu.d", {}, function(err, data) {
                should(err).not.be.ok;
                data.should.have.length(1);
                data[0].should.have.property("links");
                data[0].links.should.have.length(3);
                done();
              });
            });
          });
        });
      }
      create(letter2);

    });

    it ("should create outgoing letter and link from unauthorized users", function(done) {
      var approve = function(id, fn) {
        var data = {
          message: "OK",
          comments: "commented"
        };
        letter.reviewLetter(id, "b1", "approved", data, fn);
      }

      var send = function(id, fn) {
        var data = {
          outgoingAgenda: "o123",
          mailId: "123"
        };
        letter.sendLetter(id, "tu.b", data, fn);
      }

      var create= function(l) {
        var d = _.clone(l);

        letter.createLetter({originator:l.originator, sender: l.sender, creationDate: new Date}, function(err, data) {
          letter.editLetter({_id: data[0]._id}, d, function(err, data) {
            should(err).not.be.ok;
            var id = data[0]._id;
            letter.link("a", id, [ id1, id2, id3 ], function(err, data) {
              should(err).be.ok;
              letter.openLetter(id, "tu.d", {}, function(err, data) {
                data.should.have.length(1);
                data[0].should.not.have.property("links");
                done();
              });
            });
          });
        });
      }
      create(letter2);

    });

    it ("should create outgoing letter and link then link again by the recipients", function(done) {
      var approve = function(id, fn) {
        var data = {
          message: "OK",
          comments: "commented"
        };
        letter.reviewLetter(id, "b1", "approved", data, fn);
      }

      var receive = function(id, fn) {
        var data = {
          incomingAgenda: "o123",
        };
        letter.receiveLetter(id, "tu.d", data, fn);
      }

      var send = function(id, fn) {
        var data = {
          outgoingAgenda: "o123",
          mailId: "123"
        };
        letter.sendLetter(id, "tu.b", data, fn);
      }

      var create= function(l) {
        var d = _.clone(l);

        letter.createLetter({originator:l.originator, sender: l.sender, creationDate: new Date}, function(err, data) {
          letter.editLetter({_id: data[0]._id}, d, function(err, data) {
            should(err).not.be.ok;
            var id = data[0]._id;

            var funcs = [];
            funcs.push(function(cb) {
              letter.link("c", id, [ id1 ], function(err, data) {
                should(err).not.be.ok;
                letter.openLetter(id, "tu.d", {}, function(err, data) {
                  should(err).not.be.ok;
                  data.should.have.length(1);
                  data[0].should.have.property("links");
                  data[0].links.should.have.length(1);
                  cb(err);
                });
              });
            });
            funcs.push(function(cb) {
              approve(id, function(err) {
                should(err).not.be.ok;
                letter.openLetter(id, "tu.d", {}, function(err, data) {
                  should(err).not.be.ok;
                  data.should.have.length(1);
                  data[0].should.have.property("links");
                  data[0].links.should.have.length(1);
                  cb(err);
                });
              });
            });
            funcs.push(function(cb) {
              send(id, function(err) {
                should(err).not.be.ok;
                letter.openLetter(id, "tu.d", {}, function(err, data) {
                  should(err).not.be.ok;
                  data.should.have.length(1);
                  data[0].should.have.property("links");
                  data[0].links.should.have.length(1);
                  cb(err);
                });
              });
            });
            funcs.push(function(cb) {
              receive(id, function(err) {
                should(err).not.be.ok;
                letter.openLetter(id, "tu.d", {}, function(err, data) {
                  should(err).not.be.ok;
                  data.should.have.length(1);
                  data[0].should.have.property("links");
                  data[0].links.should.have.length(1);
                  cb(err);
                });
              });
            });

            async.series(funcs, function(err, v) {
              should(err).not.be.ok;
              letter.openLetter(id, "d", {}, function(err, data) {
                should(err).not.be.ok;
                data.should.have.length(1);
                data[0].should.have.property("links");
                data[0].links.should.have.length(1);
                letter.link("d", id, [ id2 ], function(err, data) {
                  should(err).not.be.ok;
                  letter.openLetter(id, "d", {}, function(err, data) {
                    should(err).not.be.ok;
                    data.should.have.length(1);
                    data[0].should.have.property("links");
                    data[0].links.should.have.length(2);
                    done();
                  });
                });
              });
            });
          });
        });
      }
      create(letter2);
    });

    it ("should create outgoing letter and link then should not linked by the admin staff", function(done) {
      var approve = function(id, fn) {
        var data = {
          message: "OK",
          comments: "commented"
        };
        letter.reviewLetter(id, "b1", "approved", data, fn);
      }

      var receive = function(id, fn) {
        var data = {
          incomingAgenda: "o123",
        };
        letter.receiveLetter(id, "tu.d", data, fn);
      }

      var send = function(id, fn) {
        var data = {
          outgoingAgenda: "o123",
          mailId: "123"
        };
        letter.sendLetter(id, "tu.b", data, fn);
      }

      var create= function(l) {
        var d = _.clone(l);

        letter.createLetter({originator:l.originator, sender: l.sender, creationDate: new Date}, function(err, data) {
          letter.editLetter({_id: data[0]._id}, d, function(err, data) {
            should(err).not.be.ok;
            var id = data[0]._id;

            var funcs = [];
            funcs.push(function(cb) {
              letter.link("c", id, [ id1 ], function(err, data) {
                should(err).not.be.ok;
                letter.openLetter(id, "tu.d", {}, function(err, data) {
                  should(err).not.be.ok;
                  data.should.have.length(1);
                  data[0].should.have.property("links");
                  data[0].links.should.have.length(1);
                  cb(err);
                });
              });
            });
            funcs.push(function(cb) {
              approve(id, function(err) {
                should(err).not.be.ok;
                letter.openLetter(id, "tu.d", {}, function(err, data) {
                  should(err).not.be.ok;
                  data.should.have.length(1);
                  data[0].should.have.property("links");
                  data[0].links.should.have.length(1);
                  cb(err);
                });
              });
            });
            funcs.push(function(cb) {
              send(id, function(err) {
                should(err).not.be.ok;
                letter.openLetter(id, "tu.d", {}, function(err, data) {
                  should(err).not.be.ok;
                  data.should.have.length(1);
                  data[0].should.have.property("links");
                  data[0].links.should.have.length(1);
                  cb(err);
                });
              });
            });
            funcs.push(function(cb) {
              receive(id, function(err) {
                should(err).not.be.ok;
                letter.openLetter(id, "tu.d", {}, function(err, data) {
                  should(err).not.be.ok;
                  data.should.have.length(1);
                  data[0].should.have.property("links");
                  data[0].links.should.have.length(1);
                  cb(err);
                });
              });
            });

            async.series(funcs, function(err, v) {
              should(err).not.be.ok;
              letter.openLetter(id, "d", {}, function(err, data) {
                should(err).not.be.ok;
                data.should.have.length(1);
                data[0].should.have.property("links");
                data[0].links.should.have.length(1);
                letter.link("tu.d", id, [ id2 ], function(err, data) {
                  should(err).be.ok;
                  done();
                });
              });
            });
          });
        });
      }
      create(letter2);
    });

  });
});

