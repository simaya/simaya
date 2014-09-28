// This scripts migrates disposition's letterDate to native date format
// see issue #127
var settings = require('../settings.js')

var app = {
  db: function(modelName) {
    return settings.model(settings.db, modelName);
  }
  , ObjectID: settings.ObjectID
  , validator: settings.validator
}
var db = app.db("disposition")

var saved = 0;
var mod = function(index, data) {
  if (index == data.length) {
    console.log("Saved: ", saved, "of total", data.length);
    process.exit();
    return;
  }
  db.findOne({_id: data[index]._id}, function(e, item) {
    var save = false;
    if (item.letterDate) {
      var date = new Date(item.letterDate);
      if (!isNaN(date.valueOf())) {
        item.letterDate = date;
        save = true;
      } else {
        var da = item.letterDate.split(", ");
        var mx = {
          "Januari": 1,
          "Februari": 2,
          "Maret": 3,
          "April": 4,
          "Mei": 5,
          "Juni": 6,
          "Juli": 7,
          "Agustus": 8,
          "September": 9,
          "Oktober": 10,
          "Nopember": 11,
          "Desember": 12,
        }
        var dx = da[1].trim().split(" ");
        var d = parseInt(dx[0]);
        var m = mx[dx[1]] - 1;
        var y = dx[2];
        
        var dy = new Date(y, m, d);
        if (!isNaN(dy.valueOf())) {
          item.letterDate = dy;
          save = true;
        } else {
          console.log("FAILED:", item._id, item.letterDate);
        }
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
  db.findArray({}, {_id:1,letterDate:1}, function(e, c) {
    mod(0, c);
  })

});
