module.exports = Utils = function() {

  var mongodb = require('mongodb')
    , Db = mongodb.Db
    , Server = mongodb.Server
    , Store = mongodb.GridStore
    , db = new Db('simaya-test', new Server("127.0.0.1", 27017, {auto_reconnect: true, native_parser: true}), {j:true})
    , ObjectID = mongodb.ObjectID
    , _ = require("lodash");

  var sinergisVar = {
    version: '0.4',
    appName: 'siMAYA'
  }

  var simaya = {
    administrationRole: 'tatausaha', 
  };

  var app = {
    simaya: simaya,
    dbClient: db,
    io: {
      sendPrivateMessage: function() {}
    },
    validator: require(__dirname + "/../node_modules/mongolia/lib/validator"),
    db: function(modelName) {
      if (app.mongolian){
        var mongolia = require(__dirname + "/../node_modules/mongolia/lib/model")(db, modelName);
        mongolia.beforeUpdate = function (query, update, callback) {
          update.updated_at = new Date();
          callback(null, query, update);
        };
        return mongolia;
      }
      var wrap = db.collection(modelName);
      wrap.getCollection = function(cb) {
        cb(null, wrap);
      };
      wrap.validateAndInsert = function(data, cb) {
        wrap.insert(data, function(err, result) {
          cb(err, {});
        });
      };
      wrap.findArray = function() {
        var args = _.clone(arguments);
        var findArgs = [];
        var cursorArgs = [];
        var index = 0;

        var selector = args[index++];
        findArgs.push(selector);

        var fields = args[index++];
        if (typeof(fields) === "function") {
          cursorArgs.push(fields);
        } else {
          findArgs.push(fields);
        }

        var last = args[index++];
        if (last) {
          cursorArgs.push(last);
        }

        var cursor = wrap.find.apply(wrap, findArgs);
        cursor.toArray.apply(cursor, cursorArgs);
      }
      return wrap; 
    }
    , ObjectID: ObjectID
    , store: function(fileId, name, mode, options) {
        return new Store(db, fileId, name || "empty", mode || 'w', options || {});
      }
    , get : function(key){
      if(key == 'sinergisVar') return sinergisVar
    }
  };

  return {
    app: app,
    db: db,
    simaya: simaya
  }
}()

