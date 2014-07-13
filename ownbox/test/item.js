var OwnBox = require("..").OwnBox;
var assert = require("better-assert");
var debug = require("debug")("test:box");
var mongo = require("mongodb");
var fs = require("fs");
var db = new mongo.Db("ownbox-test", new mongo.Server("127.0.0.1", 27017), {safe:false});

// user #1 is diorahman
var diorahman = { 
  user : "diorahman", 
  profile : {
    fullname : "Dhi Aurrahman",
    email : "diorahman@gmail.com",
    avatar : "https://pbs.twimg.com/profile_images/378800000537343921/676fe99f05ab01874830eeef1080cd2d.jpeg"
  }
}

// user #2 is mdamt
var mdamt = { 
  user : "aksimdamt", 
  profile : {
    fullname : "Mohammad DAMT",
    email : "mdamt@mdamt.net",
    avatar : "https://pbs.twimg.com/profile_images/1409734917/a.jpg"
  }
}

// diorahman owns a box
var box = new OwnBox({ owner : diorahman });

describe('Item', function(){
  
  // app opens the db connection
  it("should open the db connection", function(done){
    db.open(done);
  });

  // app sets the grid filesystem up!
  it("should setup box gfs", function(){
    box.setup(db, mongo);
    // "We should have gfs with valid mongodb connection now", says the `app` silently (he's not sure!)
    assert(box.gfs);
  });

  it("should clear the box", function(done){
    box.directory("/").destroy(done);
  });

  it("should create a new directory in db", function(done){
    box.directory("test").create(done);
  });

  describe(".put()", function() {
    it("should put a new file in db", function(done){
      box.directory("test").file(__dirname + "/box.js").put(done);
    });

    it("should put another version of file in db", function(done){
      box.directory("test").file(__dirname + "/box.js").put(done);
    });

  });

  describe(".write()", function() {
    it("should put another version of file in db, this time using .write()", function(done){
      box.directory("test").file(__dirname + "/box.js").write(done);
    });
  });

  describe(".revisions()", function() {
    it("should get revisions of file in db", function(done){
      box.directory("test").file("box.js").revisions(function(err, revisions){
        assert(revisions.length == 3);
        done(err);
      });
    });
  });

  describe(".inspect()", function() {
    it("should get the first revision of file in db", function(done){
      box.directory("test").file("box.js", { rev : 1}).inspect(function(err, revision){
        assert(revision.metadata.revision == 1);
        done(err);
      });
    });

    it("should get the second revision of file in db", function(done){
      box.directory("test").file("box.js", { rev : 2}).props(function(err, revision){
        assert(revision.metadata.revision == 2);
        done(err);
      });
    });
  });

  describe(".read()", function() {
    it("should read the first revision of the file", function(done){
      var stream = fs.createWriteStream(__dirname + "/box-from-db.js");

      box.directory("test").file("box.js").read({ to : stream }, function(err){
        if (err) return done(err);

        var stat = fs.statSync(__dirname + "/box-from-db.js");

        assert(stat != null);

        fs.unlinkSync(__dirname + "/box-from-db.js");

        done(err);

      });
    });
  });

  describe(".share()", function(){
    it("should share the first revision of file to mdamt ", function(done){
      
      var recipient = mdamt;
      recipient.rights = "rw";

      box.directory("test").file("box.js", { rev : 1}).share({ to : [ recipient ] }, function(err){
        if (err) return done(err);

        box.directory("test").file("box.js", { rev : 1}).props(function(err, rev){

          if (err) return done(err);

          assert(rev.metadata.sharedTo.length == 1);
          assert(rev.metadata.sharedTo[0].user == recipient.user);
          assert(rev.metadata.sharedTo[0].rights == recipient.rights);

          done(err);

        });
      });
    });
  });

  describe(".destroy()", function() {
    it("should destroy the second revision of file in db", function(done){

      box.directory("test").file("box.js", { rev : 2}).destroy(function(err){
        if (err) return done(err);

        box.directory("test").file("box.js").revisions(function(err, revs){

          if (err) return done(err);

          assert(revs.length == 2);

          var found = false;
          for (var i = 0; i < revs.length; i++) {
            if (revs[i].metadata.revision == 2) {
              found = true;
              break;
            }
          }
          assert(!found);
          done(err);
        })
      });
    });

    it("should destroy the file in db", function(done){
      box.directory("test").file("box.js").destroy(function(err){
        if (err) return done(err);

        box.directory("test").file("box.js").revisions(function(err, revs){
          if (err) return done(err);
          assert(revs.length == 0);
          done(err);
        })
      })
    })
  });

});