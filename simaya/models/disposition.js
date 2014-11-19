module.exports = function(app) {
  // Private
  var _ = require("lodash");
  var db = app.db('disposition');
  var user = app.db('user');
  var organization = app.db('organization');
  var utils = require('./utils')(app)
    , moment = require('moment');
  var ObjectID = app.ObjectID;
  var fs = require("fs");
  
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

  var saveAttachmentFile = function(file, callback) {
    var fileId = new ObjectID();
    var store = app.store(fileId, file.name, "w", file.options || {});
    store.open(function(error, gridStore){
      gridStore.writeFile(file.path, function(error, result){
        fs.unlinkSync(file.path);
        callback(error, result);
      });
    }); 
  }

  var downloadAttachment = function(options, callback) {
    var fileId = options.id;
    var stream = options.stream;
    // Find letter title for this file
    var store = app.store(app.ObjectID(fileId+""), "", "r");
    store.open(function(error, gridStore) {
      console.log(error);
      if (stream.attachment) {
        stream.contentType(gridStore.contentType);
        stream.attachment(gridStore.filename);
      }
      // Grab the read stream
      if (!gridStore || error) { 
        if (callback) {
          return callback(error);
        } 
        return;
      }
      var gridStream = gridStore.stream(true);
      gridStream.on("error", function(error) {
        if (callback) return callback(error);
      });
      gridStream.on("end", function() {
        if (callback) callback(null);
      });
      gridStream.pipe(stream);
    });
  };

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
              if (result && result.length == 1) {
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
                if (result && result.length == 1) {
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
    addComments: function(dispositionId, commenter, message, attachments, callback) {
      var modified = false;
      db.findArray({ _id: dispositionId }, function (error, result) {
        if (result != null && result.length == 1) {
          var comments = result[0].comments || [];
          var entry = {
            commenter: commenter,
            comments: message,
            date: new Date(),
            attachments: attachments || []
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
        $or: [
        {
          "recipients.recipient": {
            $in: [ username ]
          }
        },
        {
          "sender": {
            $in: [ username ]
          }
        },


        ]
      }
      console.log(selector);
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
    },

    // Finds disposition recipient candidates list 
    // Input: {String[]} exclude People to exclude
    //        {String} org Organization path
    candidates: function(exclude, org, cb) {
      var excludeMap = {};
      _.each(exclude, function(item) { excludeMap[item] = 1});
      var findPeople = function(orgs, cb) {
        var query = {};
        query["profile.organization"] = {
            $in: orgs
          }
        user.findArray(query, { username: 1, profile: 1}, cb);
      }

      var findOrg = function(org, cb) {
        var query = {
          path: {
            $regex : "^" + org + "$|" + org + ";.*" 
          }
        };

        organization.findArray(query, cb);
      }

      var heads = {};
      findOrg(org, function(err, r1) {
        if (err) return cb(err);
        var orgs = [];
        _.each(r1, function(item) {
          orgs.push(item.path);
          if (item.head) {
            heads[item.head] = item.path;
          }
        });
        findPeople(orgs, function(err, r2) {
          if (err) return cb(err);
          var result = [];
          var map = {};
          _.each(r2, function(item) {
            if (!excludeMap[item.username]) {
              var orgName = item.profile.organization;
              var orgMap = map[orgName];
              var sortOrder = item.profile.echelon;
              if (heads[item.username]) {
                sortOrder = "00";
              }
              if (!orgMap) {
                orgMap = { 
                  label: orgName,
                  children: []
                };
                map[orgName] = orgMap;
              }
              var data = {
                label: item.username,
                id: item.username,
                sortOrder: sortOrder
              }
              data = _.merge(data, item);
              orgMap.children.push(data);
            }
          });

          Object.keys(map).forEach(function(item) {
            var org = map[item];
            if (org && org.children) {
              org.children = _.sortBy(org.children, "sortOrder");
            }
          });
          _.each(orgs, function(item) {
            if (map[item] && !map[item].processed) {
              var chop = item.lastIndexOf(";");
              if (chop > 0) {
                var orgChopped = item.substr(0, chop);
                var parent = map[orgChopped];

                map[item].children = _.sortBy(map[item].children, "sortOrder");
                if (parent) {
                  parent.children = parent.children || [];
                  parent.children.push(map[item]);
                  map[item].processed = 1;
                }
              }
            }
          });
          Object.keys(map).forEach(function(item) {
            if (!map[item].processed)
            result.push(map[item]);
          });

          cb(null, result);
        });
      });

      
    },

    saveAttachmentFile: saveAttachmentFile,
    downloadAttachment: downloadAttachment
  }
}
