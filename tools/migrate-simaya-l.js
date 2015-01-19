// This scripts gives modifiedDate field for simaya L 
var settings = require('../settings.js')

var app = {
  db: function(modelName) {
    return settings.model(settings.db, modelName);
  }
  , ObjectID: settings.ObjectID
  , validator: settings.validator
}

var set = function(name, cb) {
  var date = new Date(0);
  var db = app.db(name);
  db.update({}, {
    $set: { modifiedDate: date }
  }, { multi: true }, cb)
}

var user = app.db("user");
var jobTitle = app.db("jobTitle");
var organization = app.db("organization");

var spinner = ["/", "-", "|", "\\"];
var saved = 0;
var markUser = function(index, data) {
  if (index == data.length) {
    console.log("Users -> saved: ", saved, "of total", data.length);
    markJobTitles();
  } else {
    user.findOne({_id: data[index]._id}, function(e, item) {
      process.stdout.write(spinner[(index % 4)] + " -> " + index + "/" + data.length + "\r");
      var save = false;
      item.origin = settings.simaya.installationId;
      if (item && item.username != "admin") {
        item.username = "u"+settings.simaya.installationId+":"+item.username;
      } 
      save = true;
      if (save) {
        saved ++;
        user.save(item, function() {
          markUser(index + 1, data);
        });
      } else {
        markUser(index + 1, data);
      }
    });
  }
}
var markJobTitle = function(index, data) {
  if (index == data.length) {
    console.log("jobTitle -> saved: ", saved, "of total", data.length);
    markOrganizations();
  } else {
    jobTitle.findOne({_id: data[index]._id}, function(e, item) {
      process.stdout.write(spinner[(index % 4)] + " -> " + index + "/" + data.length + "\r");
      var save = false;
      item.origin = settings.simaya.installationId;
      save = true;
      if (save) {
        saved ++;
        jobTitle.save(item, function() {
          markJobTitle(index + 1, data);
        });
      } else {
        markJobTitle(index + 1, data);
      }
    });
  }
}
var markOrganization = function(index, data) {
  if (index == data.length) {
    console.log("organization -> saved: ", saved, "of total", data.length);
    process.exit();
    return;
  } else {
    organization.findOne({_id: data[index]._id}, function(e, item) {
      process.stdout.write(spinner[(index % 4)] + " -> " + index + "/" + data.length + "\r");
      var save = false;
      item.origin = settings.simaya.installationId;
      save = true;
      if (save) {
        saved ++;
        organization.save(item, function() {
          markOrganization(index + 1, data);
        });
      } else {
        markOrganization(index + 1, data);
      }
    });
  }
}
var markUsers = function(){
  saved = 0;
  user.findArray({}, {_id:1,date:1}, function(e, c) {
    markUser(0, c);
  });
}
var markJobTitles = function(){
  saved = 0;
  jobTitle.findArray({}, {_id:1,date:1}, function(e, c) {
    markJobTitle(0, c);
  });
}
var markOrganizations = function(){
  saved = 0;
  organization.findArray({}, {_id:1,date:1}, function(e, c) {
    markOrganization(0, c);
  });
}
console.log("Standing by...");
settings.db.open(function(){
  set("letter", function(err, result) {
    if (err) console.log(err);
    set("user", function(err, result) {
      if (err) console.log(err);
      set("organization", function(err, result) {
        if (err) console.log(err);
        markUsers();
      });
    });
  });
});
