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

console.log("Standing by...");
settings.db.open(function(){
  set("letter", function(err, result) {
    if (err) console.log(err);
    set("user", function(err, result) {
      if (err) console.log(err);
      set("organization", function(err, result) {
        if (err) console.log(err);
        process.exit();
      });
    });
  });

});
