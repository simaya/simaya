module.exports = function() {
  var mongo = require("mongodb");
  var Db = mongodb.Db;
  var mongoServer = mongodb.Server;

  var db = new Db(process.env.DB || "ob", new mongoServer("localhost", 27017, {auto_reconnect: true, native_parser: true}), {safe: false});
  var ObjectID = db.bson_serializer.ObjectID;

  return {
    db: db,
    ObjectID: ObjectID
  }
}();
