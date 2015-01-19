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

var user = app.db("user")
var spinner = ["/", "-", "|", "\\"];
var saved = 0;
var mod = function(index, data) {
  if (index == data.length) {
    console.log("Saved: ", saved, "of total", data.length);
    process.exit();
    return;
  }
  user.findOne({_id: data[index]._id}, function(e, item) {
    process.stdout.write(spinner[(index % 4)] + " -> " + index + "/" + data.length + "\r");
    var save = false;
    if (item && item.username != "admin") {
      item.username = "u"+settings.simaya.installationId+":"+item.username;
      save = true;
    } 
    if (save) {
      saved ++;
      user.save(item, function() {
        mod(index + 1, data);
      });
    } else {
      mod(index + 1, data);
    }
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
          user.findArray({}, {_id:1,date:1}, function(e, c) {
            mod(0, c);
          })
      });
    });
  });
});
