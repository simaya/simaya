module.exports = function(app) {
  // Private 
  var db = app.db('calendar');
  var moment = require('moment');
  var fs = require('fs');
  var ObjectID = app.ObjectID;
  
  // Validation function
  db.validate = function(document, update, callback) {
    var validator = app.validator(document, update);
   
    if (validator.isInserting()) {
      if (update && (typeof(update.start) === "undefined" || update.start == null)) {
        validator.addError('Data', 'Start date is not defined');
      }

      if (update && update.start && update.end) {
        var a = moment(update.start);
        var b = moment(update.end);
        if (b.diff(a) < 0) {
          validator.addError('Data', 'End date is more recent than start date');
        }
      }
    }

    callback(null, validator);
  }
  
  db.beforeInsert = function (documents, callback) {
    var docLength = documents.length + 0
      , docCount = 0
    documents.forEach(function (doc) {
      docCount ++
      if (doc.fileAttachments != null) {
        var attachmentLength = doc.fileAttachments.length
          , attachmentCount = 0
        doc.fileAttachments.forEach(function(e, i){
          // Save fileAttachments element and replace with _id
          var fileId = new ObjectID();
          var store = app.store(fileId, e.name, 'w');
          var fd = fs.openSync(e.path, 'r');
          store.open(function(error, gridStore){
            gridStore.writeFile(fd, function(error, result){
              attachmentCount ++
              // Remove uploaded file
              fs.unlinkSync(e.path);
              
              doc.fileAttachments[i].path = result.fileId;
              doc.fileAttachments[i].name = e.name;
              doc.fileAttachments[i].type = e.type;
              if (docCount == docLength &&
                  attachmentCount == attachmentLength) {
                callback(null, documents);
              }
            });
          });
        });
      } else {
        callback(null, documents);
      }
    });
  };
  
  db.beforeUpdate = function(query, update, callback) {
    var doc = update.$set;
    if (doc.fileAttachments != null) {
      var lastFile = doc.fileAttachments.slice(-1)[0];
      doc.fileAttachments.forEach(function(e, i){
        if (typeof(e.path) !== "object") {
          // Save fileAttachments element and replace with _id
          var fileId = new ObjectID();
          var store = app.store(fileId, e.name, 'w');
          var fd = fs.openSync(e.path, 'r');
          store.open(function(error, gridStore){
            gridStore.writeFile(fd, function(error, result){
              // Remove uploaded file
              fs.unlinkSync(e.path);
                
              doc.fileAttachments[i].path = result.fileId;
              doc.fileAttachments[i].name = e.name;
              doc.fileAttachments[i].type = e.type;
              if (e == lastFile) {
                callback(null, query, update);
              }
            });
          }); 
        } else {
          if (e == lastFile) {
            callback(null, query, update);
          }
        }
      });
    } else {
      callback(null, query, update);
    }
  }

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
      db.validateAndUpdate( {
        _id: ObjectID(id + "")
      }, {
        '$set': data 
      }, function (error, validator) {
        callback(validator);
      }) 
    },

    // Download file attachment
    // Return a callback
    //    result: file stream
    downloadAttachment: function(fileId, stream, callback) {
      // Find letter title for this file
      db.findOne({'fileAttachments.path': ObjectID(fileId)}, {fileAttachments: 1, _id: 0}, function(error, item){
        if (item != null) {
          item.fileAttachments.forEach(function(e) {
            if (e.path == fileId) {
              stream.contentType(e.type);
              stream.attachment(e.name);
              var store = app.store(ObjectID(fileId), e.name, 'r');
              store.open(function(error, gridStore) {
                // Grab the read stream
                var gridStream = gridStore.stream(true);
                gridStream.pipe(stream);
              }); 
            }
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

    // List 
    // Returns via callback
    list: function (search, callback) {
      db.find(search.search, function(err, cursor) { 
        cursor.sort(search.sort || {end:-1}).limit(search.limit || 10).skip(search.offset || 0).toArray(function (error, result) {
          callback(result);
        })
      });
    },

    // Cancel an invitation
    cancelInvitation: function(id, user, callback) {
      db.findArray({ _id: ObjectID(id + "")}, function (error, result) {
        if (result != null && result.length > 0) {
          var accepters = result[0].accepters || [];
          var newAccepters = [];
          for (var i = 0; i < accepters.length; i ++) {
            if (accepters[i] != user) {
              newAccepters.push(accepters[i]);
            }
          }
          result[0].accepters = newAccepters;
          db.save(result[0], callback);
        } else {
          callback();
        }
      });
    },

    // Cancel an invitation
    declineInvitation: function(id, user, callback) {
      db.findArray({ _id: ObjectID(id + "")}, function (error, result) {
        if (result != null && result.length > 0) {
          var decliners = result[0].decliners || [];
          var newDecliners = [];
          for (var i = 0; i < decliners.length; i ++) {
            if (decliners[i] != user) {
              newDecliners.push(decliners[i]);
            }
          }
          // put in the back
          newDecliners.push(user);
          result[0].decliners = newDecliners;
          db.save(result[0], callback);
        } else {
          callback();
        }
      });
    },

    // Accepts an invitation
    acceptInvitation: function(id, user, callback) {
      db.findArray({ _id: ObjectID(id + "")}, function (error, result) {
        if (result != null && result.length > 0) {
          var accepters = result[0].accepters || [];
          var newAccepters = [];
          for (var i = 0; i < accepters.length; i ++) {
            if (accepters[i] != user) {
              newAccepters.push(accepters[i]);
            }
          }
          // put in the back
          newAccepters.push(user);
          result[0].accepters = newAccepters;
          db.save(result[0], callback);
        } else {
          callback();
        }
      });
    },

    // Removes an invitation
    removeInvitation: function(id, user, callback) {
      db.remove({ _id: ObjectID(id + ""), user: user}, function (error, result) {
        callback();
      });
    },

  }
}
