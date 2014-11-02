module.exports = Utils = function() {
  var mongodb = require('mongodb')
    , Db = mongodb.Db
    , Server = mongodb.Server
    , store = mongodb.GridStore
    , model = require('./node_modules/mongolia/lib/model')
    , validator = require('./node_modules/mongolia/lib/validator')
    , db = new Db(process.env.DB || 'simayamaster', new Server(process.env.HOST || 'localhost', 27017, {auto_reconnect: true, native_parser: true}), {safe: false, j:true})
    , ObjectID = db.bson_serializer.ObjectID

  var simaya = {
    administrationRole: 'tatausaha', 
    administratorEmail: 'Administrator Simaya <no-reply@layanan.go.id',
    url: 'https://simaya.layanan.go.id',
    smtp: {
      // Using all default values
      //service: 'Gmail',
      //host: '127.0.0.1',
      /*
      auth: {
        user: '',
        pass: '',
      }*/
    },
    gearmanServer: [
      { host: process.env.GEARMAN || "127.0.0.1" },
    ],
  }

  return {
    db: db
    , model: model
    , validator: validator
    , store: store
    , ObjectID: ObjectID
    , simaya: simaya
  }
}();
