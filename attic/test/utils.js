module.exports = Utils = function() {
  var mongodb = require('mongodb')
    , Db = mongodb.Db
    , Server = mongodb.Server
    , store = mongodb.GridStore
    , model = require('../node_modules/mongolia/lib/model')
    , validator = require('../node_modules/mongolia/lib/validator')
    , db = new Db('simaya-test', new Server('localhost', 27017, {auto_reconnect: true, native_parser: true}), {})
    , ObjectID = db.bson_serializer.ObjectID

  var sinergisVar = {
    version: '0.3',
    appName: 'siMAYA'
  }

  var app = {
    db: function(modelName) {
      return model(db, modelName);
    }
    , ObjectID: ObjectID
    , validator: validator
    , store: function(fileId) {
        return store(db, fileId, 'w');
      }
    , get : function(key){
      if(key == 'sinergisVar') return sinergisVar
    }
  };

  return {
    app: app,
    db: db,

    checkError: function(test, validator, field, id) {
      if (validator.hasErrors()) {
        var errorCaught = false;
        var errorString = "";
        for (var checkingField in validator.errors) {
          // we must find field with exact id 
          if (checkingField == field 
              && validator.errors[field] == id) {
              errorCaught = true;
              break;
          }
          errorString += field + ":" + validator.errors[field] + "\n"; // otherwise collect all errors and spit em out later
        }
        test.ok(errorCaught, errorString);
      } else {
        test.ok(false, "This negative test was successfull while it should be failed");
      }
    }
  }
}()

