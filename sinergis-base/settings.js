module.exports = Utils = function() {
  var mongodb = require('mongodb')
    , Db = mongodb.Db
    , Server = mongodb.Server
    , model = require('./node_modules/mongolia/lib/model')
    , validator = require('./node_modules/mongolia/lib/validator')
    , db = new Db('sinergis', new Server('localhost', 27017, {auto_reconnect: true, native_parser: true}), {})
    , ObjectID = db.bson_serializer.ObjectID

  return {
    db: db
    , model: model
    , validator: validator
  }
}();
