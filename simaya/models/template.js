module.exports = function(app) {
  // Private
  var db = app.db('template');
  var user = app.db('user');
  var ObjectID = app.ObjectID;
  var fs = require('fs');
  
  db.validate = function(document, update, callback) {
    var validator = app.validator(document, update);
    
    if (validator.isInserting()) {
      user.findOne({username: update.creator }, {username: 1, _id: 0}, function(error, result){
        if (result == null) {
          validator.addError('Data', 'User user not exist');
        }
        callback(null, validator);
      });
    } else {
      callback(null, validator);
    }
  }
  
  db.beforeInsert = function (documents, callback) {
    documents.forEach(function (doc) {
      if (doc.letterhead != null) {
        // Save fileAttachments element and replace with _id
        var fileId = new ObjectID();
        var store = app.store(fileId, "", 'w');
        var fd = fs.openSync(doc.letterhead.path, 'r');
        store.open(function(error, gridStore){
          gridStore.writeFile(fd, function(error, result){
            // Remove uploaded file
            fs.unlinkSync(doc.letterhead.path);
              
            doc.letterhead.path = result.fileId;
            callback(null, documents);
          });
        });
      } else {
        callback(null, documents);
      }
    });
  };
  
  db.beforeUpdate = function(query, update, callback) {
    var doc = update.$set
      if (doc.letterhead != null) {
        console.log(typeof(doc.letterhead.path));
        if (typeof(doc.letterhead.path) !== "object") {
          // Save fileAttachments element and replace with _id
          var fileId = new ObjectID();
          var store = app.store(fileId, "", 'w');
          var fd = fs.openSync(doc.letterhead.path, 'r');
          store.open(function(error, gridStore){
            gridStore.writeFile(fd, function(error, result){
              // Remove uploaded file
              fs.unlinkSync(doc.letterhead.path);
                
              doc.letterhead.path = result.fileId;
              callback(null, query, update);
            });
          });
        } else {
          callback(null, query, update);
        }
      } else {
        callback(null, query, update);
      }
  };
  
  // Public API
  return {
    create: function(data, callback) {
      db.getCollection(function (error, collection) {
        
        data._id = collection.pkFactory.createPk();

        db.validateAndInsert(data, function (error, validator) {
          callback(error, validator);
        }); 
      });
    },
    
    remove: function(id, callback) {
      db.remove({_id: ObjectID(id)}, function(error){
        callback(error);
      });
    },
    
    edit: function(id, data, callback) {
      db.findOne({_id: ObjectID(id)}, function(err, item) { 
        if (err == null && item != null) {
          
          if (item.letterhead != null && data.letterhead == null) {
            data.letterhead = item.letterhead;
          }
          
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
    
    list: function() {
      var callback = null;
      var search = {};
      if (arguments.length == 2) {
        search = arguments[0] || {};
        callback = arguments[1];
        
        if (typeof(search.search) === "undefined") {
          search.search = {};
        }
          
        if (typeof(search._page) !== "undefined") {
          var offset = ((search._page - 1) * search._limit);
          var limit = search._limit;
          if (typeof(limit) === "undefined") {
            limit = 10; // default limit
          }

          db.find(search.search, function(error, cursor) {
            cursor.limit(limit).skip(offset).toArray(function (error, result) {
              callback(result);
            });
          });
        } else {
          db.findArray(search.search, function(error, result) {
            callback(result);
          });
        } 
      } else {
        callback = arguments[0];
        
        db.findArray(function(error, result) {
          callback(result);
        });
      }
    },
    
    viewLogo: function(fileId, stream, callback) {
      console.log(fileId);
      // Find letterhead
      db.findOne({'letterhead.path': ObjectID(fileId)}, {letterhead: 1, _id: 0}, function(error, item){
        console.log(item);
        if (item != null) {
          if (item.letterhead.path == fileId) {
            stream.contentType(item.letterhead.type);
            stream.attachment(item.letterhead.name);
            var store = app.store(ObjectID(fileId), 'r');
            store.open(function(error, gridStore) {
              if (error != null && error.length > 0) {
              console.log(error);
                stream.end();
              } else {
              // Grab the read stream
                var gridStream = gridStore.stream(true);
                gridStream.pipe(stream);
              }
            }); 
          }
        }
      });
    }
  }
}
