var utils = require('./utils.js');
var timeline = require('../simaya/models/timeline.js')(utils.app);
var cache = require('../simaya/models/cache.js')(utils.app);

testCases = {
  setUp: function(callback) {
    utils.db.open(function() {
      if(numberOfTestsRun == numberOfTests) {
        // Drop database in the first run 
        utils.db.dropDatabase(function(err, done) {
          callback();  
        });                
      } else {
        callback();        
      }    
    });
  },

  tearDown: function(callback) {
    numberOfTestsRun = numberOfTestsRun - 1;

    utils.db.close();
    callback();
  },

  "insert": function(test) {
    var data = {
      date: new Date()
      , user: "abc"
      , presenceText: "Ola"
    }  
        
    timeline.insert(data, function (e) {
      if (e) {
        console.log(e)
      }
      test.ok(!e, "timeline creation is failed");
      timeline.list({getCount: true, search: {user: "abc"}}, function(count) {
        test.ok(count == 1, "timeline size must be 1, got " + count);
        timeline.list({search: {user: "abc"}}, function(result) {
          test.ok(result[0].user == "abc", "First record must be abc, got " + result[0].user);
          test.done();
        });
      });
    });
  },

  "comments": function(test) {
    var data = {
      date: new Date()
      , user: "abcok"
      , presenceText: "Ola"
    }  
        
    timeline.insert(data, function (e) {
      timeline.list({search: {user: "abcok"}}, function(result) {
        var id = result[0]._id;

        var comment = {
          id: id,
          user: "friend1",
          date: new Date(),
          text: "Comment1" 
        }
        timeline.comment(comment, function(result) {
          test.ok(result == true, "Comment result must be true");
          timeline.list({search: {_id: id}}, function(result) {
            
            test.ok(result[0].comments && result[0].comments.length == 1, "Comment length must be 1");
            test.done();
          });
        });
      });
    });
  },

  "loves": function(test) {
    var data = {
      date: new Date()
      , user: "abcokok"
      , presenceText: "Ola"
    }  
        
    timeline.insert(data, function (e, id) {
      var love = {
        id: id,
        user: "friend1",
        date: new Date(),
      }
      timeline.love(love, function() {
        timeline.list({search: {_id: id}}, function(result) {
          
          test.ok(result[0].loves && Object.keys(result[0].loves).length == 1, "Love length must be 1, got " + result[0].loves.length);
          test.ok(result[0].loves["friend1"], "Love friend1 must exist");
          test.done();
        });
      });
    });
  },

  "unloves": function(test) {
    var data = {
      date: new Date()
      , user: "abcokokok"
      , presenceText: "Ola"
    }  
        
    timeline.insert(data, function (e, id) {
      var love = {
        id: id,
        user: "friend1",
        date: new Date(),
      }
      timeline.love(love, function() {
        timeline.list({search: {_id: id}}, function(result) {
          test.ok(result[0].loves["friend1"], "Love friend1 must exist");
          love.id = id;
          timeline.unlove(love, function(result) {
            test.ok(result == true, "unlove() must return true");
            test.done();
          });
        });
      });
    });
  }


}

var numberOfTests = Object.keys(testCases).length;
var numberOfTestsRun = numberOfTests; 
module.exports = testCases;
