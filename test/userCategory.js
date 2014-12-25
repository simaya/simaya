var should = require("should");
var _ = require("lodash");
var path = require("path");
var os = require("os");
var utils = require(__dirname + "/../helper/utils");
var userCategory = require(__dirname + "/../simaya/models/userCategory.js")(utils.app);
var fs = require("fs");
var async = require("async");

describe("User Category", function() {
  
  before(function(done) {
    if (utils.db.openCalled) {
      return done();
    } else {
      utils.db.open(function() {
        return done();
      });
    }
  });

// what this UT does : 
// - list all user category
// - list specific user category
// - insert new user category
// - fail while insert existing category name
// - fail while insert invalid idLength
// - fail while insert categoryId without idLength
// - edit user category
// - fail while edit with existing category name
// - fail while edit  categoryId without idLength
// - remove use rcategory

  describe("Listing", function() {
    it ("should list all user category", function(done) {
      userCategory.list(function(data) {
        done();
      });
    });
    it ("should list specific user category", function(done) {
      userCategory.list({categoryName : "PNS"}, function(data) {
        data.should.have.length(1);
        data[0].should.have.properties(["categoryName", "categoryDesc", "categoryId", "idLength"]);
        done();
      });
    });
  });
  
  var userCategoryData = [
    {
      categoryName : "Outsourcing",
      categoryDesc : "Pegawai Outsourcing",
      categoryId : "Nomor Induk",
      idLength : "10"
    },
    {
      categoryName : "PNS",
      categoryDesc : "Pegawai Negeri Sipil",
      categoryId : "NIP",
      idLength : "18"
    },
    {
      categoryName : "AAA",
      categoryDesc : "Aaaa",
      categoryId : "BB",
      idLength : "XYZ"
    },
    {
      categoryName : "AAA",
      categoryDesc : "Aaaa",
      categoryId : "BB",
    },
    {
      categoryName : "Outsourcing",
      categoryDesc : "Pegawai Outsourcing",
      categoryId : "Nomor Registrasi",
      idLength : "5"
    },
    {
      categoryName : "PNS",
      categoryDesc : "Pegawai Outsourcing",
      categoryId : "Nomor Registrasi",
      idLength : "5"
    },
    {
      categoryName : "Outsourcing",
      categoryDesc : "Pegawai Outsourcing",
      categoryId : "Nomor Registrasi",
    },
    {
      categoryName : "Outsourcing PT. ABC",
      categoryDesc : "Pegawai Outsourcing",
      categoryId : "Nomor Registrasi",
      idLength : "5"
    },
  ]
  describe("Insert", function() {
    it ("should create user category", function(done) {
      userCategory.insert(userCategoryData[0], function() {
        done();
      });
    });
    it ("should fail while insert existing category name", function(done) {
      userCategory.insert(userCategoryData[1], function(err) {
        should(err).be.ok;
        err.should.have.property("categoryName");
        done();
      });
    });
    it ("should fail while insert invalid idLength", function(done) {
      userCategory.insert(userCategoryData[2], function(err) {
        should(err).be.ok;
        err.should.have.property("idLength");
        err.idLength.should.containEql("invalid idLength");
        done();
      });
    });
    it ("should fail while insert categoryId without idLength", function(done) {
      userCategory.insert(userCategoryData[3], function(err) {
        should(err).be.ok;
        err.should.have.property("idLength");
        err.idLength.should.containEql("idLength must not empty");
        done();
      });
    });
  });
  describe("User Category Edit", function() {
    it ("should modify a user category", function(done) {
      userCategory.insert(userCategoryData[0], function() {
        userCategory.edit(userCategoryData[0].categoryName, userCategoryData[4], function() {
          userCategory.list({categoryName : userCategoryData[0].categoryName}, function(result){
            should(result).be.ok;
            result[0].categoryId.should.containEql(userCategoryData[4].categoryId);
            result[0].idLength.should.containEql(userCategoryData[4].idLength);
            done();
          })
        });
      });
    });
    it ("should fail while edit with existing category name", function(done) {
      userCategory.insert(userCategoryData[0], function() {
        userCategory.edit(userCategoryData[0].categoryName, userCategoryData[5], function(err) {
          should(err).be.ok;
          err.should.have.property("categoryName");
          err.categoryName.should.containEql("already exists");
          done();
        });
      });
    });
    it ("should fail while edit a non-exist user category", function(done) {
      userCategory.insert(userCategoryData[0], function() {
        userCategory.edit(userCategoryData[7].categoryName, userCategoryData[7], function(err) {
          should(err).be.ok;
          err.should.have.property("categoryName");
          err.categoryName.should.containEql("non-existant category");
          done();
        });
      });
    });
  });
  describe("Delete", function() {
    it ("should remove a user category", function(done) {
      userCategory.insert(userCategoryData[0], function() {
        userCategory.remove(userCategoryData[0].categoryName, function(){
          userCategory.list({categoryName:userCategoryData[0].categoryName}, function(item){
            item.should.have.length(0);
            done();
          });
        });
      });
    });
  });
});

