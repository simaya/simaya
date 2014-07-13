// for deepcopy
window = {}
document = {}
module.exports = function(app) {
  // Private 
  var db = app.db('announcement');
  var deepCopy = require('./deepCopy');
  var ObjectID = app.ObjectID;
  
  // Validation function
  db.validate = function(document, update, callback) {
    var validator = app.validator(document, update);
   
    if (validator.isUpdating()) {
      update = owl.deepCopy(update.$set);
    }

    if (validator.isInserting() || validator.isUpdating()) {
      // Check completeness of data
      
      if (typeof(update.active) === "undefined" || update.active == null) {
        validator.addError('Data', 'Active state is not set');
      }

      if (typeof(update.message) === "undefined" || update.message == null) {
        validator.addError('Data', 'Message is not set');
      }
    }

    callback(null, validator); 
  }
  
  // Public API
  return {
    // Modifies announcement
    // Returns via callback
    //    validator: The validator
    edit: function (id, data, callback) {
      db.findOne({_id: ObjectID(id + "")}, function(err, item) { 
        if (err == null && item != null) {
          var updateData = [ {date: new Date(), data: owl.deepCopy(data) } ] 
          data.log = item.log.concat(updateData);
          delete (data._id);
          db.validateAndUpdate( {
            _id: item._id
          }, {
            '$set': data 
          }, function (error, validator) {
            callback(validator);
          }); 
       } else {
          data.log = [ {date: new Date(), data: owl.deepCopy(data) } ] 
          db.getCollection(function (error, collection) {
            data._id = collection.pkFactory.createPk();

            db.validateAndInsert(data, function (error, validator) {
              validator.resultId = data._id;
              callback(validator);
            }); 
          });
       }
      });
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

    // Gets active announcement 
    // Returns via callback
    getCurrent: function (callback) {
      var search = {
      }
      db.findOne(search, function(err, item) {
        callback(item);
      });
    },

    // Deletes active announcement 
    // Returns via a callback
    remove: function (callback) {
      var search = {
        active: true
      }
      db.remove(search, function(r) {
        callback();
      });
    },
  }
}
