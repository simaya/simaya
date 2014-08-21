var should = require("should");
var _ = require("lodash");
var chance = require("chance").Chance(9); // use exactly same seed for deterministic tests
var path = require("path");
var os = require("os");
var utils = require(__dirname + "/utils");
var letter = require(__dirname + "/../simaya/models/letter.js")(utils.app);
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

var insertUser = function(u, cb) {
  user.insert({
    username: u.username,
    profile: {
      organization: u.org
    }
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

        letter.downloadAttachment(file.path, stream, done);
      });
    });
  });
}


describe("Letter", function() {

  before(function() {
    utils.db.open(function() {
      bulkInsert(1, function(){});
    });
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
      recipient: "user1",
      sender: "user2",
      title: "title",
      classification: "0",
      priority: "0",
      type: "11",
      comments: "comments"
    },
    {
      operation: "manual-incoming",
      date: new Date,
      receivedDate: new Date,
      mailId: "123",
      incomingAgenda: "A123",
      recipient: "user1",
      ccList: "user3,user4",
      sender: "user2",
      title: "title",
      classification: "0",
      priority: "0",
      type: "11",
      comments: "comments"
    },
  ];

  describe("Letter[manual-incoming]", function() {
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

      letter.createLetter({originator:"abc", sender: "abc", creationDate: new Date}, check);
    });

    it ("should create an incoming letter with cc", function(done) {
      var check = function(err, data) {
        var d = _.clone(letterData[1]);
        d._id = data[0]._id;
        saveAttachment(d, function(record) {
          record.should.have.length(1);
          record[0].should.have.property("fileAttachments");
          record[0].fileAttachments.should.have.length(1);
          record[0].should.have.property("ccList");
          record[0].ccList.should.have.length(2);
          done();
        });
      }

      letter.createLetter({originator:"abc", sender: "abc", creationDate: new Date}, check);
    });

  });
});

describe("Letter Process", function() {
  before(function(done) {
    var orgs = [
      { name: "A", path: "A", head: "a" },
      { name: "B", path: "A;B", head: "b1" },
      { name: "C", path: "A;B;C", head: "c" },
      { name: "D", path: "D", head: "d" },
    ];
    var users = [
      { username: "a", org: "A" },
      { username: "b", org: "A;B" },
      { username: "b1", org: "A;B" },
      { username: "c", org: "A;B;C" },
      { username: "c1", org: "A;B;C" },
      { username: "d", org: "D" },
    ]
    async.series([
      function(cb) {
        clearUser(function(err, r) {
          cb(err, r);
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
  });

  describe("Get reviewer list by user", function() {
    it ("should return correct list", function(done) {
      letter.reviewerListByUser("c1", "a", function(data) {
        data.should.have.length(3);
        var names = _.pluck(data, "username"); 
        names.should.eql(["c", "b1", "a"]);
        done();
      });
    });

    it ("should also return correct list", function(done) {
      letter.reviewerListByUser("b", "a", function(data) {
        data.should.have.length(2);
        var names = _.pluck(data, "username"); 
        names.should.eql(["b1", "a"]);
        done();
      });
    });

    it ("should also return correct list again", function(done) {
      letter.reviewerListByUser("c1", "b", function(data) {
        data.should.have.length(2);
        var names = _.pluck(data, "username"); 
        names.should.eql(["c", "b1"]);
        done();
      });
    });

    it ("should also return correct list again", function(done) {
      letter.reviewerListByUser("c", "b", function(data) {
        data.should.have.length(1);
        var names = _.pluck(data, "username"); 
        names.should.eql(["b1"]);
        done();
      });
    });

     it ("should fail", function(done) {
      letter.reviewerListByUser("c1", "d", function(data) {
        data.should.have.length(0);
        done();
      });
    });

     it ("should fail again", function(done) {
      letter.reviewerListByUser("a", "c", function(data) {
        data.should.have.length(0);
        done();
      });
    });
  });

  var letterData = [
    {
      operation: "outgoing",
      date: new Date,
      recipient: "d",
      sender: "a",
      originator: "c",
      title: "title",
      classification: "0",
      priority: "0",
      type: "11",
      comments: "comments"
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

    var id;
    it ("create outgoing letter", function(done) {
      var check = function(err, data) {
        var d = _.clone(letterData[0]);

        letter.editLetter({_id: data[0]._id}, d, function(err, data) {
          data.should.have.length(1);
          data[0].should.have.property("_id");
          id = data[0]._id;
          data[0].should.have.property("reviewers");
          data[0].should.have.property("currentReviewer");
          data[0].reviewers.should.be.eql(["b1", "a"]);
          data[0].currentReviewer.should.be.eql("b1");
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
        data[0].should.have.property("currentReviewer");
        data[0].currentReviewer.should.be.eql("a");
        data[0].should.have.property("log");
        data[0].log.should.have.length(2);
        
        done();
      }

      var data = {
        message: "OK",
        comments: "commented"
      };
      letter.reviewLetter(id, "b1", "approved", data, check);
    });

    it ("reject outgoing letter", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        data[0].should.have.property("_id");
        id = data[0]._id;
        data[0].should.have.property("reviewers");
        data[0].should.have.property("currentReviewer");
        data[0].currentReviewer.should.be.eql("b1");
        data[0].should.have.property("log");
        data[0].log.should.have.length(3);
        
        done();
      }

      var data = {
        message: "Not OK",
        comments: "commented"
      };
      letter.reviewLetter(id, "a", "declined", data, check);
    });

    it ("reject outgoing letter", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        data[0].should.have.property("_id");
        id = data[0]._id;
        data[0].should.have.property("reviewers");
        data[0].should.have.property("currentReviewer");
        data[0].currentReviewer.should.be.eql("c");
        data[0].should.have.property("log");
        data[0].log.should.have.length(4);
        
        done();
      }

      var data = {
        message: "Not OK",
        comments: "commented"
      };
      letter.reviewLetter(id, "b1", "declined", data, check);
    });

    it ("approve outgoing letter", function(done) {
      var check = function(err, data) {
        data.should.have.length(1);
        data[0].should.have.property("_id");
        id = data[0]._id;
        data[0].should.have.property("reviewers");
        data[0].should.have.property("currentReviewer");
        data[0].currentReviewer.should.be.eql("b1");
        data[0].should.have.property("log");
        data[0].log.should.have.length(5);
        
        done();
      }

      var data = {
        message: "OK",
        comments: "commented"
      };
      letter.reviewLetter(id, "c", "approved", data, check);
    });





  });
});



