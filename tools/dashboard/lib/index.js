var path = require ("path");
var prefix = path.resolve (__dirname + "/../../..");

var mongodb = require("mongodb");
var Db = mongodb.Db;
var Server = mongodb.Server;
var store = mongodb.GridStore;
var model = require(prefix + "/node_modules/mongolia/lib/model");
var db = new Db(process.env.DB || "simaya", new Server("localhost", 27017, {auto_reconnect: true, native_parser: true}), { safe : false});
var ObjectID = db.bson_serializer.ObjectID;

module.exports = (function() {

  var app = {

    db : function(modelName) {
      return model(db, modelName);
    },

    ObjectID: ObjectID,

    store: function(fileId) {
      return store(db, fileId, "w");
    },

    get : function(key){
      if(key == "sinergisVar") return sinergisVar;
    }
  };

  return {
    app: app,
    db: db
  }
})();

