module.exports = function(app) {
  // Private 
  var db = app.db('calendarAlarm');
  var moment = require('moment');
  var ObjectID = app.ObjectID;
  
  // Public API
  return {
    create: function (data, callback) {
      db.getCollection(function (error, collection) {
        data._id = collection.pkFactory.createPk();

        db.validateAndInsert(data, function (error, validator) {
          validator.resultId = data._id;
          if (!validator.hasErrors()) {
          }
          callback(validator);
        }); 
      });
    },

    // Modifies calendar 
    // Returns via callback
    //    validator: The validator
    edit: function (id, data, callback) {
      delete(data._id);
      db.update( {
        calendarId: ObjectID(id + "")
      }, {
        '$set': data 
      }, {
        upsert: true
      }, function (error) {
        console.log(id);
        console.log(data);
        callback(error);
      }) 
    },

    // Gets info 
    // Returns via callback
    getInfo: function (id, callback) {
      var search = {
        _id: ObjectID(id)
      }

      db.findOne(search, function(err, item) { 
        callback(item);
      });
    },

    // Remove notification 
    // Returns via callback
    remove: function (id, callback) {
      var search = {
        calendarId: ObjectID(id+"")
      }

      db.remove(search, function(err) { 
        callback(err);
      });
    },


    // List 
    // Returns via callback
    list: function (search, callback) {
      db.find(search.search, function(err, cursor) { 
        cursor.sort(search.sort || {time:-1}).toArray(function (error, result) {
          callback(result);
        })
      });
    },
  }
}
