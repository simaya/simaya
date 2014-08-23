module.exports = function(app) {
  // Private 
  var _ = require("lodash");
  var db = app.db('letter');
  var org= app.db('organization');
  var user = app.db('user');
  var ObjectID = app.ObjectID;
  var fs = require('fs');
  var moment = require('moment');
  var utils = require('./utils')(app);
  var filePreview = require("file-preview");
  
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
      _.each(["date", "sender", "recipients", "title", "classification", "priority", "type", "comments"], function(item) {
        if (!data[item]) {
          success = false;
          fields.push(item);
        }
      });

      var d = new Date(data.date);
      if (d && isNaN(d.valueOf())) {
        success = false;
        fields.push(item);
      }
    }

    if (!data || typeof(data) !== "object") {
      return cb({
        success: "false",
        fields: [],
        reason: "empty data"
      });
    }


    var validateManualIncoming = function(data) {
      _.each(["receivedDate", "date", "incomingAgenda", "mailId", "recipient", "title", "classification", "priority", "type", "comments"], function(item) {
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
    } else if (data.operation == "outgoing") {
      validateOutgoing(data);
    }

    return cb({
      success: success,
      fields: fields
    })
  };

  // Transform input data into data to be kept in DB
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
      outputData.date = data.date || new Date(data.date);
      outputData.status = data.status || stages.REVIEWING;

      reviewerListByLetter(null, data.originator, data.sender, function(reviewerList) {
        outputData.reviewers = _.pluck(reviewerList, "username");
        if (!outputData.currentReviewer) {
          outputData.currentReviewer = outputData.reviewers[0] || data.sender;
        }
        cb(outputData);
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

  var getSelector = function(username, action, options, cb) {
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

      if (action == "draft") {
        if (isAdministration) {
          selector = {
            $or: [
              {   
                status: { $in: [stages.NEW, stages.REVIEWING, stages.APPROVED] },
                originator: username,
                senderOrganization: org
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
      } else if (action == "incoming") {
        if (isAdministration) {
          selector = { 
            status: stages.SENT
          };
          selector["receivingOrganizations." + orgMangled] = { $exists: true };
          selector["receivingOrganizations." + orgMangled + ".status"] = { $exists: false };
        } else {
          selector = {
            status: stages.SENT,
            recipients: {
              $in: [ username ]
            },
          };
          selector["receivingOrganizations." + orgMangled + ".status"] = stages.RECEIVED;
        }
        // cc
      } if (action == "open") {
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
          var check = {};
          check["receivingOrganizations." + orgMangled] = { $exists: true };
          check["receivingOrganizations." + orgMangled + ".status"] = stages.RECEIVED; 

          selector["$or"].push(check);

        }
        // open
      }

      cb(null, selector);
    });
  }

  var openLetter = function(id, username, options, cb) {
    getSelector(username, "open", options, function(err, selector) {
      if (err) return cb(err, selector);
      if (!id) {
        cb(null, []);
      } else {
        selector._id = ObjectID(id + "");
        db.findArray(selector, options, cb);
      }
    });
  }

  var reviewerListByLetter = function(letterId, initiatingUser, topUser, callback) {
    var findOrg = function(username, cb) {
      user.findOne({username: username}, function(err, result) {
        if (result == null) {
          return cb(null);
        }
        cb(result.profile.organization);
      });
    }

    var findDetails = function(orgs, heads, cb) {
      user.findArray({"profile.organization": { $in: orgs}}, {profile: 1, username: 1}, function(error, items){
        if (items && items.length > 0) {
          var results = [];
          _.each(items, function(item) {
            if (heads[item.username]) {
              item.sortOrder = 0;
              _.each(item.profile.organization, function(i) {
                // sort by depth of path
                if (i == ";") item.sortOrder ++;
              });
              results.push(item);
            }
          });
          cb(_.sortBy(results, "sortOrder").reverse());
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
      if (letterId) {
        openLetter(letterId, initiatingUser, {}, function(err, data) {
          if (data && data.length == 1) {
            _.each(result, function(item) {
              if (data[0].currentReviewer && item.username == 
                  data[0].currentReviewer) {
                item.current = true;
              }
              for (var i = data[0].log.length - 1; i >= 0; i --) {
                var log = data[0].log[i];
                if (item.username == log.username) {
                  item.action = log.action;
                  break;
                }
              }
            });
            callback(result);
          } else {
            callback(result);
          }
        });
      } else {
        callback(result);
      }
    }

    findOrg(initiatingUser, function(initiatingOrg) {
      // initiating org couldn't be found
      if (!initiatingOrg) return callback([]);
      findOrg(topUser, function(topOrg) {
        // top org couldn't be found
        if (!topOrg) return callback([]);

        if (topOrg.length > initiatingOrg.length) {
          // topOrg path is longer than initiating org
          return callback([]);
        }

        if (initiatingOrg.indexOf(topOrg) != 0) {
          // initiating org is not part of top org
          return callback([]);
        }

        // all set
        var orgs = [ initiatingOrg ];
        var org = initiatingOrg;
        while (1) {
          var index = org.lastIndexOf(";");
          if (index >= 0) {
            var org = org.substr(0, index); 
            orgs.push(org);
          } else break;
          if (org == topOrg) break;
        }

        findHeads(orgs, function(heads) {
          // no heads found
          if (!heads) return callback([]);

          if (heads[initiatingUser] == initiatingOrg) {
            orgs.shift();
          }

          findDetails(orgs, heads, function(result) {
            populateResult(result);
          });
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
    downloadAttachment: function(fileId, stream, callback) {
      // Find letter title for this file
      db.findOne({'fileAttachments.path': ObjectID(fileId)}, {fileAttachments: 1, _id: 0}, function(error, item){
        if (item != null) {
          item.fileAttachments.forEach(function(e) {
            if (e.path.toString() == fileId.toString()) {
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
                gridStream.on("error", function(error) {
                  if (callback) return callback(error);
                });
                gridStream.on("end", function() {
                  if (callback) callback(null);
                });
                gridStream.pipe(stream);
              });
            } else {
            }
          });
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
    saveAttachmentFile : function(file, callback) {
      var fileId = new ObjectID();
      var store = app.store(fileId, file.name, "w", file.options || {});
      store.open(function(error, gridStore){
        gridStore.writeFile(file.path, function(error, result){
          fs.unlinkSync(file.path);
          callback(error, result);
        });
      }); 
    },


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
      var db = app.dbClient.collection("letter");
      var edit  = function(data, cb) {
        delete(data.operation);
        delete(data._id);
        db.update(selector, 
            {$set: data}, 
            {multi: true}, 
            function(err, result) {
          if (err) {
            cb(err, result);
          } else {
            db.find(selector).toArray(cb);
          }
        });
      }

      if (data.operation == "manual-incoming") {
        prepareDataFunc = prepareManualIncomingData;
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
      var edit = function(data,cb) {
        delete(data.operation);
        delete(data._id);
        delete(data.action);
        db.update(selector, 
          {$set: data}, 
          function(err, result) {
            if (err) {
              cb(err, result);
            } else {
              db.findArray({_id: ObjectID(id)}, cb);
            } 
          }
        );
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

      var edit = function(org, data,cb) {
        selector.senderOrganization = org;
        delete(data.operation);
        delete(data._id);
        db.update(selector, 
          {$set: data}, 
          function(err, result) {
            if (err) {
              cb(err, result);
            } else {
              db.find({_id: ObjectID(id)}).toArray(cb);
            } 
          }
        );
      }

      findOrg(function(err, org) {
        if (err) return cb(err, org);
        var outputData = {
          status: stages.SENT
        }
        if (data.mailId && data.outgoingAgenda) {
          outputData.mailId = data.mailId;
          outputData.outgoingAgenda = data.outgoingAgenda;
          edit(org, outputData, cb);
        } else {
          return cb(new Error(), {success: false, fields: ["mailId", "outgoingAgenda"]});
        }
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

      var edit = function(org, data,cb) {
        delete(data.operation);
        delete(data._id);
        db.update(selector, 
          {$set: data}, 
          function(err, result) {
            if (err) {
              cb(err, result);
            } else {
              db.find({_id: ObjectID(id)}).toArray(cb);
            } 
          }
        );
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

      var edit = function(org, data,cb) {
        delete(data.operation);
        delete(data._id);
        db.update(selector, 
          {$set: data}, 
          function(err, result) {
            if (err) {
              cb(err, result);
            } else {
              db.find({_id: ObjectID(id)}).toArray(cb);
            } 
          }
        );
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
              db.find({_id: ObjectID(id)}).toArray(cb);
            } 
          }
        );
      }

      findOrg(function(err, org) {
        if (err) return cb(err, org);
        db.findOne(selector, function(err, item) {
          if (err) return cb(err);
          if (item == null) return cb(Error(), {success: false, reason: "item not found"});
          var r = item.receivingOrganizations;
          if (!r[org]) return cb(Error(), {success: false, reason: "receiving organization mismatch"});
          if (r[org].status != stages.RECEIVED) return cb(Error(), {success: false, reason: "not yet accepted"});

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
        db.findArray(selector, options, cb);
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
        db.findArray(selector, options, cb);
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
        db.findArray(selector, options, cb);
      });
    },

    // Opens a letter. Only applicable for officials who signed off the letter, who reviewed it, who sent it, who received it, the recipients and cc's, and whoever within the organization
    // Input: {ObjectId} id the letter id
    //        {String} username the username
    //        {Function} result callback of {Object}
    //        {Error} error 
    //        {Array} result, contains a record or null if not accessible 
    openLetter: openLetter,

  }
}
