module.exports = function(app) {
  // Private 
  var db = app.db('letter');
  var user = app.db('user');
  var ObjectID = app.ObjectID;
  var fs = require('fs');
  var moment = require('moment');
  var utils = require('./utils')(app);
  var base64Stream = require("base64-stream");
  
  var stages = {
    NEW: 0,
    WAITING: 1,
    REVIEWING: 2,
    APPROVED: 3,
    DEMOTED: 4,
    SENT: 5,
    RECEIVED: 6,
    REJECTED: 7,
  }

   // Validation function
  db.validate = function(document, update, callback) {

    var validator = app.validator(document, update);

    // What to check:
    // - completeness of data:
    //      - mailId
    //      - recipients
    //      - originator
    //      - type
    //      - title
    //      - classification
    //      - date 
    //      - creationDate
    //      - fileAttachments

    // - validity of data
    //      - no future dates
    //      - originator exists in user collection
    //      - recipients exist in user collection
    //      - reviewers exist in user collection
    if (validator.isInserting()) {
      // Check completeness of data
      
      if (typeof(update.recipients) == "undefined" || update.recipients == null) {
        validator.addError('Data', 'Recipients is not set');
      }
        
      if (typeof(update.originator) == "undefined" || update.originator == null) {
        validator.addError('Data', 'Originator is not set');
      }
        
      if (typeof(update.type) == "undefined" || update.type == null) {
        validator.addError('Data', 'Letter type is not set');
      }
      console.log(update);

      if (typeof(update.date) == "undefined" || update.date == null || isNaN(update.date.valueOf())) {
        validator.addError('Data', 'Letter date is not set');
      }
 
      if (typeof(update.title) == "undefined" || update.title == null || update.title == "") {
        validator.addError('Data', 'Title is not set');
      }

      if (typeof(update.classification) == "undefined" || update.classification == null) {
        validator.addError('Data', 'Classification is not set');
      }
        
      if (update.creation == "external") {
        if (typeof(update.date) == "undefined" || update.date== null || update.date == "") {
          validator.addError('Data', 'date is not set');
        }
        if (typeof(update.incomingAgenda) == "undefined" || update.incomingAgenda== null || update.incomingAgenda == "") {
          validator.addError('Data', 'Incoming Agenda is not set');
        }
        if (typeof(update.mailId) == "undefined" || update.mailId== null || update.mailId == "") {
          validator.addError('Data', 'Mail ID is not set');
        }
        // if file attachment is not set
        update.fileAttachments = update.fileAttachments || [];
        if (update.fileAttachments.length == 0) {
          validator.addError('Data', 'Attachment is not set');
        }
        // Validity of data existance
        var now = moment(new Date());
        var then = moment(update.date);
        if (then.diff(now) > 0) {
          validator.addError('Data', 'No future dates');
        }

      }
      
      if (typeof(update.creationDate) == "undefined" || update.creationDate == null) {
        validator.addError('Data', 'creationDate is not set');
      }

      if (typeof(update.senderManual) === "object") {
        if (typeof(update.senderManual.name) == "undefined" || update.senderManual.name == null || update.senderManual.name == "") {
          validator.addError('Data', 'Sender is not set');
        }
        if (typeof(update.senderManual.organization) == "undefined" || update.senderManual.organization == null || update.senderManual.organization == "") {
          validator.addError('Data', 'Sender organization is not set');
        }
        if (typeof(update.senderManual.address) == "undefined" || update.senderManual.address == null || update.senderManual.address == "") {
          validator.addError('Data', 'Sender address is not set');
        }
      } else {
        if (typeof(update.sender) == "undefined" || update.sender== null || update.sender == "") {
          validator.addError('Data', 'Sender is not set');
        }
      }
 
      user.findOne({username: update.originator }, {username: 1, _id: 0}, function(error, result){
        if (result == null) {
          validator.addError('Data', 'Originator user not exist');
        }
        user.findArray({username: { $in: update.reviewers }}, {username: 1, _id: 0}, function(error, items){
          if (items != null) {
            if (items.length != update.reviewers.length
              && update.creation != 'external') {
              validator.addError('Data', 'Reviewers not exist');
            } 
          }

          if (typeof(update.recipientManual) === "object") {
            if (typeof(update.recipientManual.name) == "undefined" || update.recipientManual.name == null || update.recipientManual.name == "") {
              validator.addError('Data', 'Recipient is not set');
            }
            if (typeof(update.recipientManual.organization) == "undefined" || update.recipientManual.organization == null || update.recipientManual.organization == "") {
              validator.addError('Data', 'Recipient organization is not set');
            }
            if (typeof(update.recipientManual.address) == "undefined" || update.recipientManual.address == null || update.recipientManual.address == "") {
              validator.addError('Data', 'Recipient address is not set');
            }
            callback(null, validator);
          } else {
            user.findArray({username: { $in: update.recipients }}, {username: 1, _id: 0}, function(error, items){
              if (items != null) {
                if (items.length != update.recipients.length) {
                  validator.addError('Data', 'Recipients not exist');
                } 
              }
              callback(null, validator);
            });
          }
        });
      });
      
    } else if (validator.isUpdating()) {
      // mailId and fileAttachments must be not null at Sent status
      if (update.$set.status == stages.SENT) {
        if (typeof(update.$set.fileAttachments) == "undefined" || update.$set.fileAttachments == null || update.$set.fileAttachments.length == 0 && update.$set.ignoreFileAttachments == false) {
          validator.addError('Data', 'fileAttachments is not set');
        }
        if (typeof(update.$set.mailId) == "undefined" || update.$set.mailId == null || update.$set.mailId.length < 3) {
          validator.addError('Data', 'mailId is not set'); 
        }
        if (typeof(update.$set.outgoingAgenda) == "undefined" || update.$set.outgoingAgenda== null || update.$set.outgoingAgenda.length < 3) {
          validator.addError('Data', 'outgoing agenda is not set'); 
        }
      }
      callback(null, validator); 
    } else {
      callback(null, validator);
    }
  }
  
  db.beforeInsert = function (documents, callback) {
    var docLength = documents.length + 0
      , docCount = 0
    documents.forEach(function (doc) {
      docCount ++
      if (doc.fileAttachments != null && doc.fileAttachments.length > 0 && doc.status != stages.WAITING) {
        var attachmentLength = doc.fileAttachments.length
          , attachmentCount = 0
        doc.fileAttachments.forEach(function(e, i){

          if (typeof e.path !== "string") {
            return callback(null, documents);
          }

          fs.stat(e.path, function(err){

            if (err) {
              return callback(null, documents);
            }

            // Save fileAttachments element and replace with _id
            var fileId = new ObjectID();
            var store = app.store(fileId, e.name, 'w');
            var fd = fs.openSync(e.path, 'r');
            store.open(function(error, gridStore){
              gridStore.writeFile(fd, function(error, result){

                if (!gridStore || error) {
                  if (callback) {
                    return callback (error);  
                  }
                  return;
                }

                attachmentCount ++;
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
          })
        });
      } else {
        callback(null, documents);
      }
    });
  };
  
  db.beforeUpdate = function(query, update, callback) {

    var doc = update.$set;

    if(!doc) {
      // not $set maybe something else e.g. $unset, $push, $pull etc
      return callback(null, query, update);
    }

    if (doc.fileAttachments != null && doc.fileAttachments.length > 0 && doc.creation != 'draft') {
      var lastFile = doc.fileAttachments.slice(-1)[0];
      doc.fileAttachments.forEach(function(e, i){
        if (typeof(e.path) !== "object") {

          fs.stat(e.path, function(err){
            if (err) {
              return callback(null, query, update);
            }

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

          })
        } 
        else if (typeof e.path !== 'string') 
        {
          return callback(null, query, update);
        } 
        else 
        {
          if (e == lastFile) {
            callback(null, query, update);
          }
        }
      });
    } else {
      callback(null, query, update);
    }
  }

  // Gets document's rendering 
  // Return a callback
  //    result: file stream
  var renderDocumentPageBase = function(base64, fileId, page, stream) {
    // Find letter title for this file
    db.findOne({'fileAttachments.path': ObjectID(fileId)}, {fileAttachments: 1, _id: 0}, function(error, item){
      if (item != null) {
        item.fileAttachments.forEach(function(e) {
          if (e.path == fileId) {
            stream.contentType("image/jpeg");
            var store = app.store(ObjectID(fileId), e.name, 'r');
            store.open(function(error, gridStore) {
              if (!gridStore || error) {
                stream.end();
                return;
              }
              // Grab the read stream
              var gridStream = gridStore.stream(true);
              var spawn = require("child_process").spawn;
              var args = ["convert", "-density", "200", "-resize", "50%", "-flatten", "-[" + page + "]", "jpg:-"];
              var convert = spawn("/bin/sh", ["-c", args.join(" "), "|cat"]);
              var count = 0;
              if (base64) {
                convert.stdout.pipe(base64Stream.encode()).pipe(stream);
              } else {
                convert.stdout.pipe(stream);
              }
              gridStream.pipe(convert.stdin);
            }); 
          }
        });
      } else {
        stream.end();
      }
    });
  }

  var renderDocumentPage = function(fileId, page, stream) {
    renderDocumentPageBase(false, fileId, page, stream);
  }

  var renderDocumentPageBase64 = function(fileId, page, stream) {
    renderDocumentPageBase(true, fileId, page, stream);
  }

  var resolveUsersFromData = function(data, callback) {
    utils.resolveUsers(data.recipients, function(r) {
      data.recipientsResolved = r;
      utils.resolveUsers(data.ccList, function(r) {
        data.ccListResolved = r;
        utils.resolveUsers(data.reviewers, function(r) {
          data.reviewersResolved = r;
          utils.resolveUsers([data.nextReviewer], function(r) {
            data.nextReviewerResolved = r[0];
            utils.resolveUsers([data.sender], function(r) {
              data.senderResolved = r[0];
              callback(data);
            });
          });
        });
      });
    });
  }


  var create = function(data, callback) {
      
      db.getCollection(function (error, collection) {
        data._id = collection.pkFactory.createPk();

        db.validateAndInsert(data, function (error, validator) {
          validator.resultId = data._id;
          callback(validator);
        });
      });
  }

  var edit = function (id, data, callback) {
      
      db.findOne({_id: (typeof(id) === "string") ? ObjectID(id) : id }, function(err, item) { 

        if (err == null && item != null) {

          // Log is concatenated, not replaced
          item.log = item.log || []
          data.log = item.log || item.log.concat(data.log);

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
  }

  // Public API
  return {
    // Creates a letter imported from a paper-based letter 
    // Returns a callback
    //    validator: The validator
    createFromExternal: function (data, callback) {

      data.creation = "external"; // created for importing paper-based letters

      create(data, function(validator) {
        callback(validator);
      });
    },

    // Creates a letter
    // Returns a callback
    //    validator: The validator
    createNormal: function (data, callback) {

      data.creation = "normal"; // for outgoing letters

      create(data, function(validator) {
        callback(validator);
      });
    },
    
    // Creates a internal letter (nota dinas)
    // Returns a callback
    //    validator: The validator
    createInternal: function (data, callback) {

      data.creation = "internal"; // for outgoing letters

      create(data, function(validator) {
        callback(validator);
      });
    },

    // Creates a draft letter
    // Returns a callback
    //    validator: The validator
    createDraft : function (draft, callback) {

      var data = { 
        username : draft.username, 
        status : stages.WAITING, 
      }; // for draft letters

      if (draft.draftId) {
        data._id = ObjectID(draft.draftId);
        db.findOne(data, callback);
      } else {
        // insert new draft
        db.getCollection(function (error, collection) {
          data._id = collection.pkFactory.createPk();
          db.insert(data, function(err){
            callback(err, data)
          });
        });
      }
    },

    // Modifies a letter 
    // Returns a callback
    //    validator: The validator
    edit: edit,

    // Lists letters
    //    search: optional search object
    //      <fields>: any of collection fields
    //      limit: limit per page
    //      page: page number
    // Returns a callback
    //    result: The result in array
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
          cursor.sort(search.sort || {date:-1,priority:-1}).limit(limit).skip(offset).toArray(function (error, result) {
            if (result != null && result.length == 1) {
              resolveUsersFromData(result[0], function(data) {
                callback([data]);
              });
            } else {
              callback(result);
            }
          });
        });
      } else {

        db.find(search.search, fields, function(error, cursor) {
          cursor.sort(search.sort || {date:-1,priority:-1}).toArray(function(error, result) {
            console.log("Models result", result);
            if (result != null && result.length == 1) {
              resolveUsersFromData(result[0], function(data) {
                callback([data]);
              });
            } else {
              callback(result);
            }
          });
        });
      } 
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
                if (!gridStore || error) { 
                  if (callback) {
                    return callback(error);
                  } 
                  return;
                }
                var gridStream = gridStore.stream(true);
                gridStream.pipe(stream);
              }); 
            }
          });
        }
      });
    },

    // Sets the read state of a letter, with a fire and forget manner
    //    id: the id of the letter
    //    who: 0 = recipient, 1 = cc
    // Returns via a callback
    setReadState: function (id, who, callback) {
      var search = {
        _id: ObjectID(id),
        $or: [  
                {recipients: { $in: [who]}}, 
                {ccList: {$in: [who]}}
             ]
      }

      db.findOne(search, function(err, item) { 
        if (err == null && item != null) {
          whoSave = who.replace(/\./g,"___"); // HACK so mongo can save this

          var data = item.readStates || {};

          if (data[whoSave] == null || typeof(data[whoSave]) === "undefined") {
            for (var i = 0; i < item.recipients.length; i ++) {
              if (who == item.recipients[i]) {
                if (data.recipients == null
                    || typeof(data.recipients) === "undefined") {
                  data.recipients = {};
                }
                data.recipients[whoSave] =  new Date();
              }
            }

            for (var i = 0; i < item.ccList.length; i ++) {
              if (who == item.ccList[i]) {
                if (data.cc == null
                    || typeof(data.cc) === "undefined") {
                  data.cc = {};
                }
                data.cc[whoSave] =  new Date();
              }
            }

            var set = {
                readStates: data,
            }
           
            db.validateAndUpdate( {
              _id: ObjectID(id) 
            }, {
              '$set': set
            }, function (error,validator) {
              if (callback)
                callback();
            }); 
          }
        }
      });
    },

    // Reject a letter by a user
    reject: function (id, who, organization, reason, callback) {
      var search = {
        _id: ObjectID(id),
        recipients: { $in: [who]}, 
      }

      who = who.replace(/\./g,"___"); // mangle user name 
      
      db.findOne(search, function(err, item) { 
        if (item != null) {
          var data = {};
          data[who] = {
            date: new Date(),
            reason: reason,
          }
          item.rejections = data;
          item.receivingOrganizations[organization].status = stages.REJECTED;
          db.save(item);
          callback(true);
        } else {
          callback(false);
        }
      });
    },

    // Gets document's metadata
    // Return a callback
    //    result: file stream
    getDocumentMetadata: function(fileId, stream) {
      // Find letter title for this file
      db.findOne({'fileAttachments.path': ObjectID(fileId)}, {fileAttachments: 1, _id: 0}, function(error, item){
        if (item != null) {
          var handled = false;
          item.fileAttachments.forEach(function(e) {
            if (e.path == fileId) {
              stream.contentType("text/javascript");
              stream.attachment(e.name);
              var store = app.store(ObjectID(fileId), e.name, 'r');
              store.open(function(error, gridStore) {
                if (!gridStore || error) {
                  stream.end();
                  return;
                }
                // Grab the read stream
                var gridStream = gridStore.stream(true);
                var spawn = require("child_process").spawn;
                var args = ["pdfinfo", "-"];
                var pdfinfo = spawn("/bin/sh", ["-c", args.join(" "), " | cat"]);
                pdfinfo.stdout.on("data", function(data) {
                  stream.send(data);
                });
                gridStream.pipe(pdfinfo.stdin);
              }); 
              handled = true;
            }
          });
          if (!handled) {
            stream.end();
          }
        } else {
          stream.end();
        }
      });
    },



    Stages: stages,

    // Saves attachment
    // it saves attachment to GridStore
    // Input: file
    // Output: callback (err, result), pay attention to result.fileId
    saveAttachmentFile : function(file, callback) {
      var fileId = new ObjectID();
      var store = app.store(fileId, file.name, 'w');

      var fd = fs.openSync(file.path, 'r');

      store.open(function(error, gridStore){
        gridStore.writeFile(fd, function(error, result){
          // Remove uploaded file (physical)
          fs.unlinkSync(file.path);
          callback(error, result);
        });
      }); 
    },


    // Removes a file from a letter fileAttachments array
    // It should be narrowed with some criteria,
    // for draft-with-attachment letter, we can use { username : req.session.currentUser, status : 1}
    //
    // e.g. removing { path : '0abc', type : 'application/pdf', name : 'a.jpg'} from a draft of sri.mulyani, would be
    //
    // removeFileAttachment( 
    //    { username : 'sri.mulyani', status : 1}, 
    //    { path : '0abc', type : 'application/pdf', name : 'a.jpg'}, 
    //    function(err){})
    //
    // Input: search criteria, 
    // Output: callback (err)
    removeFileAttachment : function(criteria, file, callback){
      criteria["fileAttachments"]  = { $exists : true};
      var operator = { $pull : {fileAttachments : file} };
      db.update(criteria, operator, function(err){
        var store = app.store(file.path, file.name, 'w');
        store.open(function(error, gridStore){
          gridStore.unlink(callback)
        })
      });
    },

    // Adds a file to a letter fileAttachments array
    // It should be narrowed with some criteria,
    // for draft-with-attachment letter, we can use { username : req.session.currentUser, status : 1}
    //
    // e.g. adding { path : '0abc', type : 'application/pdf', name : 'a.jpg'} to a draft of sri.mulyani, would be
    //
    // addFileAttachment( 
    //    { username : 'sri.mulyani', status : 1}, 
    //    { path : '0abc', type : 'application/pdf', name : 'a.jpg'}, 
    //    function(err){})
    //
    // Input: search criteria, 
    // Output: callback (err)
    addFileAttachment : function(criteria, file, callback){
      var operator = { $push : { fileAttachments : file} }
      db.update(criteria, operator, callback); 
    },

    // Removes all attachments
    // It should be narrowed with some criteria,
    // for draft-with-attachment letter, we can use { username : req.session.currentUser, status : 1}
    //
    // Input: search criteria, 
    // Output: callback (err)
    removeDraftFileAttachments : function(criteria, callback) {

      if (criteria._id == undefined) {
        return callback(null);
      }

      criteria["status"] = stages.WAITING;
      criteria["fileAttachments"]  = { $exists : true};
      var operator = { $unset : {fileAttachments : 1} }
      db.update(criteria, operator, callback);
    },

    renderDocumentPage: renderDocumentPage,
    renderDocumentPageBase64: renderDocumentPageBase64,

    // Gets number of unread letter from the specified user
    numberOfNewLetters: function(user, callback) {
      var userMangled = user.replace(/\./g, "___");
      var params = {
        recipients: {$in: [user]}
      };
      var field = "readStates.recipients." + userMangled;
      params[field] = {$exists:false};
      db.find(params, {_id:1}, function(error, cursor) {
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
