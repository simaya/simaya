var File = require("..").File;
var app = require("./helper/app");
var fs = require("fs");
var assert = require("assert");

var f = File(app);

describe("Legacy File API", function() {
  describe("upload", function() {

    var metadata = {
      path: "/tmp/t1"
    , name: "test"
    , type: "text/plain"
    , _id: app.ObjectID() 
    , location: "/upload"
    }
    
    it('should open the db connection', function(done){
      app.db.open(done);
    });

    it("should return null error", function(done) {
      fs.writeFileSync(metadata.path, "data"); 
      f.upload(metadata, function(e, file) {
        assert.equal(e, null);
        done(e);  
      })
    });

    it("should remove the old file", function(done) {
      fs.writeFileSync(metadata.path, "data"); 
      f.upload(metadata, function(e, file) {
        assert.equal(fs.existsSync(metadata.path), false);
        done(e);
      });
    });

    it("should now the third sequence", function(done) {
      fs.writeFileSync(metadata.path, "data"); 
      f.upload(metadata, function(e, file) {
        assert.equal(file.history.length, 3);
        done(e);
      });
    });
  });

  describe("simplePublicUpload", function() {
    var file = {
      path: "/tmp/t1"
    , name: "u"
    , type: "image/png"
    }

    it("should return null error", function(done) {
      fs.writeFileSync(file.path, "data"); 
      f.simplePublicUpload(file, "/tmp", function(e, file) {
        assert.equal(e, null);
        done(e);
      });
    });
  });

  describe("download", function() {
    var file = {
      path: "/tmp/t1"
    , name: "u"
    , type: "image/png"
    }

    it("should return null error", function(done) {
      fs.writeFileSync(file.path, "data");
      f.simplePublicUpload(file, "/tmp", function(e, file) {
        var stream = fs.createWriteStream(file.path);
        f.download(file._id, 0, stream, function(e) {
          assert.equal(e, null);
          done();
        });
      });
    });
  });

});
