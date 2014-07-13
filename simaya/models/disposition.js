module.exports = function(app) {
  // Private
  var db = app.db('disposition');
  var user = app.db('user');
  var utils = require('./utils')(app)
    , moment = require('moment')
  
  // Validation function
  db.validate = function(document, update, callback) {
    var validator = app.validator(document, update);
    
    if (validator.isInserting()) {
      user.find({username: update.recipient }, {username: 1, _id: 0}, function(error, result){
        if (result == null) {
          validator.addError('Data', 'User user not exist');
        }
        callback(null, validator);
      });
    } else {
      callback(null, validator);
    }
  };
  
  // Public API
  return {
    // Create a new disposition
    // Return a callback
    //    error: database error if any
    //    validator: the validator
    create: function(data, callback){
      db.getCollection(function (error, collection) {
        
        data._id = collection.pkFactory.createPk();

        db.validateAndInsert(data, function (error, validator) {
          validator._id = data._id;
          callback(error, validator);
        }); 
      });
    },
    
    // Remove a disposition
    // Return a callback
    //    error: database error if any
    remove: function(dispositionId, callback) {
      db.findAndModify(
        {_id: dispositionId},
        [],
        {$set: {status: 'demoted'}},
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
    //    result: array of object of
    //      _id : id of disposition
    //      recipient: recipient 
    //      sender: sender 
    //      message: message
    //      status: status
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
        var fields = search["fields"] || {};
        if (typeof(search.page) !== "undefined") {
          var offset = ((search.page - 1) * search.limit);
          var limit = search.limit;
          if (typeof(limit) === "undefined") {
            limit = 10; // default limit
          }
        
          db.find(search.search, fields, function(error, cursor) {
            cursor.sort({date:-1}).limit(limit).skip(offset).toArray(function (error, result) {
              if (result.length == 1) {
                utils.resolveUsers([result[0].recipient], function(data) {
                  result[0].recipientsResolved = data[0];
                  utils.resolveUsers([result[0].sender], function(data) {
                    result[0].senderResolved = data[0];
                    callback(result);
                  });
                });
              } else {
                callback(result);
              }
            });
          });
        } else {
          db.find(search.search, fields, function(error, cursor) {
            if (cursor != null) {
              cursor.sort({date:-1}).toArray(function(error, result) {
                if (result.length == 1) {
                    utils.resolveUsers([result[0].recipient], function(data) {
                      result[0].recipientResolved = data[0];
                      utils.resolveUsers([result[0].sender], function(data) {
                        result[0].senderResolved = data[0];
                        callback(result);
                      });
                    });
                } else {
                  callback(result);
                }
              });
            } else {
              callback(result);
            }
          });
        } 
      }
    },

    // Marks a disposition as read
    markAsRead: function(dispositionId, recipient, callback) {
      var modified = false;
      db.findArray({ _id: app.ObjectID(dispositionId +"") }, function (error, result) {
        if (result != null && result.length > 0) {
          for (var i = 0; i < result[0].recipients.length; i ++) {
            if (result[0].recipients[i].recipient == recipient) {
              result[0].recipients[i].readDate = moment(new Date()).format('DD/MM/YYYY HH:mm');
              modified = true;
            }
          }
          if (modified) {
            console.log(result[0]);
            db.save(result[0]);
          }
        }
        if (callback)
          callback(modified);
      });
    },

    // Marks a disposition as followedUp
    markAsFollowedUp: function(dispositionId, letterId, recipient, callback) {
      var modified = false;
      db.findArray({ _id: dispositionId }, function (error, result) {
        if (result != null && result.length == 1) {
        console.log(result);
          for (var i = 0; i < result[0].recipients.length; i ++) {
            if (result[0].recipients[i].recipient == recipient) {
              result[0].recipients[i].followedUpDate = new Date();
              result[0].recipients[i].followedUpLetter = letterId; 
              modified = true;
            }
          }
          if (modified) {
            console.log(result[0]);
            db.save(result[0]);
          }
        }
        if (callback)
          callback(modified);
      });
    },

    // Marks a disposition as declined 
    markAsDeclined: function(dispositionId, recipient, message, callback) {
      var modified = false;
      db.findArray({ _id: dispositionId }, function (error, result) {
        if (result != null && result.length == 1) {
          for (var i = 0; i < result[0].recipients.length; i ++) {
            if (result[0].recipients[i].recipient == recipient) {
              result[0].recipients[i].declinedDate = new Date();
              result[0].recipients[i].declineMessage = message; 
              modified = true;
            }
          }
          console.log(result[0]);
          if (modified) {
            db.save(result[0]);
          }
        }
        if (callback)
          callback(modified);
      });
    },

    // Marks a disposition as declined 
    addComments: function(dispositionId, commenter, message, callback) {
      var modified = false;
      db.findArray({ _id: dispositionId }, function (error, result) {
        if (result != null && result.length == 1) {
          var comments = result[0].comments || [];
          var entry = {
            commenter: commenter,
            comments: message,
            date: new Date(),
          }
          comments.push(entry);
          result[0].comments = comments;
          db.save(result[0]);
        }
        if (callback)
          callback(comments.length);
      });
    },

    // Gets number of unread dispositions from the specified user
    numberOfNewDispositions: function(user, callback) {
      var userMangled = user.replace(/\./g, "___");
      db.find({"recipients.recipient":user,"recipients.readDate": {$exists: false}}, {_id:1}, function(error, cursor) {
        if (cursor != null) {
          cursor.count(function(e, n) {
            if (n == null) {
              callback(0);
            } else {
              callback(n);
            }
          });
        } else {
          callback(0);
        }
      });
    }

  }
}
