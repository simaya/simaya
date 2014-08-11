var should = require("should");
var utils = require(__dirname + "/utils");
var letter = require(__dirname + "/../simaya/models/letter.js")(utils.app);

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
