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

var clearOrganization = function(cb) {
  var l = utils.app.db("organization"); 
  l.remove({}, {j:false}, cb);
}

var insertUser = function(u, cb) {
  user.insert({
    username: u.username,
    profile: {
      organization: u.org,
      echelon: u.echelon
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
    if (utils.db.openCalled) {
      return done();
    }
    utils.db.open(function() {
      var orgs = [
        { name: "A", path: "A", head: "a" },
        { name: "AA", path: "A;A", head: "aa" },
        { name: "AAA", path: "A;A;A", head: "aaa" },
        { name: "B", path: "B", head: "b1" },
        { name: "BB", path: "B;B", head: "bb1" },
        { name: "BBB", path: "B;B;B", head: "bbb1" },
      ];

      var users = [
        { username: "a", org: "A", echelon: "1" },
        { username: "tu.a", org: "A", roleList: [ utils.simaya.administrationRole ], echelon: "5"},
        { username: "a1", org: "A", echelon: "1a" },
        { username: "a2", org: "A", echelon: "1b"},
        { username: "aa", org: "A;A", echelon: "2a" },
        { username: "aa1", org: "A;A", echelon: "2a" },
        { username: "aa2", org: "A;A", echelon: "3b" },
        { username: "aa3", org: "A;A", echelon: "3c" },
        { username: "aaa", org: "A;A;A", echelon: "4d" },
        { username: "aaa1", org: "A;A;A", echelon: "5a" },
        { username: "aaa2", org: "A;A;A", echelon: "5b" },
        { username: "b", org: "B" },
        { username: "b1", org: "B" },
        { username: "bb1", org: "B;B" },
        { username: "bb2", org: "B;B" },
        { username: "bb3", org: "B;B" },
        { username: "bb4", org: "B;B" },
        { username: "tu.b", org: "B", roleList: [ utils.simaya.administrationRole ]},
        { username: "bbb1", org: "B;B;B" },
        { username: "bbb2", org: "B;B;B" },
        { username: "bbb3", org: "B;B;B" },
      ]
      async.series([
        function(cb) {
          clearUser(function(err, r) {
            clearDisposition(function(err, r) {
              clearOrganization(function(err, r) {
                clearNotification(cb);
              });
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
  });

  describe("Disposition[Creation]", function() {
    it ("should create", function(done) {
      disposition.create(dispositionData.simpleCreate, function() {
        done();
      });
    });
  });

  var id;
  describe("Disposition[Sharing]", function() {
    it ("should share with a single recipient", function(done) {
      var share = function(err, data) {
        id = data._id;
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

    it ("should list notification for a", function(done) {
      setTimeout(function() { // put timeout because notifications are fire and forget
      notification.get("a", function(data) {
        data.should.have.length(1);
        data[0].should.have.property("url");
        data[0].url.should.eql("/disposition/read/" + id);
        data[0].should.have.property("message");
        data[0].message.should.eql("@disposition-shared-sender");
        data[0].should.have.property("sender");
        data[0].sender.should.eql("a1");
        data[0].should.have.property("username");
        data[0].username.should.eql("a");
        done();
      });
      }, 500);
    });

    it ("should list notification for aa", function(done) {
      setTimeout(function() { // put timeout because notifications are fire and forget
      notification.get("aa", function(data) {
        data.should.have.length(1);
        data[0].should.have.property("url");
        data[0].url.should.eql("/disposition/read/" + id);
        data[0].should.have.property("message");
        data[0].message.should.eql("@disposition-shared-recipients");
        data[0].should.have.property("sender");
        data[0].sender.should.eql("a1");
        data[0].should.have.property("username");
        data[0].username.should.eql("aa");
        done();
      });
      }, 500);
    });



    it ("should not be shared by non-recipient of the disposition", function(done) {
      var share = function(err, data) {
        disposition.share(data._id, "aa", ["a2"], "omama", function(err, data) {
          should(err).be.ok;
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
        id = data._id;
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

    it ("should list notification for a", function(done) {
      setTimeout(function() { // put timeout because notifications are fire and forget
      notification.get("a", function(data) {
        data.should.have.length(2);
        var index = _.findIndex(data, { url: "/disposition/read/" + id, message: "@disposition-shared-sender", sender: "a1"});
        data[index].should.have.property("url");
        data[index].url.should.eql("/disposition/read/" + id);
        data[index].should.have.property("message");
        data[index].message.should.eql("@disposition-shared-sender");
        data[index].should.have.property("sender");
        data[index].sender.should.eql("a1");
        data[index].should.have.property("username");
        data[index].username.should.eql("a");
        done();
      });
      }, 500);
    });

    it ("should list notification for aa", function(done) {
      setTimeout(function() { // put timeout because notifications are fire and forget
      notification.get("aa", function(data) {
        var index = _.findIndex(data, { url: "/disposition/read/" + id, message: "@disposition-shared-recipients", sender: "a1", username: "aa"});
        data.should.have.length(2);
        data[index].should.have.property("url");
        data[index].url.should.eql("/disposition/read/" + id);
        data[index].should.have.property("message");
        data[index].message.should.eql("@disposition-shared-recipients");
        data[index].should.have.property("sender");
        data[index].sender.should.eql("a1");
        data[index].should.have.property("username");
        data[index].username.should.eql("aa");
        done();
      });
      }, 500);
    });

    it ("should list notification for aa", function(done) {
      setTimeout(function() { // put timeout because notifications are fire and forget
      notification.get("a2", function(data) {
        var index = _.findIndex(data, { url: "/disposition/read/" + id, message: "@disposition-shared-recipients", sender: "a1", username: "a2"});
        data.should.have.length(1);
        data[index].should.have.property("url");
        data[index].url.should.eql("/disposition/read/" + id);
        data[index].should.have.property("message");
        data[index].message.should.eql("@disposition-shared-recipients");
        data[index].should.have.property("sender");
        data[index].sender.should.eql("a1");
        data[index].should.have.property("username");
        data[index].username.should.eql("a2");
        done();
      });
      }, 500);
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

  describe("Disposition[Recipients]", function() {
    it ("should list recipients within org of A;A seen by aa", function(done) {
      disposition.candidates(["aa"], "A;A", function(err, data) {
        should(err).not.be.ok;
        data.should.have.length(1);
        data[0].should.have.property("label");
        data[0].label.should.eql("A;A");
        data[0].should.have.property("children");
        var c0 = data[0].children;
        c0.should.have.length(4);
        c0[0].should.have.property("label");
        c0[0].label.should.eql("aa1");
        c0[1].should.have.property("label");
        c0[1].label.should.eql("aa2");
        c0[2].should.have.property("label");
        c0[2].label.should.eql("aa3");
        c0[3].should.have.property("label");
        c0[3].label.should.eql("A;A;A");
        c0[3].should.have.property("children");
        var c1 = c0[3].children;
        c1[0].should.have.property("label");
        c1[0].label.should.eql("aaa");
        c1[1].should.have.property("label");
        c1[1].label.should.eql("aaa1");
        c1[2].should.have.property("label");
        c1[2].label.should.eql("aaa2");

        done();

      });
    });
    it ("should list recipients within org of A;A seen by aa and exclude aa1", function(done) {
      disposition.candidates(["aa", "aa1",], "A;A", function(err, data) {
        data.should.have.length(1);
        data[0].should.have.property("label");
        data[0].label.should.eql("A;A");
        data[0].should.have.property("children");
        var c0 = data[0].children;
        c0.should.have.length(3);
        c0[0].should.have.property("label");
        c0[0].label.should.eql("aa2");
        c0[1].should.have.property("label");
        c0[1].label.should.eql("aa3");
        c0[2].should.have.property("label");
        c0[2].label.should.eql("A;A;A");
        c0[2].should.have.property("children");
        var c1 = c0[2].children;
        c1[0].should.have.property("label");
        c1[0].label.should.eql("aaa");
        c1[1].should.have.property("label");
        c1[1].label.should.eql("aaa1");
        c1[2].should.have.property("label");
        c1[2].label.should.eql("aaa2");

        done();

      });
    });



    it ("should list recipients within org in A", function(done) {
      disposition.candidates(["a"], "A", function(err, data) {
        data.should.have.length(1);
        data[0].should.have.property("label");
        data[0].label.should.eql("A");
        data[0].should.have.property("children");
        var c0 = data[0].children;
        c0.should.have.length(4);
        _.findIndex(c0, {label: "a1"}).should.greaterThan(-1);
        _.findIndex(c0, {label: "a2"}).should.greaterThan(-1);
        _.findIndex(c0, {label: "tu.a"}).should.greaterThan(-1);
        c0[3].label.should.eql("A;A");
        c0[3].should.have.property("children");
        var c1 = c0[3].children;
        _.findIndex(c1, {label: "aa"}).should.greaterThan(-1);
        _.findIndex(c1, {label: "aa1"}).should.greaterThan(-1);
        _.findIndex(c1, {label: "aa2"}).should.greaterThan(-1);
        _.findIndex(c1, {label: "aa3"}).should.greaterThan(-1);
        c1[4].label.should.eql("A;A;A");
        c1[4].should.have.property("children");
        var c2 = c1[4].children;
        _.findIndex(c2, {label: "aaa"}).should.greaterThan(-1);
        _.findIndex(c2, {label: "aaa1"}).should.greaterThan(-1);
        _.findIndex(c2, {label: "aaa2"}).should.greaterThan(-1);

        done();

      });
    });
  });

});

