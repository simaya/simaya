var should = require("should");
var _ = require("lodash");
var chance = require("chance").Chance(9); // use exactly same seed for deterministic tests
var utils = require(__dirname + "/../helper/utils");
var model = require(__dirname + "/../simaya/models/collectionLock.js")(utils.app);
var async = require("async");

var clearLock = function(cb) {
  var l = utils.app.db("collectionLock");
  l.remove({}, {j:false}, cb);
}

describe("Lock collection", function() {

  before(function(done) {
    var setup = function() {
      async.series([
        function(cb) {
          clearLock(cb);
        },
        ], function(e,v) {
          done();
        }
      );
    }
    if (utils.db.openCalled) {
      setup();
    } else {
      utils.db.open(function() {
        setup();
      });
    }

  });

  describe("Try lock", function() {
    var key;
    it ("should successfully lock a collection", function(done) {
      var expire = new Date;
      expire.setDate(expire.getDate() + 1);
      var data = {
        username: "abc",
        expire: expire,
        name: "model",
        module: "abc"
      }
      model.start(data, function(err, result) {
        key = result.key;
        should(err).not.be.ok;
        result.should.have.property("key");
        done();
      });
    });

    it ("should successfully check a locked collection", function(done) {
      var data = {
        name: "model",
      }
      model.check(data, function(err, result) {
        should(err).not.be.ok;
        result.should.have.property("name");
        result.should.have.property("username");
        result.should.not.have.property("key");
        result.should.not.have.property("_id");
        done();
      });
    });
 
    it ("should successfully check a bogus collection", function(done) {
      var data = {
        name: "modelabc",
      }
      model.check(data, function(err, result) {
        should(err).be.ok;
        done();
      });
    });
 
    it ("should successfully lock another collection", function(done) {
      var expire = new Date;
      expire.setDate(expire.getDate() + 1);
      var data = {
        username: "abc",
        expire: expire,
        name: "othermodel",
        module: "abc"
      }
      model.start(data, function(err, result) {
        should(err).not.be.ok;
        result.should.have.property("key");
        done();
      });
    });

    it ("should fail to lock the already locked collection", function(done) {
      var expire = new Date;
      expire.setDate(expire.getDate() + 1);
      var data = {
        username: "abc",
        expire: expire,
        name: "model",
        module: "abc"
      }
      model.start(data, function(err, result) {
        should(err).be.ok;
        done();
      });
    });

    it ("should fail to unlock with wrong key", function(done) {
      var key = new model.ObjectID();
      var data = {
        username: "abc",
        name: "model",
        key: key
      }
      model.finish(data, function(err, result) {
        should(err).be.ok;
        done();
      });
    });

    it ("should fail to unlock with wrong username", function(done) {
      var data = {
        username: "dabc",
        name: "model",
        key: key
      }
      model.finish(data, function(err, result) {
        should(err).be.ok;
        done();
      });
    });

    it ("should successfully unlock ", function(done) {
      var data = {
        username: "abc",
        name: "model",
        key: key
      }
      model.finish(data, function(err, result) {
        should(err).not.be.ok;
        done();
      });
    });


  });
});
