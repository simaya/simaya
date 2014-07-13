var settings = require('../settings.js')

var app = {
  db: function(modelName) {
    return settings.model(settings.db, modelName);
  }
  , ObjectID: settings.ObjectID
  , validator: settings.validator
}
var user = require('../sinergis/models/user.js')(app);

function bulkInsert(user, counter, callback) {
  user.create('user'+counter, 'password', function(e,v) {
    if (counter > 10) {
      console.log("10 Users created");
      process.exit();
    }
    bulkInsert(user, counter + 1, callback);
  });
}

bulkInsert(user, 1, function(){});

