module.exports = function(app) {
  // Private 
  var db = app.db('contacts');
  var cachedb = app.db('contacts_cache');
  var cache = require("./cache")(app); 
  var utils = require("./utils")(app); 
  var ObjectID = app.ObjectID;
  
  // connections
  // initiator
  // established 
  // date

  // Inserts data into cache
  var insertLoop = function(user, resolvedUsers, cacheId, count, end, items, singles, callback) {
    if (count < end) {
      var originalId = items[count]._id;
      x = items[count];
      x.contactId = originalId;
      x.cacheId = cacheId;
      // The end point of the connection must not be the user we're caching
      // to get a consistent point of search
      if (x.connections[0] == user) {
        x.end1 = x.connections[0];
        x.end2 = x.connections[1];
      } else {
        x.end2 = x.connections[0];
        x.end1 = x.connections[1];
      }
      // copy the resolved names, titles and organizations
      if (resolvedUsers[x.end1]) {
        x.name = resolvedUsers[x.end1].name;
        x.title = resolvedUsers[x.end1].title;
        x.organization = resolvedUsers[x.end1].organization;
      } else {
        x.name = x.title = x.organization = null;
      }

      if (resolvedUsers[x.end2]) {
        x.name2 = resolvedUsers[x.end2].name;
        x.title2 = resolvedUsers[x.end2].title;
        x.organization2 = resolvedUsers[x.end2].organization;
      } else {
        x.name2 = x.title2 = x.organization2 = null;
      }

      delete(x._id);
      var id = x.end1 + ":" +
               x.end2 + ":" +
               x.established + ":"
      if (singles[id] == 1) {
        insertLoop(user, resolvedUsers, cacheId, count + 1, end, items, singles, callback);
     } else {
        singles[id] = 1;
 
        // loop the records and copy into cache
        cachedb.insert(x, function(e) {
          x = items[count];
          x.contactId = originalId;
          // Reverse
          // The start point of the connection must not be the user we're caching
          // to get a consistent point of search
          if (x.connections[0] == user) {
            x.end1 = x.connections[1];
            x.end2 = x.connections[0];
          } else {
            x.end2 = x.connections[1];
            x.end1 = x.connections[0];
          }
          // copy the resolved names, titles and organizations
          if (resolvedUsers[x.end1]) {
            x.name = resolvedUsers[x.end1].name;
            x.title = resolvedUsers[x.end1].title;
            x.organization = resolvedUsers[x.end1].organization;
          } else {
            x.name = x.title = x.organization = null;
          }

          if (resolvedUsers[x.end2]) {
            x.name2 = resolvedUsers[x.end2].name;
            x.title2 = resolvedUsers[x.end2].title;
            x.organization2 = resolvedUsers[x.end2].organization;
          } else {
            x.name2 = x.title2 = x.organization2 = null;
          }

          delete(x._id);
          var id = x.end1 + ":" +
                   x.end2 + ":" +
                   x.established + ":"
          if (singles[id] == 1) {
            insertLoop(user, resolvedUsers, cacheId, count + 1, end, items, singles, callback);
          } else {
            singles[id] = 1;
            cachedb.insert(x, function(e) {
              insertLoop(user, resolvedUsers, cacheId, count + 1, end, items, singles, callback);
            })
          }
        })
      }
    } else {
      callback();
    }
  }


  // Fills cache when cacheId is null
  var recache = function(user, cacheId, callback) {
    if (cacheId != null) {
      callback(cacheId);
    } else {
      var foundUsers = {}
      console.log("doing recache:" + user)
      var search = {connections: { $in: [user] }};
      db.findArray(search, function(e, items) {
        if (items != null && items.length > 0) {
          // record all found users
          for (var i = 0; i < items.length; i ++) {
            foundUsers[items[i].connections[0]] = 1;
            foundUsers[items[i].connections[1]] = 1;
          }

          cache.update("contacts:" + user, false, function(cacheId) {
            // remove old entries with the cacheId first
            cachedb.remove({cacheId: cacheId}, function() {
              // resolve the names
              utils.resolveUsers(Object.keys(foundUsers), function(resolvedUsers) {
                var users = {}
                for (var i = 0; i < resolvedUsers.length; i ++) {
                  users[resolvedUsers[i].username] = resolvedUsers[i];
                }
                  
                // put into cache
                var singles = {}
                insertLoop(user, users, cacheId, 0, items.length, items, singles, function() {
                  // activate cache
                  cache.update("contacts:" + user, true, function() {
                    callback(cacheId);
                  }) // cache.update
                }); //insertLoop
              }) // utils.resolveUsers
            }) // cachedb.remove
          }) // cache.update
        } else {
          callback(null);
        }
      })
    }
  }

  // Validation function
  db.validate = function(document, update, callback) {
    var validator = app.validator(document, update);
   
    if (validator.isUpdating()) {
      update = update.$set;
    }
    if (validator.isInserting() || validator.isUpdating()) {
      // Check completeness of data
      if (typeof(update.connections) !== "object" || update.connections == null || update.connections.length != 2) {
        validator.addError('Data', 'Connections is not set');
      } else {
        if (update.connections[0] == update.connections[1]) {
          validator.addError('Data', 'Connection is invalid');
        }
      }
      if (typeof(update.date) === "undefined" || update.date == null) {
        validator.addError('Data', 'Date is not set');
      }
      if (typeof(update.connections) === "object") {
        var there = false;
        for (var i = 0; i < update.connections.length; i ++) {
          if (update.initiator == update.connections[i]) {
            there = true;
            break;
          }
        }
        if (there == false) {
          validator.addError('Data', 'initiator is not in connections');
        }
      }

    }

    if (validator.isInserting()) {
      if (update.duplicate) { // Set by connect()
        validator.addError('Data', 'Duplicate');
      }
      callback(null, validator); 
    } else {
      callback(null, validator);
    }
  }
  
  // Public API
  return {
    // Connects two contacts
    // Returns via callback
    //    validator: The validator
    connect: function (data, callback) {
      var self = this;
      db.getCollection(function (error, collection) {
        data._id = collection.pkFactory.createPk();

        data.connections = data.connections.sort();

        var insert = true;
        db.findOne({connections: data.connections}, {}, function(error, result){
          if (result != null) {
            // Same initiator, set as duplicate
            if (result.initiator == data.initiator) {
              data.duplicate = true;
            } else {
              // Different initiator, establish the connection
              data.established = true;
              insert = false; // don't insert, call edit instead
              self.edit(result._id, data, callback);
            }
          }
          if (insert) {
            cache.update("contacts:" + data.connections[0], false, function() {
              cache.update("contacts:" + data.connections[1], false, function() {
                db.validateAndInsert(data, function (error, validator) {
                  validator.resultId = data._id;
                  callback(validator);
                }); 
              })
            })
          }
        })
      });
    },

    // Modifies deputy 
    // Returns via callback
    //    validator: The validator
    edit: function (id, data, callback) {
      id = id + "";
      db.findOne({_id: ObjectID(id)}, function(err, item) { 
        if (err == null && item != null) {
          delete (data._id);
          console.log("doing edit")
          cache.removeCollections(["contacts:" + item.connections[0], "contacts:" + item.connections[1]], function() {
            db.validateAndUpdate( {
              _id: item._id
            }, {
              '$set': data 
            }, function (error, validator) {
              validator.resultId = item._id;
              callback(validator);
            }); 
          })
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
        _id: ObjectID(id+"")
      }

      db.findOne(search, function(err, item) { 
        callback(item);
      });
    },

    // Deletes connecttions
    // Returns via a callback
    remove: function (id, callback) {
      this.getInfo(id, function(item) {
        if (item != null) {
          db.remove({_id: item._id}, function(r) {
            cachedb.remove({contactId: item._id}, function(e) {
              cache.removeCollections(["contacts:" + item.connections[0], "contacts:" + item.connections[1]], function() {
                callback(true);
              });
            });
          })
        } else {
          callback(false);
        }
      })
    },

    // Establishes connection
    establish: function(id, callback) {
      var self = this;
      self.getInfo(id, function(item) {
        if (item != null && item.established == false) {
          item.established = true;
          self.edit(id, item, callback);
        } else {
          var doc = { _id: id};
          var validator = app.validator(doc, doc);
          validator.addError('data', 'Non-existant id');
          callback(validator);
        }
      })
    },

    getNotes: function (end1, end2, callback) {
      var connections = [end1, end2];
      connections = connections.sort();

      db.findOne({connections: connections}, function(e, r) {
        if (r != null) {
          var data = r.notes || {};
          callback(data[end1]);
        } else {
          callback(null);
        }
      });
    },

    setNotes: function (end1, end2, notes, callback) {
      var connections = [end1, end2];
      connections = connections.sort();

      db.findOne({connections: connections}, function(e, r) {
        if (r == null) {
          callback(false);
        } else {
          if (r.established == true) {
            var data = r.notes || {};
            data[end1] = notes;
            r.notes = data;
            db.save(r);
            callback(true);
          } else {
            callback(false);
          }
        }
      });
    },

    // Lists contacts
    // Returns cached data via callback
    listByUser: function (user, search, callback) {
      // check cache first
      // if cacheId is null then there is nothing in cache
      // and the cache must be filled in recache
      cache.isValid("contacts:" + user, function(cacheId) {
        recache(user, cacheId, function(cacheId) {
          if (cacheId == null) {
            callback([]);
            return;
          }
          if (typeof(search.search) === "undefined") {
            search.search = {};
          }
          search.search.cacheId = cacheId;
            
          if (typeof(search.page) !== "undefined") {
            var offset = ((search.page - 1) * search.limit);
            var limit = search.limit;
            if (typeof(limit) === "undefined") {
              limit = 10; // default limit
            }

            cachedb.find(search.search, function(error, cursor) {
              cursor.sort(search.sort || {date:-1}).limit(limit).skip(offset).toArray(function (error, result) {
                callback(result);
              });
            });
          } else {
            cachedb.find(search.search, function(error, cursor) {
              cursor.sort(search.sort || {date:-1}).toArray(function(error, result) {
                callback(result);
              });
            });
          } 
        })
      })
    }
  }
}
