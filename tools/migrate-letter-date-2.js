// This scripts migrates disposition's letterDate to native date format
// see issue #164
var settings = require('../settings.js')

var app = {
  db: function(modelName) {
    return settings.model(settings.db, modelName);
  }
  , ObjectID: settings.ObjectID
  , validator: settings.validator
}
var db = app.db("letter")
var spinner = ["/", "-", "|", "\\"];

var saved = 0;
var mod = function(index, data) {
  if (index == data.length) {
    console.log("Saved: ", saved, "of total", data.length);
    process.exit();
    return;
  }
  db.findOne({_id: data[index]._id}, function(e, item) {
    process.stdout.write(spinner[(index % 4)] + " -> " + index + "/" + data.length + "\r");
    var save = false;
    if (typeof(item.date) === "string") {
      var date = new Date(item.date);
      if (!isNaN(date.valueOf())) {
        item.date = date;
        save = true;
      } 
    }
    if (save) {
      saved ++;
      db.save(item, function() {
        mod(index + 1, data);
      });
    } else {
      mod(index + 1, data);
    }
  });
}

console.log("Standing by...");
settings.db.open(function(){
  db.findArray({}, {_id:1,date:1}, function(e, c) {
    mod(0, c);
  })

});
