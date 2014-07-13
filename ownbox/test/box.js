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

describe("OwnBox", function(){

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

  it("should work without new", function(){

    // `app` creates another box with different owner and an opened db connection, 
    // i.e. for mdamt with `db` as db, without `new` operator
    var anotherBox = OwnBox({ owner : mdamt, db : db, mongo : mongo });
    
    // "Remember son, these following properties are mandatory", says the `app` wisely
    assert(anotherBox.owner);
    assert(anotherBox.owner.user);
    assert(anotherBox.owner.profile);
    assert(anotherBox.gfs);
  });

  it("should work using `ownbox` as default root", function(){
    assert(box.root == "ownbox");
  })

  describe(".directory()", function(){
    it("should return root directory", function(){
      var directory = box.directory("/");
      var rootDir = "/" + diorahman.user;
      assert(directory.id == rootDir);
    });

    it("should return `test` directory", function(){
      var directory = box.directory("test");
      var rootDir = "/" + diorahman.user + "/test";
      assert(directory.id == rootDir);
    });

    it("should return `test/test` directory", function(){
      var directory = box.directory("test/test");
      var rootDir = "/" + diorahman.user + "/test/test";
      assert(directory.id == rootDir);
    });
  });
});
