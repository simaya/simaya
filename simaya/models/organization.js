// We use materialized paths pattern for organization tree
module.exports = function(app) {
  // Private 
  var db = app.db('organization');
  var user = app.db('user');
  var ObjectID = app.ObjectID;
  
  // Validation function
  db.validate = function(document, update, callback) {
    var validator = app.validator(document, update);


    var pathCheck = '';
    if (validator.isUpdating()) {
      pathCheck = update.$set.path;  
    } else {
      pathCheck = update.path;  
    }

    if (pathCheck) {
      var parentCheck = null;
      var i = pathCheck.lastIndexOf(';');
      if (i > 0) {
        // this is not a root org.
        parentCheck = pathCheck.substr(0, i); 

        if (validator.isUpdating()) {
          var oldPath = update.$set.oldPath; 
          var oldParent = oldPath.substr(0, oldPath.lastIndexOf(';'));
          if (parentCheck != oldParent) {
            validator.addError('path', 'You can only rename, not change the whole path');
          }
        }
      }

      validator.validateQuery({
        path: [db, {path: pathCheck}, false, 'There is already a path with this name'],
      }, function () {
        if (parentCheck != null) {
          db.findOne({ path: parentCheck}, function(e, r) {
            if (r == null) {
              validator.addError('path', 'No parent found');
            }
            callback(null, validator);
          });
        } else {
          callback(null, validator);
        }
      });
    } else {
      callback(null, validator);
    }
  }
  
  // must be done after any update
  // we must replace all occurences of the path with the new name
  // eg.
  // old name: 'org1'
  //     path: 'ORG;Org1;org1'
  // new name: 'org2'
  //     path: 'ORG;Org1;org2'
  // and all other records prefixed with 'ORG;Org1;org1' must
  // be replaced with 'ORG;Org1;org2'

  db.beforeUpdate = function(query, update, callback) {
    if (update.$set.name != null && update.$set.path != null) {
      db.findArray({ path : { $regex : '^' + update.$set.oldPath + ';' }}, function (error, result) {
        for (var i = 0; i < result.length; i ++) {
          result[i].path = result[i].path.replace(update.$set.oldPath, update.$set.path);
          db.save(result[i], function() {});
        }
        delete update.$set.oldPath;
        callback(null, query, update);
      });
    } else {
      delete update.$set.oldPath;
      callback(null, query, update);
    }
  }

  // Peeks organizations based on a search string
  // and gives list of leaf organizations
  // also have possibility to exclude one
  //  peek: string to search
  // Returns via a callback
  var findLeafFull = function(name, exclude, callback) {
    var search = {
      path: { $regex: name + '($|\\w*[^;]$)' } 
    }

    if (exclude) {
      path.$ne = exlude;
    }

    db.findArray(search, function(error, result) {
      callback(result);
    });
  }

  var findAll = function(name, callback){
    if(name) return db.findArray({path : {$regex : "^" + name + "$|" + name + ";.*" } }, callback)
    db.findArray(callback)
  }


  // Public API
  return {

    // Creates an organization
    // Returns via a callback
    //    validator: The validator
    create: function (parent, data, callback) {
      if (parent == null || parent == "") {
        data.path = data.name;
      } else {
        data.path = parent + ';' + data.name;
      }
      db.getCollection(function (error, collection) {
        data._id = collection.pkFactory.createPk();

        db.validateAndInsert(data, function (error, validator) {
          callback(validator);
        }); 
      });
    },

    // Modifies an organization
    // Returns via a callback
    //    validator: The validator
    edit: function (path, data, callback) {
      var head;
      var removeHead = false;

      if (typeof(data) === "object") {
        removeHead = data.removeHead;
        head = data.head;
        data = data.path;
      }
      var i = data.lastIndexOf(';');
      if (i > 0) {
        var name = data.substr(i + 1);
      } else {
        var name = data;
      }
      var data = {
        name: name,
        path: data,
        oldPath: path,
      };
      if (head) {
        // Only head name is updated
        data = {
          head: head
        }
      }
      if (removeHead) {
        // Removing head
        data = {
          head: "" 
        }
      }
      db.findOne({path: path}, function(err, item) { 
        if (err == null && item != null) {
          db.validateAndUpdate( {
            path: path
          }, {
            '$set': data 
          }, function (error, validator) {
            callback(validator);
          }); 
       } else {
          var doc = { path: path};
          var validator = app.validator(doc, doc);
          validator.addError('data', 'Non-existant id');
          callback(validator);
       }
      });
    },

    // Lists an organization
    //  parent: The parent organization, null for root
    // Returns via a callback
    //    result: The result in array
    list: function(parent) {
      var callback = null;
      var search = {};
      var parentSearch = {};
      
      if (typeof(parent) === "undefined") {
        parentSearch = {};
      } else if (parent == null) {
        // Root organization is where the name equals the path 
        parentSearch = { $where: 'this.name == this.path' };
      } else if (typeof(parent) === "object") {
        parentSearch = parent;
      } else {
        // Everything else contains a parent name followed by the name or
        // further hierarchy
        parentSearch = { path: { $regex: '^' + parent + ';([^;]+)$'}};
      }

      if (arguments.length == 3) {
        search = arguments[1] || {};
        callback = arguments[2];
        
        if (typeof(search.search) === "undefined") {
          search.search = parentSearch;
        } else {
          for (var i in parentSearch) {
            search.search[i] = parentSearch[i];
          }
        }
          
        if (typeof(search._page) !== "undefined") {
          var limit = search._limit;
          if (typeof(limit) === "undefined") {
            limit = 10; // default limit
          }
          var offset = ((search._page - 1) * limit);

          db.find(search.search, function(error, cursor) {
            cursor.limit(limit).skip(offset).toArray(function (error, result) {
              callback(result);
            });
          });
        } else {
          db.find(search.search, function(error, cursor) {
            cursor.sort({path:1}).toArray(function (error, result) {
              callback(result);
            });
          });
        } 
      } else {
        callback = arguments[1];
        db.find(parentSearch, function(error, cursor) {
          cursor.sort({path:1}).toArray(function(error, result) {
            callback(result);
          });
        });
      }
    },

    // Removes an organization
    //  name: organization name
    // Returns via a callback
    remove: function(name, callback) {
      // Remove the children
      db.remove({ path: { $regex: '^' + name + ';' }}, function(r) {
        // Remove the entry
        db.remove({ path: name }, function(r) {
          callback();
        });
      });
    },

    // Checks whether a path exists
    //  name: the path to check
    // Returns via a callback
    exists: function(name, callback) {
      db.findOne({path: name}, function(error, result) {
        callback(result != null);
      });
    },

    findLeafFull: findLeafFull,

    // Peeks organizations based on a search string
    // and gives list of leaf organizations
    //  peek: string to search
    // Returns via a callback
    findLeaf: function(name, callback) {
      findLeafFull(name, null, callback);
    },
    
    // List array of username where in same organization
    //  users: array of username
    // Return via callback
    listUsers: function(org, callback) {
      user.findArray({'profile.organization': org}, function(error, result) {
        var users = [];
        if (error == null) {
          result.forEach(function(e) {
            users.push(e.username);
          });
        }
        callback(users);
      });
    },

    // Finds all organization, given root path
    //  name : organization root path
    // returns via callback
    findAll : findAll
  }
}
