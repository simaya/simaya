var utils = require('./utils.js');
var deputy = require('../simaya/models/deputy.js')(utils.app);

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

  "create": function(test) {
    var from = new Date();
    var until = new Date();
    until.setDate(until.getDate()+1);

    var data = {
      assignee: "assignee",
      organization: "P1;P2;P3",
      assignor: "assignor",
      dateFrom: from,
      dateUntil: until,
      active: true
    }  
        
    deputy.assign(data, function (v) {
      if (v.hasErrors()) {
        console.log(v.errors)
      }
      test.ok(!v.hasErrors(), "Deputy creation is failed");
      test.done();
    });
  },

  "create with wrong start date": function(test) {
    var from = new Date();
    var until = new Date();
    from.setDate(from.getDate()+1);

    var data = {
      assignee: "assignee",
      organization: "P1;P2;P3",
      assignor: "assignor",
      dateFrom: from,
      dateUntil: until,
      active: true
    }  
        
    deputy.assign(data, function (v) {
      if (v.hasErrors()) {
        console.log(v.errors)
      }
      test.ok(v.hasErrors(), "Deputy creation is failed");
      test.done();
    });
  },

  "create with wrong end date": function(test) {
    var from = new Date();
    from.setDate(from.getDate()-2);
    var until = new Date();
    until.setDate(until.getDate()-1);

    var data = {
      assignee: "assignee",
      organization: "P1;P2;P3",
      assignor: "assignor",
      dateFrom: from,
      dateUntil: until,
      active: true
    }  
        
    deputy.assign(data, function (v) {
      if (v.hasErrors()) {
        console.log(v.errors)
      }
      test.ok(v.hasErrors(), "Deputy creation is failed");
      test.done();
    });
  },

  // Overlaps in the middle 
  "create duplicate deputies 1": function(test) {
    var from = new Date();
    from.setDate(from.getDate()+3);
    var until = new Date();
    until.setDate(until.getDate()+6);

    var data = {
      assignee: "assignee",
      organization: "P1;P2;P3",
      assignor: "assignor",
      dateFrom: from,
      dateUntil: until,
      active: true
    }  
        
    deputy.assign(data, function (v) {
      if (v.hasErrors()) {
        console.log(v.errors)
      }
      test.ok(!v.hasErrors(), "Deputy creation is failed");
      var from = new Date();
      from.setDate(from.getDate()+4);
      var until = new Date();
      until.setDate(until.getDate()+5);

      data.dateFrom = from;
      data.dateUntil = until;
      deputy.assign(data, function (v) {
        if (v.hasErrors()) {
          console.log(v.errors)
        }
        test.ok(v.hasErrors(), "Duplicate deputy creation should fail");
        test.done();
      });
    });
  },

  // Overlaps at the start
  "create duplicate deputies 2": function(test) {
    var from = new Date();
    from.setDate(from.getDate()+13);
    var until = new Date();
    until.setDate(until.getDate()+16);

    var data = {
      assignee: "assignee",
      organization: "P1;P2;P3",
      assignor: "assignor",
      dateFrom: from,
      dateUntil: until,
      active: true
    }  
        
    deputy.assign(data, function (v) {
      if (v.hasErrors()) {
        console.log(v.errors)
      }
      test.ok(!v.hasErrors(), "Deputy creation is failed");
      var from = new Date();
      from.setDate(from.getDate()+12);
      var until = new Date();
      until.setDate(until.getDate()+15);

      data.dateFrom = from;
      data.dateUntil = until;
      deputy.assign(data, function (v) {
        if (v.hasErrors()) {
          console.log(v.errors)
        }
        test.ok(v.hasErrors(), "Duplicate deputy creation should fail");
        test.done();
      });
    });
  },

  // Overlaps at the end
  "create duplicate deputies 3": function(test) {
    var from = new Date();
    from.setDate(from.getDate()+23);
    var until = new Date();
    until.setDate(until.getDate()+26);

    var data = {
      assignee: "assignee",
      organization: "P1;P2;P3",
      assignor: "assignor",
      dateFrom: from,
      dateUntil: until,
      active: true
    }  
        
    deputy.assign(data, function (v) {
      if (v.hasErrors()) {
        console.log(v.errors)
      }
      test.ok(!v.hasErrors(), "Deputy creation is failed");
      var from = new Date();
      from.setDate(from.getDate()+24);
      var until = new Date();
      until.setDate(until.getDate()+27);

      data.dateFrom = from;
      data.dateUntil = until;
      deputy.assign(data, function (v) {
        if (v.hasErrors()) {
          console.log(v.errors)
        }
        test.ok(v.hasErrors(), "Duplicate deputy creation should fail");
        test.done();
      });
    });
  },

  // Overlaps exactly
  "create duplicate deputies 4": function(test) {
    var from = new Date();
    from.setDate(from.getDate()+33);
    var until = new Date();
    until.setDate(until.getDate()+36);

    var data = {
      assignee: "assignee",
      organization: "P1;P2;P3",
      assignor: "assignor",
      dateFrom: from,
      dateUntil: until,
      active: true
    }  
        
    deputy.assign(data, function (v) {
      if (v.hasErrors()) {
        console.log(v.errors)
      }
      test.ok(!v.hasErrors(), "Deputy creation is failed");
      var from = new Date();
      from.setDate(from.getDate()+33);
      var until = new Date();
      until.setDate(until.getDate()+36);

      data.dateFrom = from;
      data.dateUntil = until;
      deputy.assign(data, function (v) {
        if (v.hasErrors()) {
          console.log(v.errors)
        }
        test.ok(v.hasErrors(), "Duplicate deputy creation should fail");
        test.done();
      });
    });
  },

  "get active": function(test) {
    var from = new Date();
    from.setDate(from.getDate()+43);
    var until = new Date();
    until.setDate(until.getDate()+46);

    var data = {
      assignee: "assignee",
      organization: "P1;P2;P3",
      assignor: "assignor",
      dateFrom: from,
      dateUntil: until,
      active: true
    }  
        
    deputy.assign(data, function (v) {
      if (v.hasErrors()) {
        console.log(v.errors)
      }
      test.ok(!v.hasErrors(), "Deputy creation is failed");

      var testDate = new Date();
      testDate.setDate(testDate.getDate() + 46);
      deputy.getCurrent("P1;P2;P3", function (item) {
        test.ok(item != null && item.active == true, "Get active must succeed");
        test.done();
      }, testDate);
    });
  },

  "edit": function(test) {
    var testDate = new Date();
    testDate.setDate(testDate.getDate() + 46);
    deputy.getCurrent("P1;P2;P3", function (item) {
      item.assignor =  "assignor1";
      deputy.edit(item._id, item, function(v) {
        if (v.hasErrors()) {
          console.log(v.errors);
        }
        test.ok(!v.hasErrors(), "Deputy editing is failed");
        test.done();
      });
    }, testDate);
  },

  "edit end date": function(test) {
    var testDate = new Date();
    testDate.setDate(testDate.getDate() + 46);
    deputy.getCurrent("P1;P2;P3", function (item) {
      var until = new Date();
      until.setDate(until.getDate() + 45);
      item.assignor =  "assignor1";
      item.dateUntil = until;
      deputy.edit(item._id, item, function(v) {
        if (v.hasErrors()) {
          console.log(v.errors);
        }
        test.ok(!v.hasErrors(), "Deputy editing is failed");
        test.done();
      });
    }, testDate);
  },

  "edit with wrong end date": function(test) {
    var testDate = new Date();
    testDate.setDate(testDate.getDate() + 45);
    deputy.getCurrent("P1;P2;P3", function (item) {
      var until = new Date();
      item.assignor =  "assignor1";
      item.dateUntil = until;
      deputy.edit(item._id, item, function(v) {
        if (v.hasErrors()) {
          console.log(v.errors);
        }
        test.ok(v.hasErrors(), "Deputy editing is failed");
        test.done();
      });
    }, testDate);
  },

  "delete": function(test) {
    var testDate = new Date();
    testDate.setDate(testDate.getDate() + 45);
    deputy.remove("P1;P2;P3", function () {
      deputy.getCurrent("P1;P2;P3", function(item) {
        test.ok(item == null || item.active == false, "Deputy removal has failed");
        test.done();
      }, testDate);
    }, testDate);
  },


}

var numberOfTests = Object.keys(testCases).length;
var numberOfTestsRun = numberOfTests; 
module.exports = testCases;
