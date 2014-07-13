module.exports = function() {
  var mongodb = require("mongodb");
  var Db = mongodb.Db;
  var mongoServer = mongodb.Server;

  var db = new Db("obtest", new mongoServer("127.0.0.1", 27017, {auto_reconnect: true, native_parser: true}), {safe: false});
  var ObjectID = db.bson_serializer.ObjectID;

  var store = function(id, filename, mode, options) {
    return new mongodb.GridStore(db, id, filename, mode, options);
  }

  return {
    db : db, 
    store : store, 
    ObjectID : ObjectID
  }
}();
