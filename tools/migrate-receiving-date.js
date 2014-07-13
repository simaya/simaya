var settings = require('../settings.js')

var app = {
  db: function(modelName) {
    return settings.model(settings.db, modelName);
  }
  , ObjectID: settings.ObjectID
  , validator: settings.validator
}
var db = app.db("letter")

var mod = function(index, data) {
  if (index == data.length) {
    return;
  }
  db.findOne({_id: data[index]._id}, function(e, item) {
    var save = false;
    if (item.receivedDate && item.receivingOrganizations) {
      for (var o in item.receivingOrganizations) {
        if (item.receivingOrganizations[o].status == 6) {
          console.log(item.receivingOrganizations[o]);
          item.receivingOrganizations[o].date = item.receivedDate; 
          save = true;
        }
      }
    }
    if (item.outgoingAgenda) {
      item.outgoingDate = item.date;
      save = true;
    }
    if (save) {
      console.log(item._id);
      db.save(item);
    }
    mod(index + 1, data);
  });
}

db.findArray({}, {_id:1,receivedDate:1,receivingOrganizations:1}, function(e, c) {
  mod(0, c);
})

