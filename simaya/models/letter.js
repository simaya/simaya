module.exports = function(app) {
  // Private 
  var _ = require("lodash");
  var db = app.db('letter');
  var org= app.db('organization');
  var user = app.db('user');
  var disposition = app.db('disposition');
  var agendaNumber = app.db('agendaNumber');
  var ObjectID = app.ObjectID;
  var fs = require('fs');
  var moment = require('moment');
  var utils = require('./utils')(app);
  var filePreview = require("file-preview");
  var notification = require("./notification.js")(app);
  var nodeStream = require('stream')
  var async = require("async");
  var qrImage = require("qr-image");
  var PdfDocument = require("pdfkit");
  var spawn = require('child_process').spawn;
  var printControlDb = require("./print-control")(app);
  
  // stages of sending
  var stages = {
    NEW: 0,
    WAITING: 1,
    REVIEWING: 2,
    APPROVED: 3,
    DEMOTED: 4,
    SENT: 5,
    RECEIVED: 6,
    REJECTED: 7
  }

  // These states differ from stages above which shows the state of the letter at a certain point
  var cycleState = {
    DRAFT: 0,
    REVIEW: 1,
    WAITING_FOR_SENDING: 2,
    SENT: 3,
    WAITING_FOR_READING: 4,
    WAITING_FOR_ALL_RECIPIENTS: 5,
    READ_BY_ALL_RECIPIENTS: 6
  }

  var notificationTypes = {
    "letter-sent": {
      sender: {
        recipients: "sender",
        text: "letter-sent-sender",
        url : "/letter/read/%ID",
      },
      recipient: {
        recipients: "administration-recipient",
        text: "letter-sent-recipient",
        url : "/letter/check/%ID",
      },
      directRecipient: {
        recipients: "direct-recipients-in-organization",
        text: "letter-received-recipient",
        url : "/letter/read/%ID",
      }
    },
    "letter-rejected": {
      sender: {
        recipients: "sender",
        text: "letter-rejected-sender",
        url : "/letter/read/%ID",
      },
      originator: {
        recipients: "originator",
        text: "letter-rejected-originator",
        url : "/letter/read/%ID",
      },
      administrationSender: {
        recipients: "administration-sender",
        text: "letter-rejected-administration-sender",
        url : "/letter/read/%ID",
      }
    },
    "letter-received": {
      sender: {
        recipients: "sender",
        text: "letter-received-sender",
        url : "/letter/read/%ID",
      },
      recipient: {
        recipients: "recipients-in-organization",
        text: "letter-received-recipient",
        url : "/letter/read/%ID",
      },
    },
    "letter-review-declined": {
      reviewers: {
        recipients: "previous-reviewers",
        text: "letter-review-declined",
        url : "/letter/check/%ID",
      },
    },
    "letter-outgoing": {
      firstReviewer: {
        recipients: "first-reviewer",
        text: "letter-outgoing",
        url : "/letter/check/%ID",
      },
    },
    "letter-review-approved": {
      originator: {
        recipients: "originator",
        text: "letter-review-approved-originator",
        url : "/letter/check/%ID",
      },
      nextReviewer: {
        recipients: "next-reviewer",
        text: "letter-review-approved-next-reviewer",
        url : "/letter/check/%ID",
      },
    },
    "letter-review-finally-approved": {
      originator: {
        recipients: "originator",
        text: "letter-review-finally-approved-originator",
        url : "/letter/read/%ID",
      },
      reviewers: {
        recipients: "reviewers",
        text: "letter-review-finally-approved-reviewers",
        url : "/letter/read/%ID",
      },
      administrationSender: {
        recipients: "administration-sender",
        text: "letter-review-finally-approved-administration-sender",
        url : "/letter/review/%ID",
      }
    },
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
          if (typeof(update.date) == "undefined" || update.date == null || update.date == "") {
              validator.addError('Data', 'date is not set');
          }
          if ((typeof(update.incomingAgenda) == "undefined" || update.incomingAgenda == null || update.incomingAgenda == "") && (typeof(update.outgoingAgenda) == "undefined" || update.outgoingAgenda == null || update.outgoingAgenda == "")) {
              validator.addError('Data', 'Agenda is not set');
          }
          if (typeof(update.mailId) == "undefined" || update.mailId == null || update.mailId == "") {
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
          // if there's no .body
          if (typeof(update.body) == "undefined" || update.body == null) {

              update.fileAttachments = update.fileAttachments || [];

              if (update.fileAttachments.length == 0) {
                  validator.addError('Data', 'Attachment is not set');
              }

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

  // Validates data when creating draft
  var validateForDraft = function(data, cb) {
    var success = true;
    var fields = [];

    if (!data || typeof(data) !== "object") {
      return cb({
        success: "false",
        fields: [],
        reason: "empty data"
      });
    }

    _.each(["originator", "sender", "creationDate"], function(item) {
      if (!data[item]) {
        success = false;
        fields.push(item);
      }
    });
    return cb({
      success: success,
      fields: fields
    })
  };

  // Validates data when edit 
  var validateForEdit = function(data, cb) {

    var success = true;
    var fields = [];

    var validateOutgoing = function(data) {
      _.each(["date", "sender", "title", "classification", "priority", "type", "comments"], function(item) {
        if (!data[item]) {
          success = false;
          fields.push(item);
        }
      });

      var recipientsDb, recipientsManual;
      if (data["recipients"]) {
        recipientsDb = true;
      }
      if (data["recipientManual"]) {
        recipientsManual = true;
      }

      if (recipientsDb == false && recipientsManual == false) {
        success = false;
        fields.push("recipients");
      }

      var d = new Date(data.date);
      if (d && isNaN(d.valueOf())) {
        success = false;
        fields.push(item);
      }
    }

    var validateManualOutgoing = function(data) {
      _.each(["date", "outgoingAgenda", "mailId", "recipientManual", "title", "classification", "priority", "type", "sender", "comments"], function(item) {
        if (!data[item]) {
          success = false;
          fields.push(item);
        }
      });

      _.each(["date"], function(item) {
        data[item] = new Date(data[item]);
        if (data[item] && isNaN(data[item].valueOf())) {
          success = false;
          fields.push(item);
        }
      });
    }

    var validateManualIncoming = function(data) {
      _.each(["receivedDate", "date", "incomingAgenda", "mailId", "recipient", "title", "classification", "priority", "type" ], function(item) {
        if (!data[item]) {
          success = false;
          fields.push(item);
        }
      });

      _.each(["date", "receivedDate"], function(item) {
        data[item] = new Date(data[item]);
        if (data[item] && isNaN(data[item].valueOf())) {
          success = false;
          fields.push(item);
        }
      });

      if (!data.sender && !data.senderManual) {
        success = false;
        fields.push("sender");
        fields.push("senderManual");
      }
    }

    if (!data || typeof(data) !== "object") {
      return cb({
        success: "false",
        fields: [],
        reason: "empty data"
      });
    }

    if (data.operation == "manual-incoming") {
      validateManualIncoming(data);
    } else if (data.operation == "manual-outgoing") {
      validateManualOutgoing(data);
    } else if (data.operation == "outgoing") {
      validateOutgoing(data);
    }

    return cb({
      success: success,
      fields: fields
    })
  };

  // filter data
  var filter = function(fieldList, data) {
    var fields = {};
    _.each(fieldList, function(item) { fields[item] = 1});
    var keys = [];
    _.each(_.keys(data), function(item) { if (fields[item]) keys.push(item)});

    var filtered = {};
    _.each(keys, function(item) { filtered[item] = data[item] });
    return filtered;
  }


  // Transform input data into data to be kept in DB
  var prepareManualOutgoingData = function(data, cb) {
    var transform = function(data, cb) {
      var outputData = _.clone(data);

      // repopulate with structure

      outputData.date = new Date(data.date);
      outputData.recipients = [];
      outputData.recipientManual = data.recipientManual;
      outputData.status = stages.SENT;

      var fieldList = ["_id", "ccList", "classification", "comments",  "creationDate", "outgoingAgenda", "currentReviewer", "date", "letterhead", "log", "mailId", "originator", "priority", "recipients", "reviewers", "sender", "sender", "senderOrganization", "title", "type", "recipientManual", "receivingOrganizations", "status", "fileAttachments"];

      var filtered = filter(fieldList, outputData);
      cb(filtered);
    }

    var searchNames = [ data.sender ];
    if (data.ccList && typeof(data.ccList) === "string") {
      data.ccList = data.ccList.split(",");
      searchNames = searchNames.concat(data.ccList);
    }
    var userMaps = {};
    user.findArray({username: { $in: searchNames}}, function(err, items) {
      data.receivingOrganizations = {};
      if (err) return cb(null);
      _.each(items, function(item) {
        if (item.profile) {
          var org = item.profile["organization"];
          userMaps[item.username] = org;
        }
      });
      
      if (_.isArray(data.ccList)) {
        _.each(data.ccList, function(item) {
          var org = userMaps[item];
          data.receivingOrganizations[org] = {};
        });

      }
      if (data.sender) {
        data.senderOrganization = userMaps[data.sender];
      }
      transform(data, cb);
    });
  }


  var prepareManualIncomingData = function(data, cb) {
    var outputData = _.clone(data);
    var transform = function(cb) {
      delete(outputData.receivingOrganization);
      delete(outputData.recipient);
      delete(outputData.files);
      delete(outputData.receivedDate);
      delete(outputData.incomingAgenda);
      delete(outputData.operation);
      delete(outputData[undefined]);

      if (data.ccList) {
        outputData.ccList = data.ccList.split(",");
      }

      // mangle org name
      var org = data.receivingOrganization.replace(/\./g, "___");

      // repopulate with structure
      outputData.receivingOrganizations = {};
      outputData.receivingOrganizations[org] = {
        status: 6, // received
        agenda: data.incomingAgenda,
        date: new Date(data.receivedDate)
      }
      outputData.date = new Date(data.date);
      outputData.recipients = [ data.recipient ];
      outputData.status = stages.SENT;
      if (!data.sender) {
        outputData.sender = "";
      }
      cb(outputData);
    }

    var searchNames = [ data.recipient ];
    if (data.sender && !data.senderManual) {
      searchNames.push(data.sender);
    }
    var userMaps = {};
    user.findArray({username: { $in: searchNames}}, function(err, items) {
      if (err) return cb(null);
      _.each(items, function(item) {
        if (item.profile) {
          userMaps[item.username] = item.profile["organization"];
        }
      });
      
      data.receivingOrganization = userMaps[data.recipient]; 
      if (data.sender) {
        data.senderOrganization = userMaps[data.sender];
      }
      transform(cb);
    });
  }

  var prepareOutgoingData = function(data, cb) {
    var outputData = _.clone(data);
    var transform = function(userMaps, cb) {
      delete(outputData.receivingOrganization);
      delete(outputData.recipients);
      delete(outputData.files);
      delete(outputData.message);
      delete(outputData.receivedDate);
      delete(outputData.incomingAgenda);
      delete(outputData.operation);
      delete(outputData[undefined]);

      if (data.ccList && typeof(data.ccList) === "string") {
        outputData.ccList = data.ccList.split(",");
      } else {
        outputData.ccList = data.ccList || [];
      }

      if (data.recipients && typeof(data.recipients) === "string")  {
        outputData.recipients = data.recipients.split(",");
      } else {
        outputData.recipients = data.recipients;
      }

      outputData.senderOrganization = userMaps[data.sender];
      var recipients = outputData.recipients;
      if (outputData.ccList) {
        recipients = recipients.concat(outputData.ccList);
      }
      _.each(recipients, function(recipient) {
        var org = userMaps[recipient];
        if (!org) {
          return;
        }
        // mangle org name
        var org = org.replace(/\./g, "___");

        // repopulate with structure
        outputData.receivingOrganizations = outputData.receivingOrganizations || {};
        outputData.receivingOrganizations[org] = {};
      });

      outputData.recipientManual = data.recipientManual;
      outputData.date = new Date(data.date);
      outputData.status = data.status || stages.REVIEWING;

      if (data.originator == data.sender) {
        outputData.status = stages.APPROVED;
      }

      reviewerListByLetter(outputData, data.originator, data.sender, function(reviewerList) {
        outputData.reviewers = _.pluck(reviewerList, "username");
        if (!outputData.currentReviewer) {
          outputData.currentReviewer = outputData.reviewers[0] || data.sender;
        }

        var fieldList = ["_id", "body", "ccList", "classification", "comments", "createdFromDispositionId", "creationDate", "currentReviewer", "date", "letterhead", "log", "mailId", "originalLetterId", "originator", "priority", "recipients", "reviewers", "sender", "senderManual", "senderOrganization", "title", "type", "receivingOrganizations", "status", "fileAttachments", "recipientManual", "additionalReviewers"];

        var filtered = filter(fieldList, outputData);
        cb(filtered);
      });
    }

    var searchNames = [];
    if (data.sender) {
      searchNames.push(data.sender);
    }

    if (data.recipients && typeof(data.recipients) === "string") {
      searchNames = searchNames.concat(data.recipients.split(","));
    }

    if (data.ccList && typeof(data.ccList) === "string") {
      searchNames = searchNames.concat(data.ccList.split(","));
    }

    var userMaps = {};
    user.findArray({username: { $in: searchNames}}, function(err, items) {
      if (err) return cb(null);
      _.each(items, function(item) {
        if (item.profile) {
          userMaps[item.username] = item.profile["organization"];
        }
      });
      
      transform(userMaps, cb);
    });
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
            stream.contentType("image/png");
            var store = app.store(ObjectID(fileId), e.name, 'r');
            store.open(function(error, gridStore) {
              if (!gridStore || error) {
                stream.end();
                return;
              }
              // Grab the read stream
              var gridStream = gridStore.stream(true);
              // filePreview accepts page starts from 1
              filePreview.preview(gridStream, { encoding: (base64? "base64": ""), page: page + 1}, stream, function(size) {
              });
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

  // Gets document's rendering 
  // Return a callback
  //    result: file stream
  var renderContentPageBase = function(id, who, index, base64, page, stream, cb) {

    contentIndex(id, who, index, function(err, data) {
      if (err) return cb(err);
      contentPdf({
        id: id, 
        username: who,
        index: data.index, 
        ignoreCache: true, 
        disablePrintControl: true,
        stream: null
        }, function(err) {
        if (err && cb) return cb(err);
        var name = ["pdf", id, who, data.index].join("-") + ".pdf"; 
        stream.contentType("image/png");
        var store = app.store(name, 'r');
        store.open(function(error, gridStore) {
          if (!gridStore || error) {
            console.log(error);
            stream.end();
            return;
          }
          // Grab the read stream
          var gridStream = gridStore.stream(true);
          // filePreview accepts page starts from 1
          filePreview.preview(gridStream, { encoding: (base64? "base64": ""), page: page + 1}, stream, function(size) {
          });
        }); 
      });
    });
  }

  var renderContentPage = function(id, who, index, page, stream) {
    renderContentPageBase(id, who, index, false, page, stream);
  }

  var renderContentPageBase64 = function(id, who, index, page, stream) {
    renderContentPageBase(id, who, index, true, page, stream);
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

  var getSenders = function(organization, cb) {
    var orgs = [];
    var pieces = organization.split(";");

    var lastPiece = "";
    _.each(pieces, function(piece) {
      orgs.push (lastPiece + (lastPiece ? ";" : "") + piece);
      lastPiece += (lastPiece ? ";" : "") + piece;
    });

    user.find({
      "profile.organization": { $in: orgs},
      roleList: { $in: [ "sender" ]}
    }, {
      profile: 1, 
      username: 1
    }, function(error, cursor) {
      if (error) return cb(error);
      if (!cursor) return cb(new Error("senders not found"));
      cursor.sort({"profile.organization":1}).toArray(function(error, items){
        cb(error, items);
      });
    })
  }

  var getSelector = function(username, action, options, cb) {
    var getParents = function(path) {
      var orgs = [];
      var splits = path.split(";");

      var prev = "";
      for (var i = 0; i < splits.length; i ++) {
        var org = prev + ";" + splits[i];
        if (!prev) org = splits[i];
        prev = org;
        orgs.push(org);
      }
      return orgs;
    }

    var findUser = function(cb) {
      user.findOne({username: username}, function(err, result) {
        if (result == null) {
          return cb(new Error(), {success: false, reason: "authorized user not found"});
        }
        cb(null, result);
      });
    }

    findUser(function(err, u) {
      if (!u.profile) return cb(new Error(), {success: false, reason: ("user " + u + " is broken")})
      var org = u.profile.organization;
      if (!org) return cb(new Error(), {success: false, reason: ("organization is unknown for user " + u)})
      if (err) return cb(err, org);
      var orgMangled = org.replace(/\./g, "___");
      var selector = {};

      var isAdministration = _.find(u.roleList, function(recipient) {
        return recipient == app.simaya.administrationRole;
      });

      var doneWithCb = false;
      if (action == "draft") {
        if (isAdministration) {
          selector = {
            $or: [
              {   
                status: { $in: [stages.NEW, stages.REVIEWING, stages.APPROVED] },
                originator: username
              },
              {
                status: stages.APPROVED,
                senderOrganization: org
              }
            ]
          }
        } else {
          selector = {
            status: { $in: [stages.NEW, stages.REVIEWING, stages.APPROVED] },
            $or: [
              { originator: username },
              { sender: username },
              { reviewers: { $in: [ username ] }},
            ]
          };
        }
        // draft
      } else if (action == "outgoing") {
        selector = {
          status: stages.SENT,
          sender: { $in: [ username ]}
        };
        // outgoing
      } else if (action == "cc") {
        selector = {
          status: stages.SENT,
          ccList: {
            $in: [ username ]
          },
        };
        selector["receivingOrganizations." + orgMangled + ".status"] = stages.RECEIVED;
        // cc
      } else if (action == "incoming" && options && !options.agenda) {
        if (isAdministration) {
          selector = { 
            status: stages.SENT
          };
          selector["receivingOrganizations." + orgMangled] = { $exists: true };
          selector["receivingOrganizations." + orgMangled + ".status"] = { $exists: false };
        } else {
          selector = {
            status: {
              $in: [stages.SENT, stages.RECEIVED]
            },
            recipients: {
              $in: [ username ]
            },
          };
          selector["receivingOrganizations." + orgMangled + ".status"] = stages.RECEIVED;
        }
        // cc
      } if (action == "open") {
        doneWithCb = true;
        getSenders(org, function(err, items) {
          if (err) return cb(err);
          var superiorOrgs;
          if (items.length > 0) {
              var i = items.pop();
              superiorOrgs = getParents(i.profile.organization);
          }

          if (isAdministration) {
            selector = {
              $or: [
                {   
                  originator: username,
                },
                {
                  status: { $in: [ stages.APPROVED, stages.SENT ] },
                  senderOrganization: org
                }
              ]
            }
            var check = {};
            check["receivingOrganizations." + orgMangled] = { $exists: true };

            selector["$or"].push(check);

          } else {
            selector = {
              $or: [
                { originator: username },
                { sender: username },
                { reviewers: { $in: [ username ] }},
              ]
            };
            var check = {};
            check["receivingOrganizations." + orgMangled] = { $exists: true };
            check["receivingOrganizations." + orgMangled + ".status"] = stages.RECEIVED; 
            selector["$or"].push(check);
          }
          if (superiorOrgs && superiorOrgs.length > 0) {
              _.each(superiorOrgs, function(superiorOrg) {
                  var check = {};
                  var superiorOrgMangled = superiorOrg.replace(/\./g, "___");
                  check["receivingOrganizations." + superiorOrgMangled] = { $exists: true };
                  check["receivingOrganizations." + superiorOrgMangled + ".status"] = stages.RECEIVED; 
                  selector["$or"].push(check);
              });
          }

          cb(null, selector);
        })
        // open
      } else if (action == "incoming" && options && options.agenda) {
        doneWithCb = true;
        getSenders(org, function(err, items) {
          if (err) return cb(err);
          if (items.length > 0) {
            var i = items.pop();
            var org = i.profile.organization;
            var orgMangled = org.replace(/\./g, "___");
            selector = {
              status: {
                $in: [stages.SENT, stages.RECEIVED]
              }
            };

            selector["receivingOrganizations." + orgMangled] = { $exists: true };
            selector["receivingOrganizations." + orgMangled + ".status"] = stages.RECEIVED;

            cb(null, selector);

          }
        });
      } // incoming-agenda
         

      if (!doneWithCb) cb(null, selector);
    });
  }

  var openLetter = function(id, username, options, cb) {
    getSelector(username, "open", options, function(err, selector) {
      if (err) return cb(err, selector);
      if (!id || (typeof(id) === "string") && id.length != 24) {
        cb(null, []);
      } else {
        selector._id = ObjectID(id + "");
        db.findArray(selector, options, function(err, result) {
          if (err) return cb(err, result);

          if (result.length == 1) {
            if (!result[0].recipients && !result[0].receivingOrganizations) {
              result[0].receivingOrganizations = {};
            }
            return cb(err, result);
          } else {
            return cb(err, result);
          }
        });
      }
    });
  }

  var reviewerListByLetter = function(letterId, initiatingUser, topUser, callback) {
    var sameUser = (initiatingUser == topUser);
    var topProfile;
    var findProfile = function(username, cb) {
      if (sameUser && topProfile) {
        // avoid querying the same profile
        return cb(topProfile);
      }
      user.findOne({username: username}, function(err, result) {
        if (result == null) {
          return cb(null);
        }
        if (sameUser) {
          topProfile = result.profile;
        }
        cb(result.profile);
      });
    }

    var findDetails = function(orgs, heads, cb) {
      // First, we add all heads to the list
      user.findArray({
        "profile.organization": { $in: orgs}
      }, {profile: 1, username: 1}, function(error, items){
        if (items && items.length > 0) {
          var results = [];
          _.each(items, function(item) {
            if (heads[item.username]) {
              item.sortOrder = 0;
              _.each(item.profile.organization, function(i) {
                // sort by depth of path
                if (i == ";") item.sortOrder ++;
              });
              if (item.username == topUser) {
                item.type = "sender";
              }
              results.push(item);
            }
          });

          // Last, we add the sender if she's not yet on the list
          var headNames = Object.keys(heads);
          if (!sameUser && _.findIndex(headNames,function(item) { return item == topUser}) == -1) {
            results.push({
              username: topUser,
              profile: topProfile,
              type: "sender",
              sortOrder: -1
            });
          }
          var result = _.sortBy(results, "sortOrder").reverse();
          cb(result);
        } else {
          cb([]);
        }
      });
    }

    var findHeads = function(orgs, cb) {
      var query = {
        path: {
            $in: orgs 
          }
      };
      org.findArray(query, function(error, orgs) {
        var heads = {};

        if (orgs && orgs.length > 0) {
          // Gets the heads map
          _.each(orgs, function(item) {
            if (item.head && item.path) {
              heads[item.head] = item.path;
            }
          });
          cb(heads);
        } else {
          cb(null);
        }
      });
    }

    var populateResult = function(result) {
      var markCurrentAndLog = function(data) {
        _.each(result, function(item) {
          if (data.currentReviewer && item.username == 
              data.currentReviewer) {
            item.current = true;
          }
          if (data.log) {
            for (var i = data.log.length - 1; i >= 0; i --) {
              var log = data.log[i];
              if (item.username == log.username) {
                item.action = log.action;
                item.date = log.date;
                item.message = log.message;
                break;
              }
            }
          }
        });
        callback(result);
      }

      var insertAdditionalReviewers = function(reviewers, cb) {
        user.findArray({
          "username": { $in: reviewers }
        }, {profile: 1, username: 1}, function(error, items){
          if (error) return cb(err);
          if (!items || items.length == 0) return cb(new Error("additional reviewers are not found in db"));

          var maps = {};
          // Check for duplicates and prepare maps
          // we need the map to maintain the order 
          // of the additional reviewers
          _.each(items, function(item) {
            var dup = _.find(result, function(r) {
              return r.username == item.username;
            });
            if (dup) {
              item.duplicate = true;
            } else {
              item.additional = true;
            }
            maps[item.username] = item;
          });
          // Take out the sender
          var sender = result.pop();
          // insert the additionals
          _.each(reviewers, function(item) {
            if (!maps[item].duplicate) result.push(maps[item]);
          });
          // Put back the sender on the back of the list
          result.push(sender);
          cb(null);
        });
      }

      
      if (!letterId) return callback(result);
      if (letterId && (
              (typeof(letterId) === "string") || 
              (typeof(letterId) === "object" && (letterId +"").length == 24)
            )) {
        openLetter(letterId, initiatingUser, {}, function(err, data) {
          if (err) return callback(err);
          if (!data || data.length != 1) return callback(new Error("letter is not found"));
          if (data[0].additionalReviewers) {
            insertAdditionalReviewers(data[0].additionalReviewers, function(err) {
              if (err) return callback(err);
              markCurrentAndLog(data[0]);
            });
          } else {
            markCurrentAndLog(data[0]);
          }
        });
      } else if (typeof(letterId) === "object" 
          && letterId.additionalReviewers
          ) {
        var data = letterId;
        insertAdditionalReviewers(data.additionalReviewers, function(err) {
          if (err) return callback(err);
          markCurrentAndLog(data);
        });
      } else {
        return callback(result);
      }
    }

    findProfile(initiatingUser, function(initial) {
      // initiating org couldn't be found
      if (!initial || !initial.organization) return callback([]);
      findProfile(topUser, function(top) {
        // top org couldn't be found
        if (!top || !top.organization) return callback([]);

        // Keep topProfile
        // we will check it again in findDetails
        topProfile = top;
        if (top.organization.length > initial.organization.length) {
          // top.organization path is longer than initiating org
          return callback([]);
        }

        if (initial.organization.indexOf(top.organization) != 0) {
          // initiating org is not part of top org
          return callback([]);
        }

        // all set
        var orgs = [ initial.organization ];
        var org = initial.organization;
        while (1) {
          if (org == top.organization) break;
          var index = org.lastIndexOf(";");
          if (index >= 0) {
            var org = org.substr(0, index); 
            orgs.push(org);
            if (sameUser) break;
          } else break;
        }

        findHeads(orgs, function(heads) {
          // no heads found
          if (!heads) return callback([]);
          if (heads[initiatingUser] == initial.organization && orgs.length > 1) {
            orgs.shift();
          }

          findDetails(orgs, heads, function(result) {
            populateResult(result);
          });
        });
      });
    });
  }

  var findAdministration = function(office, cb) {
      var query = {
          roleList: { $in: [ app.simaya.administrationRole ] }
      }
      if (_.isArray(office)) {
          query["profile.organization"] = { $in: office }
      } else {
          query["profile.organization"] = office;
      }
      user.findArray(query, cb);
  };

  //
  // data.office
  //
  var sendNotification = function(sender, type, data, cb) {      
    var findMyOrganization = function(cb) {
      user.findArray({username: sender}, function(err, result) {
        if (result && result.length == 1) {
          cb(result[0].profile.organization);
        } else {
          cb(null);
        }
      });
    };

    var findRecipientsInMyOrg = function(org, cb) {
      if (!cb) {
        return cb(null, []);
      }
      var recipients = data.record.recipients;
      if (data.record.ccList) {
        recipients = recipients.concat(data.record.ccList);
      }
      var query = { }
      query["profile.organization"] = org;
      query["username"] = { $in: recipients };
      user.findArray(query, cb);
    };

    var prepareRecipients = function(entry, cb) {
      var recipients = [];
      var reviewers = data.record.reviewers;
      var currentReviewer = data.record.currentReviewer;
      if (entry.recipients == "direct-recipients-in-organization") {
        var funcs = [];

        _.each(data.record.recipients, function(username) {
          var f = function(fn) {
            user.findOne({username: username}, function(err, result) {
              if (err) return fn(err);
              var organization = result.profile.organization;
              if (!organization) return fn(null);

              org.findOne({ path: organization}, function(err, result) {
                if (err) return fn(err);
                if (result && result.head != username) {
                  // direct letter to staff
                  // auto receive
                  recipients.push(username);
                } 
                fn(null);
              });
            });
          }
          funcs.push(f);
        });
        async.series(funcs, function(err, result) {
          if (err) return cb(err);
          return cb(recipients);
        });
      } 
      else if (entry.recipients == "recipients-in-organization") {
        findMyOrganization(function(org) {
          findRecipientsInMyOrg(org, function(err, result) {
            return cb(result);
          });
        });
      } else if (entry.recipients == "administration-sender") {
        var office = data.record.senderOrganization;
        findAdministration(office, function(err, result) {
          return cb(result);
        });
      } else if (entry.recipients == "administration-recipient") {
        if (data.record.receivingOrganizations) {
          var office = Object.keys(data.record.receivingOrganizations); 
          findAdministration(office, function(err, result) {
            return cb(result);
          });
        }
      } else if (entry.recipients == "first-reviewer") {
        recipients.push(reviewers[0]);
      } else if (entry.recipients == "next-reviewer") {
        recipients.push(currentReviewer);
      } else if (entry.recipients == "previous-reviewers") {
        recipients.push(data.record.originator);
        if (data.record.originator != currentReviewer) {
          _.each(reviewers, function(item) {
            recipients.push(item);
            if (currentReviewer == item) return false;
          });
        }
      } else if (entry.recipients == "reviewers") {
        _.each(reviewers, function(item) {
          if (sender != item) { 
            recipients.push(item);
          }
        });
      } else {
        var candidates = data.record[entry.recipients];
        
        if (candidates) {
          if (!_.isArray(candidates)) {
            recipients = [ candidates ];
          } else {
            recipients = candidates;
          }
        }
      }

      return cb(recipients);
    };

    var send = function(sender, recipient, text, url) {
      setTimeout(function() {
        if (url) url = url.replace("%ID", data.record._id);
        if (recipient && recipient.username) {
          recipient = recipient.username;
        }

        if (sender != recipient) { 
          notification.set(sender, recipient, text, url, cb);
          //console.log("Not: ", type, sender, recipient, text, url, cb);
        }
      }, 0);
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

  // Gets letter view
  // Input: {String} id letter id
  //        {String} username Username performs the opening
  //        {Function} callback result callback
  var view = function(id, me, office, cb) {
    var officeMangled = office.replace(/\,/g, "___");
    var options = {};
    var l = {
      meta: {
        canReject: false,
        allowDisposition: false,
        underReview: false,
        outgoing: false,
        incoming: false,
        cycleState: 0,
          // these two below are copies of the same field in l.data
          // but contains some read states
        recipients: [],
        ccList: [],
      }, 
      data: {}, 
      disposition: {
        list: [],
        orgs: {}
      }
    };

    var findOrg = function(cb) {
      user.findOne({username: me}, function(err, result) {
        if (err) cb(err);
        if (result == null) {
          return cb(new Error(), {success: false, reason: "authorized user not found"});
        }
        cb(null, result.profile.organization);
      });
    }

    var isIncomingAgenda = function(org, recipients) {

          console.log(org);
      return (l.data.receivingOrganizations &&
          l.data.receivingOrganizations[org]);
    }

    var isRecipient = function(recipients) {
      return _.find(recipients, function(recipient) {
        return recipient == me;
      });
    }

    var isSender = function() {
      return (l.data.originator == me) ||
        (l.data.sender == me) ||
        (l.data.senderOrganization == office)
        ; 
    }

    var inDisposition = function() {
      var result = false;
      _.each(l.disposition, function(d) {
        _.each(d.recipients, function(r) {
          if (r.recipient == me) {
            result = true;
            return false;
          }
        });
      });
      return result;
    }

    var clearSecret = function() {
      l.data.attachments = [];
      l.data.body = "";
      l.data.content = {};
      l.data.comments = "";
    }

    // seen by recipients and agenda
    var recipientView = function(agenda) {
      var mangled = office.replace(/\./g, "___");
      var recipientData = l.data.receivingOrganizations[mangled]; 
      if (recipientData) {
        l.data.incomingAgenda = recipientData.agenda;
        l.data.receivedDate = recipientData.date;
      }

      l.data.reviewers = [];
      l.meta.incoming = true;
      l.meta.outgoing = false;

      if (agenda) {
        // Remove contents of letter with secret classification
        if (l.data.classification != 0) {
          clearSecret();
        }
        // allow disposition when me is in disposition
        if (inDisposition()) {
          l.meta.allowDisposition = true;
        }
      } else {
        // Can reject as long as there's no disposition yet
        // and me is the recipient
        if (!l.disposition.orgs[officeMangled] &&
            isRecipient(l.data.recipients)) {
          l.meta.canReject = true;
        }
        // recipient is always able to issue dispositions
        if (isRecipient(l.data.recipients)) {
          l.meta.allowDisposition = true;
        }
      }
    }

    // seen by cc and agenda
    var ccView = function(agenda) {
      recipientView(agenda);
    }

    // seen by sender and agenda
    var senderView = function() {
      var agenda = true;
      l.meta.outgoing = true;
      l.meta.incoming = false;

      if (l.data.sender == me) agenda = false; 
      if (agenda) {

        // Remove contents of letter with secret classification
        if (parseInt(l.data.classification) != 0) {
          clearSecret();
        }
      }
    }

    // seen by outgoing reviewers 
    var outgoingView = function() {
      l.meta.outgoing = true;
      l.meta.incoming = false;
    }

    var getDispositions = function(cb) {
      disposition.findArray({letterId: ObjectID("" + id)}, function(err, result) {
        l.disposition.list = result;
        var map = {};
        if (result && result.length > 0) {
          _.each(result.recipients, function(item) {
            map[item.recipient] = 1;
          });
        }
        var dispositionRecipients = Object.keys(map);
        user.findArray({username: {$in: dispositionRecipients}}, {username:1, profile:1}, function(err, r) {
          _.each(r, function(item) {
            if (item.profile && item.profile.organization) {
              var mangled = item.profile.organization.replace(/\./g, "___");
              l.disposition.orgs[mangled] = 1; 
            }
          });
          cb();
        });
      });
    }

    openLetter(id, me, options, function(err, result) {
      if (err) return cb(err);
      if (result.length != 1) return cb(new Error("letter is not found"));

      l.data = result[0];
      if (l.data.status <= 4) {
        l.meta.underReview = true;
        if (l.data.status == stages.NEW) {
          l.meta.cycleState = cycleState.DRAFT;
        } else if (l.data.status >0 && l.data.status <stages.APPROVED) {
          l.meta.cycleState = cycleState.REVIEW;
        } else if (l.data.status == stages.APPROVED) {
          l.meta.cycleState = cycleState.WAITING_FOR_SENDING;
        } else if (l.data.status == stages.SENT) {
          l.meta.cycleState = cycleState.SENT;
        }
      } else {
        var mangled = office.replace(/\./g, "___");
        var recipientData = l.data.receivingOrganizations[mangled]; 
        if (recipientData) {
          if (recipientData.agenda) {
            l.meta.cycleState = cycleState.WAITING_FOR_READING
          }
        }
        if (l.data.readStates && l.data.readStates.recipients) {
          var r = l.data.readStates.recipients;
          var numRead = 0;
          _.each(l.data.recipients, function(item) {
            var m = item.replace(/\./g, "___");
            if (r[m]) numRead ++;
          });
          if (numRead == l.data.recipients.length) {
            l.meta.cycleState = cycleState.READ_BY_ALL_RECIPIENTS;
          } else {
            l.meta.cycleState = cycleState.WAITING_FOR_ALL_RECIPIENTS;
          }
        }
      }

      _.each(l.data.recipients, function(item) {
        var m = item.replace(/\./g, "___");
        var data = {
          username: item,
        }
        if (l.data.readStates) {
          if (l.data.readStates.recipients && l.data.readStates.recipients[m]) {
            data.read = l.data.readStates.recipients[m];
          }
        }
        l.meta.recipients = data;
      });

      _.each(l.data.ccList, function(item) {
        var m = item.replace(/\./g, "___");
        var data = {
          username: item,
        }
        if (l.data.readStates) {
          if (l.data.readStates.ccList && l.data.readStates.ccList[m]) {
            data.read = l.data.readStates.ccList[m];
          }
        }
        l.meta.ccList = data;
      });

      getDispositions(function() {
        findOrg(function(err, org) {
          if (isRecipient(result[0].recipients)) recipientView(false);
          else if (isIncomingAgenda(org)) recipientView(true);
          else if (isRecipient(result[0].ccList)) ccView(false);
          else if (isSender(result[0])) senderView();

          if (l.meta.underReview) outgoingView();

          cb(null, l);
        });
      });
    });
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

  var populateSort = function(type, input) {
    var typeMap = {
      "letter-incoming": {
        type: "date",
        dir: -1
      },
      "letter-draft": {
        type: "date",
        dir: -1
      },
      "agenda-incoming": {
        type: "date",
        dir: -1
      },
      "default": {
        type: "date",
        dir: -1
      }
    }

    var defaultSort = typeMap[type];
    if (!defaultSort) defaultSort = typeMap["default"];
    var key = defaultSort.type;
    var dir = defaultSort.dir;
    if (input && input.type && input.dir) {
      key = input.type;
      dir = input.dir;
    }
    var sort = {};
    sort[key] = dir;
    if (sort["date"]) {
      // If it is sorted by date, then make the creationDate is also with the same order
      sort["creationDate"] = sort["date"];
    }
    return sort;
  }

  // Prepares query 
  var populateSearchQuery = function(selector, options, cb) {
    if (!options || !options.search) return cb(null, selector);

    var searchString = options.search.string;
    var searchType = options.search.letterType; 
    var org = options.search.organization;

    var user = app.db('user');
    user.findArray({"profile.fullName" : { $regex: searchString, $options: "i" }}, function(err, userInfo) {
      if (err) return cb(err);
      var users = [];
      _.each(userInfo, function(u) {
        users.push(u.username);
      });

      var searchObj = {
        $or : [
        {
          "title": { $regex : searchString, $options: "i" }
        }
        , {
          "body": { $regex : searchString, $options: "i" }
        }
        , {
          "senderManual.name": { $regex : searchString, $options: "i" }
        }
        , {
          "senderManual.organization": { $regex : searchString, $options: "i" }
        }
        , {
          "mailId": { $regex : searchString, $options: "i" }
        }
        , {
          "outgoingAgenda": { $regex : searchString, $options: "i" }
        }
        ]}


      if (org) {
        var t = "receivingOrganizations." + org + ".agenda";
        var orgSearch = {};
        orgSearch[t] = searchString;
        searchObj["$or"].push(orgSearch);
      }
      if (users.length > 0) {
        searchObj["$or"].push({ sender: { $in: users }});
        searchObj["$or"].push({ recipients: { $in: users }});
      }

      if (searchType) {
        searchObj["type"] = searchType;
      }

      var newSelector = { "$and": [] };
      newSelector["$and"].push(searchObj);
      newSelector["$and"].push(selector);

      cb(null, newSelector);
    });
  }

  var findBundle = function(type, selector, options, cb) {
    var sort = populateSort(type, options.sort);
    var limit = options.limit || 20;
    var page = options.page || 1;
    var skip = (page - 1) * limit;
    var exposeAgenda = function(data) {
      _.each(data, function(item) {
        var orgName = options.myOrganization;
        if (!orgName) return;
        while (true) {
          var org = item.receivingOrganizations[orgName] || {};
          item.incomingAgenda = org.agenda;
          if (item.incomingAgenda) break;
          var loc = orgName.lastIndexOf(";");
          if (loc < 0) break;
          orgName = orgName.substr(0, loc);
        }

      });
    }

    populateSearchQuery(selector, options, function(err, selector) {
      if (err) return cb(err);
      delete(options.search);
      db.find(selector, options, function(err, cursor) {
        if (err) return cb(err);
        cursor.count(false, function(err, count) {
          if (err) return cb(err);
          cursor.
            sort(sort).
            skip(skip).
            limit(limit).
            toArray(function(err, result) {
              if (err) return cb(err);
              var obj = {
                type: type,
                total: count,
                data: result
              }
              if (type == "letter-incoming") {
                exposeAgenda(result);
              }
              cb(null, obj);
            });
        });
      });
    });

  }

  var contentIndex = function(id, who, index, cb) {
    openLetter(id, who, {}, function(err, data) {
      if (data.length != 1) return cb(new Error("letter is not found"));
      var data = data[0];
      if (!data.content) return cb(new Error("letter does not have content"));
      var file;
      var length = data.content.length;
      var realIndex = -1;
      if (index == -1) {
        realIndex = length - 1;
        file = data.content[realIndex];
      } else if (index < length) {
        realIndex = index;
        file = data.content[realIndex];
      } else {
        return cb(new Error("content is not found in the letter"));
      }
      cb(null, {
        index: realIndex,
        file: file.file
      });
    });
  }

  var downloadContent = function(id, who, index, stream, cb) {
    contentIndex(id, who, index, function(err, data) {
      if (err) return(cb(err));
      console.log(data);
      stream.contentType(data.file.type);
      stream.attachment(data.file.name);
      var store = app.store(data.file._id, data.file.name, "r");
      store.open(function(error, gridStore) {
        if (error) {
          return cb(new Error("content is not available in db"));
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
          if (error) return cb(error);
        });
        gridStream.on("end", function() {
          cb(null);
        });
        gridStream.pipe(stream);
      });
    });
  };

  // Prepare print control id and qr code image
  // Input: options.inputStream: original pdf stream
  //        options.stream: output stream
  var printControl = function(options, cb) {
    var inputFile = options.inputFile;
    var outputStream = options.stream;

    var id = ObjectID();
    var url = options.protocol + "://" + options.host + "/print-control/" + id;

    var png = qrImage.image(url, {type: "png"});
    var qrCodeFile = "/tmp/" + id + ".png";
    var writeStream = fs.createWriteStream(qrCodeFile);

    console.log("PC", url);

    // Input: stampFile, local file of stamp pdf 
    var combine = function(stampFile, fn) {
      var args = ["pdftk", inputFile, "stamp", stampFile, "output", "-"];
      var done = function() {
        outputStream.end();
        fn();
      }

      outputStream.contentType("application/pdf");
      var preview = spawn("/bin/sh", ["-c", args.join(" ")]);
      preview.on("error", function() {
        done();
      });

      preview.on("close", function() {
        done();
      });

      preview.stdout.on("data", function(data) {
        outputStream.write(data);
      });
    }

    var generatePdfStamp = function() {
      var pdf = new PdfDocument({ size: "a4"});
      // embed png file
      pdf.image(qrCodeFile, 8, 794, { width: 40} );
      // remove generated png file
      fs.unlinkSync(qrCodeFile);

      // generate pdf stamp
      var stampFile = "/tmp/" + id + ".pdf";
      var stamp = fs.createWriteStream(stampFile);
      pdf.pipe(stamp);
      pdf.end();

      // combine generated pdf and the input stream
      combine(stampFile, function() {
        // clean up
        fs.unlinkSync(stampFile);
        options._id = id;
        printControlDb.insert(options, function() {
          cb(null);
        });
      });
    }

    writeStream.on("finish", function() {
      // generate pdf page with qr code embedded
      generatePdfStamp();
    });

    // Generate qr code
    png.pipe(writeStream);
  }

  var contentPdf = function(options, cb) {
    var id = options.id;
    var who = options.username;
    var index = options.index;
    var ignoreCache = options.ignoreCache;
    var stream = options.stream;
    var host = options.host;
    var protocol = options.protocol;
    var disablePrintControl = options.disablePrintControl;
    var name, path;

    var getFromDb = function(cb) {
      if (stream == null) {
        return cb(null);
      }
      var store = app.store(name, "r");
      store.open(function(error, gridStore) {
        if (error) {
          return cb(new Error("content is not available in db"));
        }
        // Grab the read stream
        if (!gridStore || error) { 
          if (callback) {
            return callback(error);
          } 
          return;
        }

        var gridStream = gridStore.stream(true);
        if (disablePrintControl) {
          gridStream.on("error", function(error) {
            if (error) return cb(error);
          });
          gridStream.on("end", function() {
            cb(null);
          });
          gridStream.pipe(stream);
        } else {
          var inputFile = "/tmp/" + name; 
          var pdfStream = fs.createWriteStream(inputFile);
          pdfStream.on("finish", function() {
            options.inputFile = inputFile;
            options.type = "content";
            printControl(options, function(err) {
              fs.unlinkSync(inputFile);
              printControlDb.insert(options, function() {
                cb(err);
              });
            });
          });
          gridStream.pipe(pdfStream);
        }
      });
    }

    var saveToDb = function() {
      var outStream = fs.createWriteStream(path.replace(/.pdf$/, ".odt"));
      outStream.contentType = function() {};
      outStream.attachment = function() {};
      downloadContent(id, who, index, outStream, function(err, result) {
        if (err) return cb(err);
        var exec = require("child_process").exec;
        var child = exec("libreoffice --headless --invisible --convert-to pdf --outdir /tmp " + path.replace(/.pdf$/, ".odt"),
          function (error, stdout, stderr) {
            console.log("LO", error, stdout, stderr);
            var file = {
              path: path,
              name: name
            }
            saveAttachmentFile(file, function(err, result) {
              console.log(path);
              try {
                fs.unlinkSync(path.replace(/.pdf$/, ".odt"));
              } catch(e) {
              }
              getFromDb(cb);
            });
          }
        );
      });
    }

    contentIndex(id, who, index, function(err, data) {
      if (err) return cb(err);
      name = ["pdf", id, who, data.index].join("-") + ".pdf"; 
      path = "/tmp/" + name;
      if (ignoreCache) {
        saveToDb();
      } else {
        getFromDb(function(err) {
          if (err) {
            saveToDb();
          } else {
            cb(null); 
          }
        });
      }
    });
  }

  var contentMetadata = function(id, who, index, cb) {
    openLetter(id, who, {}, function(err, data) {
      if (err) return cb(err);
      var name = ["pdf", id, who, index].join("-") + ".pdf"; 

      var store = app.store(name, "r");
      store.open(function(error, gridStore) {
        if (error) {
          return cb(new Error("content is not available in db"));
        }
        var gridStream = gridStore.stream(true);

        filePreview.info(gridStream, function(data) {
          cb(data);
        });
      });
    });
  }


  var link = function(who, target, ids, cb) {
    var funcs = [];
    var links = [];
    var administrationUser;

    var findOrg = function(username, cb) {
      user.findOne({username: username}, function(err, result) {
        if (result == null) {
          return cb(new Error(), {success: false, reason: "authorized user not found"});
        }
        cb(null, result.profile.organization);
      });
    }

    findOrg(who, function(err, myOrg) {
      if (err) return cb(err);
      openLetter(target, who, {}, function(err, data) {
        if (err) return cb(err);
        if (!data || data.length < 0) return cb(new Error("Unable to open target letter"));
        _.each(ids, function(id) {
          var f = function(fn) {
            // Try to open the letter one by one
            openLetter(id, who, {}, function(err, data) {
              if (err) console.log(arguments);
              if (data && data.length > 0 && !err) {
                _.each(data, function(item) {
                  item.receivingOrganizations = item.receivingOrganizations || {};
                  var testUsers = [ item.originator ];

                  var makeLink = function() {
                    if (target && 
                        item._id && 
                        target.toString() != item._id.toString()) {
                      // Only link the successfully opened letter
                      links.push({
                        _id: item._id,
                        title: item.title
                      });
                    }
                  };

                  if (_.isArray(item.reviewers)) testUsers = testUsers.concat(item.reviewers);
                  if (item.sender) testUsers.push(item.sender);
                  if (_.isArray(item.recipients)) testUsers = testUsers.concat(item.recipients);

                  findAdministration(item.senderOrganization, function(err, admins) {

                    if (admins && admins.length > 0) {
                      _.each(admins, function(admin) {
                        testUsers.push(admin.username); 
                      });
                    }
                    var found = _.findIndex(testUsers, function(r) {return who==r}) >= 0;
                    if (!found) {
                      var orgs = Object.keys(item.receivingOrganizations);
                      var orgName = myOrg; 

                      while (true) {
                        _.each(orgs, function(letterOrg) {
                          if (letterOrg == orgName) {
                            found = true;
                            return;
                          }
                        });
                        if (found) break;
                        var loc = orgName.lastIndexOf(";");
                        if (loc < 0) break;
                        orgName = orgName.substr(0, loc);
                      }

                      if (!found)
                      return fn(new Error("Unauthorized user"));
                    }
                    makeLink();
                    fn(null);
                  });
                });
              } else {
                fn(null);
              }
            });
          }
          funcs.push(f);
        });
        async.series(funcs, function(err, result) {
          if (err) return cb(err);
          if (links.length > 0) {
            db.update({_id: ObjectID(target)}, 
                { 
                  $set: {
                    links: links
                  }
                }
                , function(err){
                  if (err) return cb(err);
                  cb(null, links);
                });
          } else {
            cb(new Error("No letter can be linked"));
          }
        });
      });
    });
  }

  // Public API
  return {
    // Creates a letter
    // Returns a callback
    //    validator: The validator
    createNormal: function (data, callback) {

      data.creation = "normal"; // for outgoing letters

      create(data, function(validator) {
        callback(validator);
      });
    },

    // Creates a letter
    // Returns a callback
    //    validator: The validator
    createExternal: function (data, callback) {

      data.creation = "external"; // for outgoing external letters

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
        status : stages.NEW
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
    downloadAttachment: function(options, callback) {
      var fileId = options.id;
      var stream = options.stream;
      // Find letter title for this file
      db.findOne({'fileAttachments.path': ObjectID(fileId)}, {fileAttachments: 1, _id: 1}, function(error, item){
        if (item != null) {
          var processed = false;
          item.fileAttachments.forEach(function(e) {
            if (e.path.toString() == fileId.toString()) {
              processed = true;
              stream.contentType(e.type);
              stream.attachment(e.name);
              var store = app.store(e.path, e.name, "r");
              store.open(function(error, gridStore) {
                // Grab the read stream
                if (!gridStore || error) { 
                  if (callback) {
                    return callback(error);
                  } 
                  return;
                }
                var gridStream = gridStore.stream(true);
                if (/\.pdf$/.test(e.name)) {
                  // Embed qr code on pdf files
                  var inputFile = ("/tmp/" + e.name).replace(/ /g, "-"); 
                  var pdfStream = fs.createWriteStream(inputFile);
                  pdfStream.on("finish", function() {
                    options.type = "attachment";
                    options.inputFile = inputFile;
                    options.extra = {
                      letterId: item._id
                    };
                    console.log(inputFile);
                    printControl(options, function(err) {
                      fs.unlinkSync(inputFile);
                      callback(err);
                    });
                  });
                  gridStream.pipe(pdfStream);

                } else {
                  gridStream.on("error", function(error) {
                    if (callback) return callback(error);
                  });
                  gridStream.on("end", function() {
                    if (callback) callback(null);
                  });
                  gridStream.pipe(stream);
                }
              });
            }
          });
          if (!processed) {
            if (callback) callback(new Error("missing file"));
          }
        } else {
          if (callback) callback(new Error("missing file"));
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
                readStates: data
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
        recipients: { $in: [who]}
      }

      who = who.replace(/\./g,"___"); // mangle user name 
      
      db.findOne(search, function(err, item) { 
        if (item != null) {
          var data = {};
          data[who] = {
            date: new Date(),
            reason: reason
          }
          item.rejections = data;
          item.receivingOrganizations[organization].status = stages.REJECTED;
          db.save(item, function() {
            callback(true);
          });
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
                filePreview.info(gridStream, function(data){
                  if (!data){
                    return stream.send(400, {});
                  } else {
                    stream.send(data);
                  }
                });
              });
            }
          });
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
    saveAttachmentFile : saveAttachmentFile,

    // Removes a file from a letter fileAttachments array
    // It should be narrowed with some criteria,
    // for draft-with-attachment letter, we can use { username : req.session.currentUser, status : 1}
    //
    // e.g. removing { path : '0abc', type : 'application/pdf', name : 'a.jpg'} from a draft of user, would be
    //
    // removeFileAttachment( 
    //    { username : 'user', status : 1}, 
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
    // e.g. adding { path : '0abc', type : 'application/pdf', name : 'a.jpg'} to a draft of user, would be
    //
    // addFileAttachment( 
    //    { username : 'user', status : 1}, 
    //    { path : '0abc', type : 'application/pdf', name : 'a.jpg'}, 
    //    function(err){})
    //
    // Input: search criteria, 
    // Output: callback (err)
    addFileAttachment : function(criteria, file, callback){
      var operator = { $push : { fileAttachments : file} }
      db.update(criteria, operator, callback); 
    },

    // Adds content to a letter
    // Input: {ObjectId} id
    //        {String} who the person who modifies the content
    //        {File} file the file to be inserted into the content
    //        {Callback} callback
    //        {Error} error non-null when error happens
    //        {Number} numRecord 1 when modification is successful
    modifyContent: function(id, who, file, callback){
      saveAttachmentFile(file, function(err, result) {
        if (err) return callback(err);
        file._id = result.fileId;
        var operator = { 
          $push : { 
            content: {
              file: file,
              date: new Date(),
              committer: who
            }
          } 
        }

        db.update({ _id: ObjectID(id + "")}, operator, callback); 
      });
    },

    // Gets the content of a letter
    // Input: {ObjectId} id
    //        {Number} index the content revision
    //        {String} who the person who tries to get the content
    //        {Stream} stream the stream for getting the download
    //        {Callback} callback
    //        {Error} error non-null when error happens
    downloadContent: downloadContent,

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
    },

    // Gets list of reviewers 
    // Input: {ObjectId} letterId letter id
    //        {String} initiatingUser user who creates the letter
    //        {String} topUser user who sign the letterr
    //        {Function} result callback of [Result
    //        [Result] result, contains the reviewer list
    //        {ObjectId} result._id the id of the reviewer
    //        {String} result.username the username of the reviewer
    //        {Object} result.profile the profile of the reviewer
    //        {Number} result.sortOrder the sort order of the reviewer, the lower is to review the letter last
    reviewerListByLetter: reviewerListByLetter,

    // Creates a letter
    // Input: {Object} data
    //        {String} data.originator letter originator
    //        {String} data.sender letter sender
    //        {String} data.creationDate letter creation date
    //        {Function} result callback of {Object}
    //        {Error} error 
    //        {Array} result, contains a single record 
    //
    createLetter: function(data, cb) {
      var insert = function(data, cb) {
        db.insert(data, function(err, result) {
          cb(err, result);
        });
      }

      validateForDraft(data, function(result) {
        if (result.success) {
          data.log = [ {
            date: new Date(),
            username: data.originator,
            action: "created",
            message: "Surat dibuat",
          } ]

          insert(data, cb);
        } else {
          cb(new Error(), result);
        }
      });
    },

    // Edits a letter
    // Input: {Object} selector
    //        {Object} data
    //        {String} data.operation operation to process
    //        "manual-outgoing" manually creating an outgoing letter
    //        "manual-incoming" manually creating an incoming letter
    //        "outgoing" creating an outgoing letter
    //        "review" reviewing a letter
    //        {Function} result callback of {Object}
    //        {Error} error 
    //        {Array} result, contains a single record 
    //
    editLetter: function(selector, data, cb) {
      var notifyParties = function(err, result) {
        if (err) return cb(err, result);
        db.findArray(selector, function(err, result) {
          if (err) return cb(err, result);

          if (data.operation == "outgoing") {
            if (result[0].status == stages.APPROVED) { 
              sendNotification(data.originator, "letter-review-finally-approved", { record: result[0]});
            } else {
              sendNotification(data.originator, "letter-outgoing", { record: result[0]});
            }
          } else if (data.operation == "manual-incoming") {
            sendNotification(result[0].originator, "letter-received", { record: result[0]});
          }
          cb(null, result);
        });
      }

      var edit  = function(data, cb) {
        delete(data.operation);
        delete(data._id);
        db.update(selector, {$set: data}, notifyParties);
      }

      var prepareDataFunc = function(data, cb) {
        cb(data);
      }
      if (data.operation == "manual-incoming") {
        prepareDataFunc = prepareManualIncomingData;
      } else if (data.operation == "manual-outgoing") {
        prepareDataFunc = prepareManualOutgoingData;
      } else if (data.operation == "outgoing") {
        prepareDataFunc = prepareOutgoingData;
      }
      validateForEdit(data, function(result) {
        if (result.success) {
          prepareDataFunc(data, function(preparedData) { 
            edit(preparedData, cb);
          });
        } else {
          cb(new Error(), result);
        }
      });
    },

    // Reviews a letter
    // Input: {ObjectId} id the letter id
    //        {String} username the username who performs review
    //        {String} action whether "approved", 
    //                 "declined", 
    //                 or 
    //                 "saved" (only edits but does not change status of the letter)
    //        {Object} data additional changes to current data
    //        {Function} result callback of {Object}
    //        {Error} error 
    //        {Array} result, contains a single record 
    reviewLetter: function(id, username, action, data, cb) {
      var selector = {
        _id: ObjectID(id),
        currentReviewer: username,
      }
      var notifyParties = function(err, result) {
        if (err) return cb(err, result);
        db.findArray({_id: ObjectID(id)}, function(err, result) {
          if (err) return cb(err, result);

          if (action == "declined") {
            sendNotification(username, "letter-review-declined", { record: result[0]});
          } else if (action == "approved" &&
            result[0].status == stages.REVIEWING
            ) {
            sendNotification(username, "letter-review-approved", { record: result[0]});
            } else if (action == "approved" &&
            result[0].status == stages.APPROVED
            ) {
            sendNotification(username, "letter-review-finally-approved", { record: result[0]});
          }

          cb(null, result);
        });
      }

      var edit = function(data,cb) {
        delete(data.operation);
        delete(data._id);
        delete(data.action);
        db.update(selector, {$set: data}, notifyParties);
      }

      db.findOne(selector, function(err, item) {
        if (err) return cb(err);
        if (item == null) return cb(Error(), {status: "item not found"});
        Object.keys(data).forEach(function(i) {
          item[i] = data[i];
        });

        _.each(item.reviewers, function(reviewer, index) {
          if (reviewer == item.currentReviewer) {
            if (action == "approved") {
              item.currentReviewer = item.reviewers[index + 1];
              if (!item.currentReviewer) {
                item.currentReviewer = reviewer;
                item.status = stages.APPROVED;
              }
            } else if (action == "declined") {
              item.currentReviewer = item.reviewers[index - 1];
              if (!item.currentReviewer) item.currentReviewer = item.originator;
            }
            return false;
          }
        });
        if (item.currentReviewer == item.originator && 
          action == "approved") {
          item.currentReviewer = item.reviewers[0];
        }
        item.log = item.log || [];
        item.log.push({
          date: new Date(),
          username: username,
          action: action, 
          message: data.message
        });


        prepareOutgoingData(item, function(preparedData) { 
          edit(preparedData, cb);
        });
      });
    },

    // Sends a letter
    // Input: {ObjectId} id the letter id
    //        {String} username the username who performs the sending 
    //        must be inside the organization of the senderOrganization field in the letter
    //        {ObjectId} data additional data to be saved (e.g. outgoingAgenda and mailId)
    //        {Function} result callback of {Object}
    //        {Error} error 
    //        {Array} result, contains a single record 
    //
    sendLetter: function(id, username, data, cb) {
      var findOrg = function(cb) {
        user.findOne({username: username}, function(err, result) {
          if (result == null) {
            return cb(new Error(), {success: false, reason: "authorized user not found"});
          }
          if (!_.find(result.roleList, function(item) {
            return item == app.simaya.administrationRole
          })){
            return cb(new Error(), {success:false, reason:"user is not authorized"});
          }
          cb(null, result.profile.organization);
        });
      }

      var selector = {
        _id: ObjectID(id), 
        status: stages.APPROVED
      }

      var notifyParties = function(err, result) {
        if (err) return cb(err, result);
        db.findArray({_id: ObjectID(id)}, function(err, result) {
          if (err) return cb(err, result);

          sendNotification(username, "letter-sent", { record: result[0]});
          cb(null, result);
        });
      }

      var edit = function(org, dbData,cb) {
        selector.senderOrganization = org;
        delete(dbData.operation);
        delete(dbData._id);
        agendaNumber.update({
          path: org,
          type: 1
        }, { $set: {
          agenda: data.outgoingAgenda
        }}, {upsert: 1}, function(err, result) {
          agendaNumber.update({
            path: org,
            type: 2
          }, { $set: {
            agenda: data.mailId
          }}, {upsert: 1}, function(err, result) {
            db.update(selector, {$set: dbData}, notifyParties);
          });
        })
      }

      var autoReceiveDirectLetter = function(item, outputData, cb) {
        var r = item.receivingOrganizations || {};
        var funcs = [];

        _.each(item.recipients, function(username) {
          var f = function(fn) {
            user.findOne({username: username}, function(err, result) {
              if (err) return fn(err);
              var organization = result.profile.organization;
              if (!organization) return fn(null);

              org.findOne({ path: organization}, function(err, result) {
                if (err) return fn(err);
                if (result && result.head != username) {
                  // direct letter to staff
                  // auto receive
                  r[organization].status = 6;
                  r[organization].direct = true;
                  fn(null);
                } else fn(null);
              });
            });
          }
          funcs.push(f);
        });
        async.series(funcs, function(err, result) {
          if (err) return cb(err);
          outputData.receivingOrganizations = r;
          cb(null, outputData); 
        });
      }

      db.findOne(selector, function(err, item) {
        if (err) return cb(err);
        if (item == null) return cb(Error(), {status: "item not found"});
        findOrg(function(err, org) {
          if (err) return cb(err, org);
          var outputData = {
            status: stages.SENT
          }
          if (data.mailId && data.outgoingAgenda) {
            outputData.mailId = data.mailId;
            outputData.outgoingAgenda = data.outgoingAgenda;
            if (data.ignoreFileAttachments == "true") {
              outputData.fileAttachments = [];
            }
            autoReceiveDirectLetter(item, outputData, function(err, outputData) {
              if (err) return(err);
              edit(org, outputData, cb);
            });
          } else {
            return cb(new Error(), {success: false, fields: ["mailId", "outgoingAgenda"]});
          }
        });
      });
    },
 
    // Receives a letter
    // Input: {ObjectId} id the letter id
    //        {String} username the username who performs the receiving 
    //        must be inside the organization of the receivingOrganizations field in the letter
    //        {ObjectId} data additional data to be saved (e.g. incomingAgenda)
    //        {Function} result callback of {Object}
    //        {Error} error 
    //        {Array} result, contains a single record 
    receiveLetter: function(id, username, data, cb) {
      var findOrg = function(cb) {
        user.findOne({username: username}, function(err, result) {
          if (result == null) {
            return cb(new Error(), {success: false, reason: "authorized user not found"});
          }
          if (!_.find(result.roleList, function(item) {
            return item == app.simaya.administrationRole
          })){
            return cb(new Error(), {success:false, reason:"user is not authorized"});
          }
          cb(null, result.profile.organization);
        });
      }

      var selector = {
        _id: ObjectID(id)
      }

      var notifyParties = function(err, result) {
        if (err) return cb(err, result);
        db.findArray({_id: ObjectID(id)}, function(err, result) {
          if (err) return cb(err, result);

          sendNotification(username, "letter-received", { record: result[0]});
          cb(null, result);
        });
      }

      var edit = function(org, dbData,cb) {
        delete(data.operation);
        delete(data._id);
        agendaNumber.update({
          path: org,
          type: 0
        }, { $set: {
          agenda: data.incomingAgenda
        }}, {upsert: 1}, function(err, result) {
          db.update(selector, {$set: dbData}, notifyParties);
        })
      }

      findOrg(function(err, org) {
        if (err) return cb(err, org);
        if (data.incomingAgenda) {
          var outputData = {
            date: new Date, 
            status: stages.RECEIVED,
            agenda: data.incomingAgenda
          }
          db.findOne(selector, function(err, item) {
            if (err) return cb(err);
            if (item == null) return cb(Error(), {success: false, reason: "item not found"});
            var r = item.receivingOrganizations;
            if (r[org]) {
              r[org] = outputData;
              edit(org, { receivingOrganizations: r}, cb);
            } else {
              return cb(Error(), {success:false, reason:"receiving organization mismatch"});
            }
          })
        } else {
          return cb(new Error(), {success: false, fields: ["incomingAgenda"]});
        }
      });

    },

    // Rejects a letter
    // Input: {ObjectId} id the letter id
    //        {String} username the username who performs the rejection 
    //        must be inside the organization of the receivingOrganizations field in the letter
    //        {ObjectId} data additional data to be saved (e.g. incomingAgenda)
    //        {Function} result callback of {Object}
    //        {Error} error 
    //        {Array} result, contains a single record 
    rejectLetter: function(id, username, data, cb) {
      var findOrg = function(cb) {
        user.findOne({username: username}, function(err, result) {
          if (result == null) {
            return cb(new Error(), {success: false, reason: "authorized user not found"});
          }
          if (!_.find(result.roleList, function(item) {
            return item == app.simaya.administrationRole
          })){
            return cb(new Error(), {success:false, reason:"user is not authorized"});
          }
          cb(null, result.profile.organization);
        });
      }

      var selector = {
        _id: ObjectID(id)
      }

      var notifyParties = function(err, result) {
        if (err) return cb(err, result);
        db.findArray({_id: ObjectID(id)}, function(err, result) {
          if (err) return cb(err, result);

          sendNotification(username, "letter-rejected", { record: result[0]});
          cb(null, result);
        });
      }

      var edit = function(org, data,cb) {
        delete(data.operation);
        delete(data._id);
        db.update(selector, {$set: data}, notifyParties);
      }

      findOrg(function(err, org) {
        if (err) return cb(err, org);
        if (data.reason) {
          var outputData = {
            date: new Date, 
            status: stages.REJECTED,
            rejectedBy: username,
            rejectionReason: data.reason
          }
          db.findOne(selector, function(err, item) {
            if (err) return cb(err);
            if (item == null) return cb(Error(), {success: false, reason: "item not found"});
            var r = item.receivingOrganizations;
            if (r[org]) {
              r[org] = outputData;
              edit(org, { receivingOrganizations: r}, cb);
            } else {
              return cb(Error(), {success:false, reason:"receiving organization mismatch"});
            }
          })
        } else {
          return cb(new Error(), {success: false, fields: ["reason"]});
        }
      });
    },
 
    // Reads a letter
    // Input: {ObjectId} id the letter id
    //        {String} username the username who performs the rejection 
    //        must be inside the organization of the receivingOrganizations field in the letter
    //        {Function} result callback of {Object}
    //        {Error} error 
    //        {Array} result, contains a single record 
    readLetter: function(id, username, cb) {
      var findOrg = function(cb) {
        user.findOne({username: username}, function(err, result) {
          if (result == null) {
            return cb(new Error(), {success: false, reason: "authorized user not found"});
          }
          cb(null, result.profile.organization);
        });
      }

      var selector = {
        _id: ObjectID(id)
      }

      var edit = function(org, data,cb) {
        delete(data.operation);
        delete(data._id);
        db.update(selector, 
          {$set: data}, 
          function(err, result) {
            if (err) {
              cb(err, result);
            } else {
              view(id, username, org, cb);
            } 
          }
        );
      }

      findOrg(function(err, org) {
        if (err) return cb(err, org);
        db.findOne(selector, function(err, item) {
          if (err) return cb(err);
          var data = {};
          var foundInRecipients = _.find(item.recipients, function(recipient) {
            return recipient == username;
          });

          if (foundInRecipients) {
            var r = item.readStates || {};
            r.recipients = r.recipients || {};
            var uMangled = username.replace(/\./g, "___");
            r.recipients[uMangled] = new Date;

            data.readStates = r;
          }
          var foundInCcList = _.find(item.ccList, function(recipient) {
            return recipient == username;
          });
          if (!foundInRecipients && foundInCcList) {
            var r = item.readStates || {};
            r.ccList = r.ccList || {};
            var uMangled = username.replace(/\./g, "___");
            r.ccList[uMangled] = new Date;

            data.readStates = r;
          }

          if (!foundInRecipients && !foundInCcList) {
            var r = item.readStates || {};
            r.others = r.readStates || {};
            var uMangled = username.replace(/\./g, "___");
            r.others[uMangled] = new Date;

            data.readStates = r;
          }

          edit(org, data, cb);
        })
      });
    },

    // Lists incoming letter. Only applicable for officials who can receive letters or administration role who is expected to accept incoming letters.
    // Input: {String} username the username
    //        {Object} options
    //        {Function} result callback of {Object}
    //        {Error} error 
    //        {Array} result, contains records 
    listIncomingLetter: function(username, options, cb) {
      getSelector(username, "incoming", options, function(err, selector) {
        if (err) return cb(err, selector);
        if (options.agenda) {
          delete(options.agenda);
        }
        findBundle("letter-incoming", selector, options, cb);
      });
    },

    // Lists cc letter. Only applicable for officials who are cc'd letters.
    // Input: {String} username the username
    //        {Object} options
    //        {Function} result callback of {Object}
    //        {Error} error 
    //        {Array} result, contains records 
    listCcLetter: function(username, options, cb) {
      getSelector(username, "cc", options, function(err, selector) {
        if (err) return cb(err, selector);
        db.findArray(selector, options, cb);
      });
    },

    // Lists outgoing letter. Only applicable for officials who signed off letters.
    // Input: {String} username the username
    //        {Object} options
    //        {Function} result callback of {Object}
    //        {Error} error 
    //        {Array} result, contains records 
    listOutgoingLetter: function(username, options, cb) {
      getSelector(username, "outgoing", options, function(err, selector) {
        if (err) return cb(err, selector);
        findBundle("letter-outgoing", selector, options, cb);
      });
    },

    // Lists draft letter. Only applicable for officials who signed off letters, who reviews letters, who writes letters and administration role who is waiting to send a letter.
    // Input: {String} username the username
    //        {Object} options
    //        {Function} result callback of {Object}
    //        {Error} error 
    //        {Array} result, contains records 
    listDraftLetter: function(username, options, cb) {
      getSelector(username, "draft", options, function(err, selector) {
        if (err) return cb(err, selector);
        findBundle("letter-draft", selector, options, cb);
      });
    },


    // Opens a letter. Only applicable for officials who signed off the letter, who reviewed it, who sent it, who received it, the recipients and cc's, and whoever within the organization
    // Input: {ObjectId} id the letter id
    //        {String} username the username
    //        {Function} result callback of {Object}
    //        {Error} error 
    //        {Array} result, contains a record or null if not accessible 
    openLetter: openLetter,

    getSenders: getSenders,

    // Gets last agenda number
    // Input: {String} org Organization name
    //        {Number} type Whether 0: incoming or 1: outgoing or 2: outgoingMail
    //        {Function} callback result callback
    //        {Error} error
    //        {String} result
    lastAgenda: function(org, type, cb) {
      agendaNumber.findArray({path: org, type: type}, function(err, data) {
        if (err) return cb(err);
        if (data && data.length == 1) {
          return cb(null, data[0].agenda);
        } else {
          return cb(null, "");
        }
      });
    },

    // Gets all possible reviewers within a top organization. This includes all sub-organizations below it
    // Input: {String} org Organization name
    //        {String[]} exclude Exclude these persons
    // Output: {Function} cb callback
    //        {Error} cb.error Error
    //        {Object[]} cb.data Data
    allPossibleReviewers: function(organization, exclude, cb) {
      var index = organization.indexOf(";");
      if (index > 0) {
        organization = organization.substr(0, index);
      } 
      var query = {
        $or: [
        { path: { $regex: "^" + organization + "$" } },
        { path: { $regex: "^" + organization + ";" } },
        ]
      }

      var findUsers = function(usernames, cb) {
        user.find({username: { $in: usernames }}, {"username":1, "profile":1}, function(err, cursor) {
          if (err) return cb(err);
          if (!cursor) {
            return cb(new Error("data not found"));
          }
          cursor.sort({"profile.organization": 1}).toArray(function(err, result) {
            if (err) return cb(err);
            cb(null, result);
          });
        });
      }

      if (!exclude) {
        exclude = [];
      }
      org.findArray(query, function(err, data) {
        if (err) return cb(err);

        var users = [];
        _.each(data, function(item) {
          if (item.head) {
            var found = _.find(exclude, function(recipient) {
              return recipient == item.head;
            });
            if (!found) {
              users.push(item.head);
            }
          }
        });
        findUsers(users, cb);
      });
    },

    // Gets pdf stream of content
    // Input: {ObjectId} id
    //        {Number} index the content revision
    //        {String} who the person who tries to get the content
    //        {Stream} stream the stream for getting the download
    //        {Callback} callback
    //        {Error} error non-null when error happens
    contentPdf: contentPdf, 

    // Gets pdf metadata of content
    // Input: {ObjectId} id
    //        {Number} index the content revision
    //        {String} who the person who tries to get the content
    //        {Stream} stream the stream for getting the download
    //        {Callback} callback
    //        {Error} error non-null when error happens
    contentMetadata: contentMetadata, 

    renderContentPage: renderContentPage,
    renderContentPageBase64: renderContentPageBase64,
    
    // Links a letter with another letters
    // Input: {String} who the person who makes the link
    //        {ObjectId} ids[]
    link: link
  }
}
