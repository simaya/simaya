var settings = require('../settings.js')

var app = {
  db: function(modelName) {
    return settings.model(settings.db, modelName);
  }
  , ObjectID: settings.ObjectID
  , validator: settings.validator
}
var db = app.db("disposition")
var letter = app.db("letter")

var mod = function(index, data) {
  if (index == data.length) {
    process.exit();
    return;
  }
  letter.findOne({_id: settings.ObjectID(data[index].letterId)}, function(e, item) {
    console.log(data[index])
    if (item != null) {
      var save = false;
      if (item.receivingOrganizations) {
        for (var o in item.receivingOrganizations) {
        console.log(o);
          if (typeof(item.receivingOrganizations[o].firstDisposition) === "undefined") {
            console.log(data[index]._id);
            item.receivingOrganizations[o].firstDisposition = settings.ObjectID(data[index]._id + "");
            save = true;
          }
        }
      }
      if (save) {
        console.log(item._id);
        letter.save(item);
      }
    }
    mod(index + 1, data);
  });
}

db.findArray({}, {_id:1,letterId:1}, function(e, c) {
  mod(0, c);
})

