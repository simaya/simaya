var should = require("should");
var _ = require("lodash");
var chance = require("chance").Chance(9); // use exactly same seed for deterministic tests
var path = require("path");
var os = require("os");
var utils = require(__dirname + "/utils");
var letter = require(__dirname + "/../simaya/models/letter.js")(utils.app);
var fs = require("fs");

utils.db.open(function() {});

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
    receivingOrganizations: {
      "org1": {
        status: 6,
        agenda: "123",
        date: new Date
      }
    },
    recipients: [
      "recipient1"
      ],
    sender: "sender1",
    senderOrganization: "org2",
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
  var output = fs.createWriteStream(fullFilename); 
  for (var i = 0; i < 100; i ++) {
    output.write(chance.paragraph());
  }
  output.close();
  return {
    name: filename,
    path: fullFilename,
    type: "text/plain"
  };
}

var saveAttachment = function(data, cb) {
  var file = createFile();
  var selector = {_id: data[0]._id};

  letter.saveAttachmentFile(file, function(err, r0) {
    should(err).not.be.ok;
    var d = _.clone(letterData[0]); 
    var selector = {_id: data[0]._id};
    file.path = r0.fileId;
    letter.addFileAttachment(selector, file, function(err) { 
      should(err).not.be.ok;
      letter.editLetter(selector, d, function(err, r1) {
        should(err).not.be.ok;
        var stream = fs.createWriteStream(path.join(os.tmpdir(), chance.string({length:20})));
        // mock http response stream
        stream.contentType = function() {};
        stream.attachment = function() {};
        var done = function(err) {
          console.log(JSON.stringify(r1));
          should(err).not.be.ok;
          cb(r1);
        };
        letter.downloadAttachment(file.path, stream, done);
      });
    });
  });
}


describe("Letter[manual-incoming]", function() {
  it ("should fail on incomplete data: receivingOrganizations", function(done) {
    var check = function(err, data) {
      var d = _.clone(letterData[0]);
      delete(d.receivingOrganizations);

      letter.editLetter({_id: data[0]._id}, d, function(err, data) {
        should(err).be.ok;
        data.should.have.property("success");
        data.should.have.property("fields");
        data.success.should.not.be.ok;
        data.fields.should.containEql("receivingOrganizations");
        done();
      });
    }

    letter.createLetter({originator:"abc", sender: "abc", creationDate: new Date}, check);
  });

  it ("should create an incoming letter", function(done) {
    var check = function(err, data) {
      saveAttachment(data, function(record) {
        record.should.have.length(1);
        record[0].should.have.property("fileAttachments");
        record[0].fileAttachments.should.have.length(1);
        done();
      });
    }

    letter.createLetter({originator:"abc", sender: "abc", creationDate: new Date}, check);
  });
});


