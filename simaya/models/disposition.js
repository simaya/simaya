module.exports = function(app) {
  // Private
  var _ = require("lodash");
  var db = app.db('disposition');
  var user = app.db('user');
  var utils = require('./utils')(app)
    , moment = require('moment')
  
  var notification = require("./notification.js")(app);

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
  
  var notificationTypes = {
    "disposition-shared": {
      recipients: {
        recipients: "shared-recipients",
        text: "disposition-shared-recipients",
        url : "/disposition/read/%ID",
      },
      sender: {
        recipients: "sender",
        text: "disposition-shared-sender",
        url : "/disposition/read/%ID",
      },
    }
  }


  var sendNotification = function(sender, type, data, cb) {      
    var send = function(sender, recipient, text, url) {
      setTimeout(function() {
        if (url) url = url.replace("%ID", data.record._id);

        if (sender != recipient) { 
          notification.set(sender, recipient, text, url, cb);
          //console.log("Not: ", type, sender, recipient, text, url, cb);
        }
      }, 0);
    };

    var prepareRecipients = function(entry, cb) {
      var recipients = [];
      if (entry.recipients == "recipients") {
        _.each(data.record.recipients, function(item) {
          recipients.push(item.recipient)
        });
      } else if (entry.recipients == "sender") {
        recipients.push(data.record.sender);
      } else if (entry.recipients == "shared-recipients") {
        _.each(data.record.sharedRecipients, function(item) {
          recipients.push(item.recipient)
        });
      } else {
        console.log("UNKNOWN RECIPIENTS", data.record);
      }
      return cb(recipients);
    };


    var prepare = function(entry) {
      var text = "@" + entry.text;
      var url = entry.url;

      prepareRecipients(entry, function(recipients) {
        _.each(recipients, function(recipient) {
          send(sender, recipient, text, url);
        });
      });
    }

    var n = notificationTypes[type];  
    if (n) {
      for (var i in n) {
        var entry = n[i];
        prepare(entry);
      }
    }
  }
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
            db.save(result[0], function() {
              if (callback) callback(modified);
            });
          } else {
            if (callback) callback(modified);
          }
        } else {
          if (callback) callback(modified);
        }
      });
    },

    // Marks a disposition as followedUp
    markAsFollowedUp: function(dispositionId, letterId, recipient, callback) {
      var modified = false;
      db.findArray({ _id: dispositionId }, function (error, result) {
        if (result != null && result.length == 1) {
          for (var i = 0; i < result[0].recipients.length; i ++) {
            if (result[0].recipients[i].recipient == recipient) {
              result[0].recipients[i].followedUpDate = new Date();
              result[0].recipients[i].followedUpLetter = letterId; 
              modified = true;
            }
          }
          if (modified) {
            console.log(result[0]);
            db.save(result[0], function() {
              if (callback)
              callback(modified);
            });
          } else {
            if (callback)
              callback(modified);
          }
        } else {
          if (callback)
            callback(modified);
        }
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
            db.save(result[0], function() {
              if (callback) callback(modified);
            });
          } else {
            if (callback) callback(modified);
          }
        } else {
          if (callback) callback(modified);
        }
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
          db.save(result[0], function() {
            if (callback) callback(comments.length);
          });
        } else {
          if (callback) callback(comments.length);
        }
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
    },

    // Shares a disposition with a set of parties
    // Input: {ObjectId} id the id of the disposition {String} username username who made the share
    //        {String[]} parties list of usernames receiving the share
    //        {String} message message to the parties from the username
    share: function(id, username, parties, message, callback) {
      var selector = {
        _id: app.ObjectID(id + ""),
        "recipients.recipient": {
          $in: [ username ]
        }
      }
      var notifyParties = function(err, result) {
        if (err) return callback(err, result);
        db.findArray(selector, function(err, result) {
          if (err) return callback(err, result);

          sendNotification(username, "disposition-shared", { record: result[0]});
          callback(null, result);
        });
      }

      var edit = function(data, cb) {
        delete(data._id);
        db.update(selector, {$set: data}, notifyParties);
      }

      var checkParties = function(cb) {
        user.findOne({ username: username}, function(err, item) {
          if (err) return cb(err);
          if (item && item.profile && item.profile.organization) {
            var org = item.profile.organization.split(";")[0];
            var query = {
              username: {
                $in: parties 
              },
              "profile.organization": { 
                $regex : "^" + org + "$|" + org + ";.*" 
              }
            };
            user.findArray(query, function(err, result) {
              if (result.length == parties.length) {
                return cb(null, parties);
              } else {
                return cb(new Error(1), {success: false, reason: "some recipients are from outside organization"});
              }
            });
          } else {
            cb(new Error(2), {success: false, reason: "sender not found"});
          }
        });
      }

      checkParties(function(err, parties) {
        if (err) return callback(err);
        db.findOne(selector, function(err, item) {
          if (err) return callback(err);
          if (item == null) return callback(Error(3), { success: false, reason: "item not found"});

          var sharedMap = {};
          var shared = item.sharedRecipients || [];

          _.each(shared, function(party) {
            sharedMap[party.recipient] = 1;
          });

          var records = [];
          _.each(parties, function(party) {
            if (!sharedMap[party]) {
              var record = {
                sender: username,
            recipient: party,
            message: message,
            date: new Date,
              }
              records.push(record)
            }
          });
          item.sharedRecipients = records;
          edit(item, callback);
        });
      });
    }
  }
}
