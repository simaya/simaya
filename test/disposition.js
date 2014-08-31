var should = require("should");
var _ = require("lodash");
var chance = require("chance").Chance(9); // use exactly same seed for deterministic tests
var path = require("path");
var os = require("os");
var utils = require(__dirname + "/utils");
var disposition = require(__dirname + "/../simaya/models/disposition.js")(utils.app);
var notification = require(__dirname + "/../simaya/models/notification.js")(utils.app);
var user = utils.app.db("user"); 
var orgDb = utils.app.db("organization"); 
var fs = require("fs");
var async = require("async");

var clearUser = function(cb) {
  user.remove({}, {j:false}, cb);
}

var clearDisposition = function(cb) {
  var l = utils.app.db("disposition"); 
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

var dispositionData = {
  simpleCreate: {
    date: new Date,
    sender: "a",
    letterTitle: "abc",
    letterMailId: "abc",
    letterDate: new Date,
    recipients: [
      {
        message: "m1",
        recipient: "a1",
        date: new Date,
        instruction: "2",
        security: "0",
        priority: "0",
      }
    ]
  }
}

describe("Disposition", function() {
  before(function(done) {
    try {
    utils.db.open(function() {
      var orgs = [
        { name: "A", path: "A", head: "a" },
        { name: "AA", path: "A;A", head: "aa" },
        { name: "B", path: "B", head: "b1" },
      ];
      var users = [
        { username: "a", org: "A" },
        { username: "tu.a", org: "A", roleList: [ utils.simaya.administrationRole ]},
        { username: "a1", org: "A" },
        { username: "a2", org: "A" },
        { username: "aa", org: "A;A" },
        { username: "b", org: "B" },
        { username: "b1", org: "B" },
        { username: "tu.b", org: "B", roleList: [ utils.simaya.administrationRole ]},
      ]
      async.series([
        function(cb) {
          clearUser(function(err, r) {
            clearDisposition(function(err, r) {
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
    });
    } catch(e) {}
  });

  describe("Disposition[Creation]", function() {
    it ("should create", function(done) {
      disposition.create(dispositionData.simpleCreate, function() {
        done();
      });
    });
  });

  describe("Disposition[Sharing]", function() {
    it ("should share with a single recipient", function(done) {
      var share = function(err, data) {
        disposition.share(data._id, "a1", ["aa"], "omama", function(err, data) {
          should(err).not.be.ok;
          data.should.have.length(1);
          data[0].should.have.property("sharedRecipients");
          data[0].sharedRecipients.should.have.length(1);
          data[0].sharedRecipients[0].should.have.properties(["recipient", "sender"]);
          data[0].sharedRecipients[0].recipient.should.eql("aa");
          data[0].sharedRecipients[0].sender.should.eql("a1");
          done();
        })
      }

      disposition.create(dispositionData.simpleCreate, share);
    });

    it ("should not share with a single recipient accross org", function(done) {
      var share = function(err, data) {
        disposition.share(data._id, "a1", ["b1"], "omama", function(err, data) {
          should(err).be.ok;
          done();
        })
      }

      disposition.create(dispositionData.simpleCreate, share);
    });
    it ("should share with multiple recipients", function(done) {
      var share = function(err, data) {
        disposition.share(data._id, "a1", ["aa", "a2"], "omama", function(err, data) {
          should(err).not.be.ok;
          data.should.have.length(1);
          data[0].should.have.property("sharedRecipients");
          data[0].sharedRecipients.should.have.length(2);
          data[0].sharedRecipients[0].should.have.properties(["recipient", "sender"]);
          data[0].sharedRecipients[0].recipient.should.eql("aa");
          data[0].sharedRecipients[0].sender.should.eql("a1");
          data[0].sharedRecipients[1].should.have.properties(["recipient", "sender"]);
          data[0].sharedRecipients[1].recipient.should.eql("a2");
          data[0].sharedRecipients[1].sender.should.eql("a1");

          done();
        })
      }

      disposition.create(dispositionData.simpleCreate, share);
    });

    it ("should not share with multiple recipient accross org", function(done) {
      var share = function(err, data) {
        disposition.share(data._id, "a1", ["aa", "b1"], "omama", function(err, data) {
          should(err).be.ok;
          done();
        })
      }

      disposition.create(dispositionData.simpleCreate, share);
    });


  });

});

