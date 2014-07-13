var OwnBox = require("..").OwnBox;
var assert = require("better-assert");
var debug = require("debug")("test:box");
var mongo = require("mongodb");
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

describe("Directory", function(){

  // app opens the db connection
  it("should open the db connection", function(done){
    db.open(done);
  });

  // app sets the grid filesystem up!
  it("should setup box gfs and use `ownbox` as root", function(){
    box.setup(db, mongo);
    // "We should have gfs with valid mongodb connection now", says the `app` silently (he's not sure!)
    assert(box.gfs);
    assert(box.root == "ownbox")
  });

  it("should empty the box", function(done){
    box.directory("/").destroy(done);
  });

  describe(".create()", function() {
    it("should create a new directory in db", function(done){
      box.directory("test").create(done);
    });

    it("should create other 5 directories (hence we have 6 directories now!) in db", function(done){
      box.directory("test/1/2/3/4/5").create(done);
    });
  });

  describe(".destroy()", function() {
    it("should destroy those 6 created directories in db", function(done){
      // destroying directory `test`, i.e. `/diorahman/test`, means deleting its children too
      box.directory("test").destroy(done);
    });
  });

  describe(".rename()", function() {
    it("should create a new `Documnts` directory in db", function(done){
      box.directory("Documnts").create(done);
    });

    it("should fix newly created `Documnts` directory name to `Documents` in db", function(done){
      box.directory("Documnts").rename({ to : "Documents"}, done); // renaming 
    });

    it("should destroy `Documents` directory in db", function(done){
      box.directory("Documents").destroy(done);
    });
  });

  describe(".move()", function(){
    it("should create new directories test/1/2/3/4 in user directory in db", function(done) {
      box.directory("test/1/2/3/4").create(done);
    })

    it("should move test/1/2/3/4 to test/1/2/3/moved in db", function(done) {
      box.directory("test/1/2/3/4").move({ to : "moved" }, done);
    })

    it("should move test/1/2/3 (including its content) to test/1/2/moved3/data in db", function(done) {
      box.directory("test/1/2/3").move({ to : "moved3/data" }, done);
    })

    it("should destroy those directories created for this test in db", function(done){
      box.directory("test").destroy(done);
    });
  });

  describe(".copy()", function(){
    it("should test copy(), however it's not yet implemented", function(done){
      done();
    });
  })

});