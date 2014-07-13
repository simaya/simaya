// this is a workbench file, not an assertion test file
// $ DEBUG=* node test/run.js 
// or
// $ make run

var OwnBox = require("..").OwnBox;
var OwnBoxError = require("../lib/error");
var assert = require("better-assert");
var debug = require("debug")("box:run");
var fs = require("fs");
var mongo = require('mongodb');
var db = new mongo.Db("ownbox-test", new mongo.Server("127.0.0.1", 27017), {safe:false});

var box = new OwnBox({
  owner : { 
    user : "diorahman", 
    profile : {
      fullname : "Dhi Aurrahman",
      email : "diorahman@gmail.com",
      avatar : "https://pbs.twimg.com/profile_images/378800000537343921/676fe99f05ab01874830eeef1080cd2d.jpeg"
    }
  }
});

var diorahman = { 
  user : "diorahman", 
  profile : {
    fullname : "Dhi Aurrahman",
    email : "diorahman@gmail.com",
    avatar : "https://pbs.twimg.com/profile_images/378800000537343921/676fe99f05ab01874830eeef1080cd2d.jpeg"
  }
}
var mdamt = { 
  user : "mdamt", 
  profile : {
    fullname : "Mohammad DAMT",
    email : "mdamt@mdamt.net",
    avatar : "https://pbs.twimg.com/profile_images/1409734917/a.jpg"
  }
}

var joni = { 
  user : "joni", 
  profile : {
    fullname : "Jajang ONI",
    email : "joni@joni.net",
    avatar : "https://pbs.twimg.com/profile_images/1409734917/a.jpg"
  }
}

function file(box){
  box.directory("/").destroy();
}

function run(){
  box.setup(db, mongo);
  file(box);
}

db.open(run)