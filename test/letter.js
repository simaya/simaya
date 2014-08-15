var should = require("should");
var _ = require("lodash");
var chance = require("chance").Chance(9); // use exactly same seed for deterministic tests
var path = require("path");
var os = require("os");
var utils = require(__dirname + "/utils");
var letter = require(__dirname + "/../simaya/models/letter.js")(utils.app);
var user = utils.app.db("user"); 
var fs = require("fs");


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

var saveAttachment = function(index, data, cb) {
  var file = createFile();
  var selector = {_id: data[index]._id};
  letter.saveAttachmentFile(file, function(err, r0) {
    should(err).not.be.ok;
    
    var d = _.clone(letterData[index]); 
    var selector = {_id: data[index]._id};
    file.path = r0.fileId;

    letter.addFileAttachment(selector, file, function(err) { 
      should(err).not.be.ok;
      letter.editLetter(selector, d, function(err, r1) {
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

  it ("should create an incoming letter", function(done) {
    var check = function(err, data) {
      saveAttachment(0, data, function(record) {
        record.should.have.length(1);
        record[0].should.have.property("fileAttachments");
        record[0].fileAttachments.should.have.length(1);
        done();
      });
    }

    letter.createLetter({originator:"abc", sender: "abc", creationDate: new Date}, check);
  });
});
});
