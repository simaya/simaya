module.exports = function(app) {
  // Private
  var db = app.db('jobTitle');
  
  // Validation function
  db.validate = function(document, update, callback) {
    var validator = app.validator(document, update);
    
    validator.validateQuery({
      title: [db, {title: update.title, organization: update.organization}, false, 'There is already a title with this name'],
    }, function () {
      callback(null, validator);
    });
  };

  db.beforeUpdate = function(query, update, callback) {
    if (update.$set.title != null && update.$set.path != null) {
      db.findArray({ organization: update.$set.organization, path : { $regex : '^' + update.$set.oldPath + ';' }}, function (error, result) {
        for (var i = 0; i < result.length; i ++) {
          result[i].path = result[i].path.replace(update.$set.oldPath, update.$set.path);
          db.save(result[i]);
        }
        delete update.$set.organization;
        delete update.$set.oldPath;
        callback(null, query, update);
      });
    } else {
      delete update.$set.oldPath;
      callback(null, query, update);
    }
  }


  
  // Public API
  return {
    // Create a new jobTitle
    //  data: object of
    //    organization: organization path
    //    title       : job title
    // Returns via a callback
    //    error: database error if any
    //    validator: the validator
    create: function(data, callback){
      db.getCollection(function (error, collection) {
        
        data._id = collection.pkFactory.createPk();

        db.validateAndInsert(data, function (error, validator) {
          callback(error, validator);
        }); 
      });
    },
    
    // Removes titles
    //  titles: the array of titles to be removed
    //  organization: the name of organization
    // Returns via a callback
    removeTitle: function(path, organization, callback) {
      db.remove({
          path: { $regex: '^' + path } ,
          organization: organization,
        }, function(e) {
          callback();
        });
    },

    // Edits jobTitle
    //    data: object of
    //      title: job title
    //    organization: organization path
    //    newTitle: new job title
    // Return a callback
    //    error: database error if any
    editTitle: function(data, callback) {
      db.findAndModify(
        {
          path: data.oldPath,
          organization: data.organization,
        },
        [],
        {$set: { title: data.newTitle, oldPath: data.oldPath, path: data.path, organization: data.organization}},
        {new: true},
        function(error, result) {
          callback(error);
        }
      );
    },
    
    // Lists disposition with optional search object of
    //    search: object query
    //    page: page index
    //    limit: number of records per page
    // Returns a callback:
    //    result: array of object 
    list: function() {
      var callback;
      if (arguments.length == 1) {
        callback = arguments[0];
        
        db.findArray(function(error, result) {
          callback(result);
        });
      } else {
        search = arguments[0];
        callback = arguments[1];
        if (typeof(search.page) === "undefined") {
          db.find(search.search, function(error, cursor) {
            cursor.sort({path:1}).toArray(function(error, result) {
              callback(result);
            });
          });
        } else {
          var offset = ((search.page - 1) * search.limit) + 1;
          var limit = search.limit;
          if (typeof(limit) === "undefined") {
            limit = 10; // default limit
          }
        
          db.find(search.search, function(error, cursor) {
            cursor.limit(limit).skip(offset).toArray(function (error, result) {
              callback(result);
            });
          });
        } 
      }
    }
  }
}
