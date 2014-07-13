// for deepcopy
window = {}
document = {}
module.exports = function(app) {
  // Private 
  var db = app.db('deputy');
  var moment = require('moment');
  var deepCopy = require('./deepCopy');
  var ObjectID = app.ObjectID;
  
  //
  // assignee
  // assignor
  // organization 
  // dateFrom
  // dateUntil
  // active
  // log

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

      if (typeof(update.assignee) === "undefined" || update.assignee == null) {
        validator.addError('Data', 'Deputy is not set');
      }
        
      if (typeof(update.assignor) === "undefined" || update.assignor == null) {
        validator.addError('Data', 'Assignor is not set');
      }

      if (typeof(update.organization) === "undefined" || update.organization == null) {
        validator.addError('Data', 'Organization is not set');
      }
        
      if (typeof(update.dateFrom) === "undefined" || update.dateFrom == null || update.dateFrom == "") {
        validator.addError('Data', 'dateFrom is not set');
      }
      
      if (typeof(update.dateUntil) == "undefined" || update.dateUntil== null || update.dateUntil == "") {
        validator.addError('Data', 'dateUntil is not set');
      }

      var now = moment(new Date());
      var then = moment(update.dateUntil);
      if (then.diff(now) < 0) {
        validator.addError('Data', 'No old dates');
      }

      var now = moment(update.dateFrom);
      var then = moment(update.dateUntil);
      if (then.diff(now) < 0) {
        validator.addError('Data', 'End date is more recent than start date');
      }
    }

    if (validator.isInserting()) {
      db.findOne({organization: update.organization, active: true, dateFrom: { $lte: update.dateUntil }, dateUntil: { $gte: update.dateFrom}}, {assignee: 1, _id: 0}, function(error, result){
        if (result != null) {
          validator.addError('Data', 'Deputy already assigned for the date range');
        }
        callback(null, validator); 
      });
    } else {
      callback(null, validator);
    }
  }
  
  // Public API
  return {
    // Assign a new deputy
    // Returns via callback
    //    validator: The validator
    assign: function (data, callback) {
      data.log = [ {date: new Date(), data: owl.deepCopy(data) } ] 
      db.getCollection(function (error, collection) {
        data._id = collection.pkFactory.createPk();

        db.validateAndInsert(data, function (error, validator) {
          validator.resultId = data._id;
          if (!validator.hasErrors()) {
            data.dateFrom.setUTCHours(0, 0, 0, 0);
            data.dateUntil.setUTCHours(0, 0, 0, 0);
          }
          callback(validator);
        }); 
      });
    },

    // Modifies deputy 
    // Returns via callback
    //    validator: The validator
    edit: function (id, data, callback) {
      id = id + "";
      db.findOne({_id: ObjectID(id)}, function(err, item) { 
        if (err == null && item != null) {
          // Log is concatenated, not replaced
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
          var doc = { _id: id};
          var validator = app.validator(doc, doc);
          validator.addError('data', 'Non-existant id');
          callback(validator);
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

    // Gets active deputy
    // Returns via callback
    getCurrent: function (organization, callback, testDate) {
      var now = testDate || new Date();
      now.setUTCHours(0, 0, 0);
      var search = {
        organization: organization,
        dateFrom: { $lte: now },
        dateUntil: { $gte: now },
      }
      db.findOne(search, function(err, item) {
        callback(item);
      });
    },

    // Deletes active deputy
    // Returns via a callback
    remove: function (organization, callback, testDate) {
      var now = testDate || new Date();
      now.setUTCHours(0, 0, 0, 0);
      var search = {
        organization: organization,
        dateFrom: { $lte: now },
        dateUntil: { $gte: now },
        active: true
      }
      db.remove(search, function(r) {
        callback();
      });
    },

    // Deletes certain deputy assignment 
    // Returns via a callback
    removeAssignment: function (id, callback) {
      var search = {
        _id: ObjectID(id),
      }
      db.remove(search, function(r) {
        callback();
      });
    },



    list: function(search, callback) {
      if (typeof(search.search) === "undefined") {
        search.search = {};
      }
        
      var fields = search["fields"] || {};
      if (typeof(search.page) !== "undefined") {
        var offset = ((search.page - 1) * search.limit);
        var limit = search.limit;
        if (typeof(limit) === "undefined") {
          limit = 10; // default limit
        }

        db.find(search.search, fields, function(error, cursor) {
          cursor.sort(search.sort || {dateFrom:-1}).limit(limit).skip(offset).toArray(function (error, result) {
            callback(result);
          });
        });
      } else {
        db.find(search.search, fields, function(error, cursor) {
          cursor.sort(search.sort || {dateFrom:-1}).toArray(function(error, result) {
            callback(result);
          });
        });
      } 
    },
 
  }
}
