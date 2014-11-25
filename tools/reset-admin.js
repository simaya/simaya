var settings = require('../settings.js')

var app = {
  db: function(modelName) {
    return settings.model(settings.db, modelName);
  }
  , ObjectID: settings.ObjectID
  , validator: settings.validator
}
var user = require('../sinergis/models/user.js')(app);

settings.db.open(function(){
  user.changePassword('admin', 'password', function(v) {
    console.log("x");
    if (v.hasErrors() == false) {
      console.log("User is reset");
      process.exit();
    } else {
      console.log(v.errors);
      process.exit();
    }
  });
});

