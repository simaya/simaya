if (typeof(Letter) === "undefined") {
Letter = module.exports = function(app) {
  var letter = require("../models/letter.js")(app)
    , utils = require("../../sinergis/controller/utils.js")(app)
    , cUtils = require("../../simaya/controller/utils.js")(app)
    , modelUtils = require("../models/utils.js")(app)
    , user = require("../../sinergis/models/user.js")(app)
    , disposition = require("../models/disposition.js")(app)
    , deputy = require("../models/deputy.js")(app)
    , session = require("../../sinergis/models/session.js")(app)
    , notification = require("../models/notification.js")(app)
    , sinergisVar = app.get("sinergisVar")
    , ObjectID = app.ObjectID
    , moment = require("moment")
    , spawn = require('child_process').spawn
    , ob = require("../../ob/file.js")(app)
    , azuresettings = require("../../azure-settings.js")

  var dispositionController = null;
  if (typeof(Disposition) === "undefined") {
    dispositionController = require("../controller/disposition.js")(app)
  }

  // deprecated
  var collectAttachments = function(req, res) {
    // Parse fullpath of uploaded files and push to array
    var fileAttachments = [];
    // Check if more than one file
    if (req.files.fileAttachments instanceof Array) {
      req.files.fileAttachments.forEach(function(file){
        if (file.name != null) {
          var fileObj = {
            path: file.path,
            name: file.name,
            type: file.type
          }
          fileAttachments.push(fileObj);
        }
      });
    } else if (req.files.fileAttachments != null && typeof (req.files.fileAttachments) !== "undefined" && req.files.fileAttachments.name != "") {
      // Check if just one file and push to array
      var fileObj = {
            path: req.files.fileAttachments.path,
            name: req.files.fileAttachments.name,
            type: req.files.fileAttachments.type
          }
      fileAttachments.push(fileObj);
    } else {
      fileAttachments = null;
    }
    return fileAttachments;
  }

  var populateReceivingOrganizations = function(source, data, cb) {
   // Get all organizations
    var recipients = [];

    // collect all recipients
    if (source.recipients) {
      for (var i = 0; i < source.recipients.length; i ++ ) {
        recipients.push(source.recipients[i]);
      }
    }
    if (source.ccList) {
      for (var i = 0; i < source.ccList.length; i ++ ) {
        recipients.push(source.ccList[i]);
      }
    }

    if (recipients.length > 0) {
      // Resolve them
      modelUtils.resolveUsers(recipients, function(resolved) {
        var receivingOrganizations = {};
        var orgs = {};
        var resolvedMap = {};
        for (var i = 0; i < resolved.length; i ++ ) {
          var key = resolved[i].username;
          resolvedMap[key] = resolved[i];
        }

        if (data) {
          // this is for external letters
          for (var i = 0; i < source.recipients.length; i ++ ) {
            var r = source.recipients[i];
            if (resolvedMap[r]) {
              var o = resolvedMap[r].organization;

              if (!orgs[o]) {
                orgs[o] = 1;

                if (data.recipients) {
                  receivingOrganizations[o] = receivingOrganizations[o] || {};
                  Object.keys(data.recipients).forEach(function(dataItem) {
                    receivingOrganizations[o][dataItem] = data.recipients[dataItem];
                  });
                }
              }
            }
          }

          for (var i = 0; i < source.ccList.length; i ++ ) {
            var r = source.ccList[i];
            if (resolvedMap[r]) {
              var o = resolvedMap[r].organization;

              if (!orgs[o]) {
                orgs[o] = 1;

                if (data.ccList) {
                  receivingOrganizations[o] = receivingOrganizations[o] || {};
                  Object.keys(data.ccList).forEach(function(dataItem) {
                    receivingOrganizations[o][dataItem] = data.ccList[dataItem];
                  });
                }
              }
            }
          }
        } else {
          // this is for normal letters
          for (var i = 0; i < resolved.length; i ++ ) {
            orgs[resolved[i].organization] = 1;
          }

          Object.keys(orgs).forEach(function(item) {
            receivingOrganizations[item] = {
              name: item,
              status: source.status,
            };
          });
        }

        cb(receivingOrganizations);
      });
    } else {
      cb({});
    }
  }

  var create = function(data, vals, template, createFunction, req, res) {
    if (utils.currentUserHasRoles([app.simaya.administrationRole], req, res)) {
      vals.isAdministration = true;
    }
    var data = data || {};
    console.log("create", req.body);
    if (JSON.stringify(req.body) !== '{}') {
      console.log("masuk!");
      Object.keys(req.body.letter).forEach(function(key){
          vals[key] = req.body.letter[key];
      });
      if (req.body.recipientManual && req.body.recipientManual.id) {
        vals.recipientManual = {
          id: req.body.recipientManual.id,
          name: req.body.recipientManual.name,
          organization: req.body.recipientManual.organization,
          address: req.body.recipientManual.address,
        };
        data.recipientManual = vals.recipientManual;
      }

      if (req.body.senderManual && req.body.senderManual.id) {
        vals.senderManual = {
          id: req.body.senderManual.id,
          name: req.body.senderManual.name,
          organization: req.body.senderManual.organization,
          address: req.body.senderManual.address,
        };
        data.senderManual = vals.senderManual;
        data.senderOrganization = "";
      } else {
        data.senderOrganization = req.session.currentUserProfile.organization;
      }

      // Convert string with comma separator to array
      if (req.body.letter.recipients != null) {
        var recipients = req.body.letter.recipients.split(",");
      }

      if (req.body.letter.ccList != null) {
        var ccList = req.body.letter.ccList.split(",");
      }
      if (req.body.autoCc) {
        var toConcat = {};
        for (var i = 0; i < req.body.autoCc.length; i ++) {
          toConcat[req.body.autoCc[i]] = 1;
        }
        for (var i = 0; i < ccList.length; i ++) {
          toConcat[ccList[i]] = 1;
        }
        ccList = []
        Object.keys(toConcat).forEach(function(e) {
          if (e) {
            ccList.push(e);
          }
        })

        if (data.creation == "external") {
          data.receivedByDeputy = true;
        } else {
          data.sentByDeputy = true;
        }
      }

      var reviewers = [];
      if (req.body.letter.reviewers != null) {
        var r = req.body.letter.reviewers.split(",");
        for (var i = 0; i < r.length; i++) {
          if (r[i] != vals.originator && r[i] != req.body.letter.sender) {
            reviewers.push(r[i]);
          }
        }
      }
      if (data.creation != "external") {
        // external letters does not need reviewers
        reviewers.push(req.body.letter.sender);
      }

      data.sender = req.body.letter.sender;
      data.incomingAgenda= req.body.letter.incomingAgenda;
      data.outgoingAgenda= req.body.letter.outgoingAgenda;
      data.receivedDate = new Date(req.body.letter.receivedDate);
      data.date = new Date(req.body.letter.date);
      data.creationDate = new Date();
      data.mailId = req.body.letter.mailId;
      data.recipients = recipients;
      data.ccList = ccList;
      data.originator = req.session.currentUser;
      data.title = req.body.letter.title;
      data.priority = req.body.letter.priority;
      data.classification = req.body.letter.classification;
      data.comments = req.body.letter.comments;
      data.type = req.body.letter.type;
      vals["type" + parseInt(req.body.letter.type)] = "selected";
      data.reviewers = reviewers;
      data.nextReviewer = reviewers[0] || "";
      if (!data.status) {
        data.status = letter.Stages.WAITING;
      }
      if (data.lockSender) {
        // this is made by high officials, no reviewers, so the state immediately go to APPROVED
        data.status = letter.Stages.APPROVED;
        data.nextReviewer = "";
      }
      data.log = [ {
        date: new Date(),
        username: data.originator,
        action: "created",
        message: "Surat dibuat",
        } ]

      if (req.body.letter.letterhead != null) {
        data.letterhead = req.body.letter.letterhead;
      }

      if (vals.body) {
        // Parsing template tag
        vals.body = vals.body.replace("[NOMORSURAT]", req.body.letter.mailId);
        vals.body = vals.body.replace("[PERIHAL]", req.body.letter.title);
        vals.body = vals.body.replace("[TANGGAL]", req.body.letter.date);
        var tandaTangan = req.body.letter.title + "<br><br><br>" + req.body.letter.sender;
        vals.body = vals.body.replace("[TANDATANGAN]", tandaTangan);
        data.body = vals.body;
      }

      // Check if create from disposition as laporan
      if (vals.originalLetterId) {
        data.originalLetterId = vals.originalLetterId;
      }
      if (vals.createdFromDispositionId) {
        data.createdFromDispositionId = vals.createdFromDispositionId;
      }

      // Searches the current draft
      letter.list( { search : { _id : ObjectID(req.body.letter.draftId), username : req.session.currentUser, status : letter.Stages.WAITING } }, function(drafts){
        console.log("draft",drafts);
        if (drafts.length > 0) {
          // if the draft has attachments, copy it
          data.fileAttachments = drafts[0].fileAttachments || [];
          data._id = drafts[0]._id;
        }

        createFunction(data, function(v){

          if (!v.hasErrors()) {

            vals.successful = true;
            vals.senderManual = {}; // cleared
            vals.recipientManual = {}; // cleared
            vals.receivedDateDijit = ""; // cleared
            vals.dateDijit = moment(new Date()).format("YYYY-MM-DD"); // set as today

            if (vals.createdFromDispositionId) {
              // FF
              disposition.markAsFollowedUp(ObjectID(""+vals.createdFromDispositionId), v.resultId, req.session.currentUser);
            }

            letter.list({ search: {_id: ObjectID("" + v.resultId) } }, function(result) {

                // Resolves users
                modelUtils.resolveUsers([data.sender], function(resolved) {

                  if (resolved.length > 0 && result.length > 0) {
                    result[0].senderResolved = resolved[0];

                    // Sends the notifications out
                    sendOutNotifications(data.nextReviewer, data.status, result[0], req, res);
                  }

                  var draft = drafts[0] || { _id : undefined}

                  // Deletes the draft's attachments
                  letter.removeDraftFileAttachments({_id : draft._id}, function(err) {

                    if (vals.jsonRequest) {
                      res.send({result: "OK", data: {
                        id: v.resultId
                      }});
                    } else {
                      // Renders the page
                      utils.render(req, res, template, vals, "base-authenticated");
                    }
                  })

                })
            })

          } else {

            // if error
            vals.unsuccessful = true;
            if (v.errors.Data != null) {
              vals.error = v.errors.Data.join(', ');
            }

            if (v.errors.mailId != null) {
              vals.error += vals.error.length > 0 ? (', ' +  v.errors.mailId) : v.errors.mailId;
            }

            // Set letter vals if get some errors
            vals.letter = req.body.letter;
            if (vals.jsonRequest) {
              res.send({result: "ERROR", data: vals});
            } else {
              utils.render(req, res, template, vals, "base-authenticated");
            }
          }
        })

      })
    } else {
      // console.log("DraftID", req.body.draftId);
      // creates draft
      console.log("masuk?");
      console.log("reqbodydraft", req.body.draftId);
      letter.createDraft({ username : req.session.currentUser, draftId : req.body.draftId }, function(err, item){
        console.log("1");
        if (err) {
          vals.unsuccessful = true;
          vals.error = "Error creating draft. Please reload";
          console.log("2");
        }
        else {
          console.log("3");
          if (item) {
            console.log("4");
            vals.draftId = item._id
            if (vals.jsonRequest) {
                console.log("13");
                if (err) {
                  console.log("14");
                  res.send({status: "ERROR", data: vals});
                } else {
                  console.log("15");
                  // req.body.tempDraftId = vals.draftId;
                  // console.log("req.body.tempDraftId", req.body.tempDraftId);
                  res.send({status: "OK",data: {
                    draftId: vals.draftId
                  }});
                }
            } else {
              utils.render(req, res, template, vals, "base-authenticated");
            }
            // req.body.idDraft = item._id
            // console.log("reqbody", req.body);
          } else {
            console.log("5");
            // safety belt, try a second bet and force creating new draftId
            letter.createDraft({ username : req.session.currentUser, draftId : null }, function(err, item){
              console.log("6");
              if (err || !item) {
                console.log("7");
                vals.unsuccessful = true;
                vals.error = "Error creating draft. Please reload";
              } else {
                console.log("8");
                vals.draftId = item._id
                // req.body.idDraft = item._id
                // console.log("reqbody", req.body);
              }
              console.log("9");
              if (vals.jsonRequest) {
                console.log("10");
                if (err) {
                  console.log("11");
                  res.send({status: "ERROR", data: vals});
                } else {
                  console.log("12");
                  // req.body.idDraft = vals.draftId;
                  // console.log("idDraft", req.body.idDraft);
                  res.send({status: "OK",data: {
                    draftId: vals.draftId
                  }});
                }
              } else {
                utils.render(req, res, template, vals, "base-authenticated");
              }              
            });
          }
        }
      })
    }
  }

  var createExternal = function(req, res) {
    var vals = {
      title: "Surat Masuk Manual",
    }

    var breadcrumb = [
      {text: 'Surat Masuk', link: '/incoming'},
      {text: 'Manual', isActive: true}
    ];
    vals.breadcrumb = breadcrumb;

    var myOrganization = req.session.currentUserProfile.organization;
    vals.originator = req.session.currentUser;;
    if (req.body.letter && req.body.letter.date) {
      vals.dateDijit = moment(req.body.letter.date).format("YYYY-MM-DD");
    } else {
      vals.dateDijit = moment(new Date()).format("YYYY-MM-DD");
    }
    var data = {};
    if (req.body.letter && req.body.letter.receivedDate) {
      data = {
        creation: "external",
        status: letter.Stages.RECEIVED
      }
      // Convert string with comma separator to array
      if (req.body.letter.recipients != null) {
        data.recipients = req.body.letter.recipients.split(",");
      }

      if (req.body.letter.ccList != null) {
        data.ccList = req.body.letter.ccList.split(",");
      }


      vals.receivedDateDijit = moment(req.body.letter.receivedDate).format("YYYY-MM-DD");
    } else {
      vals.receivedDateDijit = moment(new Date()).format("YYYY-MM-DD");
    }

    var fakeVals = {
      skipDeputy: true
    }
    cUtils.populateSenderSelection(myOrganization, "", fakeVals, req, res, function(fakeVals) {
      deputy.getCurrent(myOrganization, function(info) {
        if (info != null && info.active == true) {
          vals.autoCc = fakeVals.autoCc;
        }

        var receivingOrganizationData;
        if (req.body && req.body.letter) {
          receivingOrganizationData =  {
            recipients: {
              status: letter.Stages.RECEIVED,
              agenda: req.body.letter.incomingAgenda,
              date: new Date(req.body.letter.receivedDate)
            },
            ccList: {
              status: letter.Stages.SENT
            }
          };
        }

        populateReceivingOrganizations(data,
          receivingOrganizationData, function(r) {
          if (data) {
            data.receivingOrganizations = r;
          }
          create(data, vals, "letter-external", letter.createFromExternal, req, res);
        });
      });
    });
  }

  var createNormal = function(req, res) {
    // console.log("reqbody", req.body)
    var vals = {
      title: "Surat Keluar",
    }

    var breadcrumb = [
      {text: 'Surat Keluar', link: '/outgoing'},
      {text: 'Buat Surat', isActive: true}
    ];
    vals.breadcrumb = breadcrumb;

    if (typeof(req.query.original) !== "undefined") {
      vals.originalLetterId = req.query.original;
    }

    if (typeof(req.query.disposition) !== "undefined") {
      vals.createdFromDispositionId = req.query.disposition;
    }

    if (req.body.letter) {
      var date = moment(req.body.letter.date)
      if (date) {
        vals.dateDijit = date.format("YYYY-MM-DD")
      } else {
        vals.dateDijit = moment(new Date()).format("YYYY-MM-DD");
      }
      vals.sender = req.body.letter.sender;
      vals.body = req.body.letter.body;
    } else {
      vals.dateDijit = moment(new Date()).format("YYYY-MM-DD");
    }

    var data = {};
    vals.highOfficial = false;
    if (parseInt(req.session.currentUserProfile.echelon) <= 2) {
      // officials with echelon 2 or higher, the sender automatically set to him/herself
      vals.highOfficial = true;
      data.lockSender = true;
    }

    cUtils.populateSenderSelection(req.session.currentUserProfile.organization, vals.sender, vals, req, res, function(vals) {

      if (!req.body || !req.body.letter || !req.body.letter["reviewers"]) {

        if (vals.senderSelection) {
          if (!vals.letter) {
            vals.letter = {
              reviewers: ""
            };
          }

          vals.letter.reviewers = vals.letter.reviewers || "";

          for (var i = 0; i < vals.senderSelection.length; i ++) {
            vals.letter["reviewers"] += vals.senderSelection[i].username + ",";
          }
        }
      } else if (req.body.letter) {
        // set `default` letter reviewers
        vals.letter = vals.letter || {}
        vals.letter.reviewers = req.body.letter["reviewers"] || ""
      }

      // console.log(req.files);
      create(data, vals, "letter-outgoing-new", letter.createNormal, req, res);
      // console.log("reqbody", req.body);
    });
  }

  var review = function(req, res) {
    var vals = {
      title: "Proses Surat",
    }
    var data = {};

    var breadcrumb = [
      {text: 'Surat Masuk', link: '/incoming'},
      {text: 'Proses Surat', isActive: true}
    ];
    vals.breadcrumb = breadcrumb;

    if (typeof(req.body.letter) !== "undefined") {

      if (req.body.exitButton) {
        res.redirect("/letter/read/" + req.body.id);
        return;
      }


      letter.list({search: { _id: ObjectID(req.body.id)}}, function(result) {
        _letter = result[0];

        vals.date = moment(_letter.date).format("DD/MM/YYYY");
        vals.dateDijit = moment(req.body.letter.date).format("YYYY-MM-DD") || moment(_letter.date).format("YYYY-MM-DD");
        vals.scope = _letter.creation;
        vals.letter = _letter;
        vals.draftId = req.body.id;

        // copy file attachments
        data.fileAttachments = _letter.fileAttachments;

        Object.keys(result[0]).forEach(function(key){
            vals[key] = result[0][key];
        });

        // Convert string with comma separator to array
        if (req.body.letter.recipients != null) {
          data.recipients = req.body.letter.recipients.split(",");
        }

        if (req.body.letter.ccList != null) {
          data.ccList = req.body.letter.ccList.split(",");
        }

        if (req.body.autoCc) {
          var toConcat = {};
          for (var i = 0; i < req.body.autoCc.length; i ++) {
            toConcat[req.body.autoCc[i]] = 1;
          }
          for (var i = 0; i < data.ccList.length; i ++) {
            toConcat[data.ccList[i]] = 1;
          }
          data.ccList = []
          Object.keys(toConcat).forEach(function(e) {
            data.ccList.push(e);
          })
          if (data.creation == "external") {
            data.receivedByDeputy = true;
          } else {
            data.sentByDeputy = true;
          }
        }

        if (req.body.letter.originator != null) {
          data.originator = req.body.letter.originator;
        }

        vals["type" + parseInt(req.body.letter.type)] = "selected";
        data.type = parseInt(req.body.letter.type);

        data.status = _letter.status;
        var currentReviewer = result[0].nextReviewer;
        data.reviewers = [];
        if (req.body.letter.reviewers != null) {
          var r = req.body.letter.reviewers.split(",");
          for (var i = 0; i < r.length; i++) {
            if (r[i] != req.body.letter.sender) {
              data.reviewers.push(r[i]);
            }
          }
          data.reviewers.push(req.body.letter.sender);
        }

        data.type = req.body.letter.type;
        vals["type" + parseInt(req.body.letter.type)] = "selected";

        data.nextReviewer = "";
        data.action = "";
        data.creation = result[0].creation;
        vals.lockSender = result[0].lockSender;

        data.senderResolved = result[0].senderResolved;
        if (data.senderResolved == null || typeof(data.senderResolved) === "undefined") {
          data.senderResolved = {}
        }

        handleButtons(vals, data, req, res);

        vals.nextReviewer = data.nextReviewer;


        var sender = req.body.letter.sender || result[0].sender;

        populateReceivingOrganizations(data, null, function(ro) {
          if (data) {
            data.receivingOrganizations = ro;
          }
          cUtils.populateSenderSelection(req.session.currentUserProfile.organization, sender, vals, req, res, function(vals) {
            processLetter(vals, data, req, res);
          });
        });

/*
        modelUtils.resolveUsers([req.session.currentUser], function(resolved) {
          // Async, fire and forget
          if (req.session.currentUser != result[0].originator[0]) {
            notification.set(result[0].originator[0], resolved[0].title + " " + resolved[0].organization + " telah memeriksa surat perihal: " + data.title, "/letter/read/" + req.body.id);
          };
          if (req.session.currentUser != result[0].sender &&
              result[0].sender != result[0].originator[0]) {
            notification.set(result[0].sender, resolved[0].title + " " + resolved[0].organization + " telah memeriksa surat perihal: " + data.title, "/letter/read/" + req.body.id);
          };
        });
        */
      });
    } else {
      vals.form = true;
      vals.successful = false;
      vals.unsuccessful = false;
      vals.draftId = req.params.id;
      letter.list({search: { _id: ObjectID(req.params.id)}}, function(result) {
        if (result != null && result.length == 1) {
          var sender = result[0].sender;
          cUtils.populateSenderSelection(req.session.currentUserProfile.organization, sender, vals, req, res, function(vals) {
            vals.callFromOutside = true;
            view(vals, "letter-edit-review", req, res);
          });
        } else {
          res.redirect("/");
        }
      });
    }
  }

  // Populates reviewer"s resolved data with reviewing log
  var populateReviewerLog = function(nextReviewer, log, data) {
    for (var i = 0; i < log.length; i ++) {
      var l = log[i];
      if (l != null)
      for (var j = 0; j < data.length; j ++) {
        if (nextReviewer == data[j].username) {
          data[j].nextReviewerInLine = true;
        } else {
          data[j].nextReviewerInLine = false;
        }
        if (l.username == data[j].username) {
          data[j] = setReviewerMessage(data[j], l.action, l.message);
       }
      }
    }
    return data;
  }

  // Populate reviewer template block
  var setReviewerMessage = function(data, action, message) {
    data.approved = false;
    data.declined = false;
    data.demoted = false;
    data.message = message;

    switch (action) {
      case "approved":
        data.approved = true;
        break;
      case "declined":
        data.declined= true;
        break;
      case "demoted":
        data.demoted= true;
        break;
    }
    return data;
  }

  var populateReadDates = function(resolved, data) {
    if (resolved == null || typeof(resolved) === "undefined")
      return null;

    if (data) {
      var readers = Object.keys(data);

      if (readers) {
        for (var i = 0; i < readers.length; i ++) {
          var reader = readers[i];
          for (var j = 0; j < resolved.length; j ++) {
            if (resolved[j].username == reader.replace("___",".")) { // Recover real username
              resolved[j].readDate = moment(data[reader]).format("dddd, DD MMMM YYYY HH:mm");
            }
          }
        }
      }
    }

    return resolved;
  }

  var isPartOfOrganization = function(lowerLevel, higherLevel) {
    if (lowerLevel == higherLevel) {
      return true;
    }
    var org = lowerLevel;
    var orgs = [ org ];
    var i = org.lastIndexOf(";");
    while (i > 0) {
      org = org.substr(0, i);
      if (org == higherLevel) {
        return true;
      }
      i = org.lastIndexOf(";");
    }
    return false;
  }

  var view = function(vals, template, req, res) {
    // console.log(vals);
    var organization = req.session.currentUserProfile.organization;
    vals.unsuccessful = vals.successful = false;

    if (req.params.id) {
      var search = buildSearchForViewing(req.params.id, req, res);
      letter.list(search, function(result){
        // Make sure just one element in result array
        if (result.length == 1) {

          if (utils.currentUserHasRoles([app.simaya.administrationRole], req, res)) {
           vals.isAdministration = true;
          }
          vals.isSendingOrganization = isPartOfOrganization(organization, result[0].senderOrganization);

          vals.letter = result[0];
          vals.scope = result[0].creation; // for recipient editor
          vals.creationType = {};
          vals.creationType[vals.scope] = true; // copy again for templating
          Object.keys(result[0]).forEach(function(key){
            vals[key] = result[0][key];
          });

          vals["type" + parseInt(result[0].type)] = "selected";
          vals.sentByDeputy = vals.letter.sentByDeputy;

          if (vals.letter.date) {
            vals.date = moment(vals.letter.date).format("dddd, DD MMMM YYYY");
            vals.dateDijit = moment(vals.letter.date).format("YYYY-MM-DD");
          }

          if (vals.letter.receivedDate) {
            vals.receivedDate = moment(vals.letter.receivedDate).format("dddd, DD MMMM YYYY");
          }

          if (result[0].externalSender) {
            vals.isExternal = true;
          }
          vals.sender = result[0].sender || result[0].externalSender;
          vals.priorities = {};
          vals.priorities["p"+result[0].priority] = true;
          vals.classifications = {};
          vals.classifications["c"+result[0].classification] = true;

          if (result[0].nextReviewer == req.session.currentUser) {
            vals.needsReview = true;
          }
          vals.nextReviewer = result[0].nextReviewer;
          vals.composing = true;
          if (typeof(result[0].receivingOrganizations) === "object" &&
              typeof(result[0].receivingOrganizations[organization]) === "object") {
            vals.incomingAgenda = result[0].receivingOrganizations[organization].agenda;
          }

          switch(result[0].status) {
          case letter.Stages.RECEIVED:
            vals.statusReceived = true;
            vals.composing = false;
            for (var i = 0; i < result[0].recipients.length; i ++) {
              if (result[0].recipients[i] == req.session.currentUser) {
                vals.allowDisposition = true;
                vals.canRejectIncomingLetter = true; // later will be examined, if there"s already disposition, this value would be turned into false

                break;
              }
            }

            break;

          case letter.Stages.SENT:
            vals.statusSent = true;
            vals.composing = false;
            if (typeof(result[0].receivingOrganizations) === "object") {
              var k = Object.keys(result[0].receivingOrganizations);
              for (var i = 0; i < k.length; i ++) {
                if (result[0].receivingOrganizations[k[i]].status == letter.Stages.RECEIVED) {
                  delete(vals.statusSent);
                  vals.statusNotAllReceived = true;
                  break;
                }
              };
              if (result[0].receivingOrganizations[organization] &&
                  result[0].receivingOrganizations[organization].status == letter.Stages.RECEIVED) {
                vals.allowDisposition = true;
              };
            }

            break;
          case letter.Stages.DEMOTED:
            vals.composing = false;
            vals.statusDemoted = true;
            delete(vals.receivedDate); // date doesn't make sense in this stage
            break;

          case letter.Stages.APPROVED:
            if (utils.currentUserHasRoles([app.simaya.administrationRole], req, res)) {
              vals.readyToSend = true;
            }
            vals.composing = false;
           vals.statusApproved = true;
            delete(vals.receivedDate); // date doesn't make sense in this stage
            break;

          case letter.Stages.REVIEWING:
            vals.statusInReviewNow = true;
            delete(vals.receivedDate); // date doesn't make sense in this stage
            break;

          case letter.Stages.WAITING:
            vals.statusInReview = true;
            if (result[0].originator == req.session.currentUser) {
              vals.canDemote = true;
            }
            delete(vals.receivedDate); // date doesn't make sense in this stage

            break;

          case letter.Stages.NEW:
          default:
            vals.statusNew = true;
            delete(vals.receivedDate); // date doesn't make sense in this stage
            break;
          }
          if (result[0].body) {
            vals.body = result[0].body;
          }
          if (result[0].receivedDate == null) {
            vals.receivedDate = null;
          }

          vals.reviewersResolved = populateReviewerLog(result[0].nextReviewer, result[0].log, vals.reviewersResolved);
          if (vals.composing && result[0].originator != req.session.currentUser) {
            vals.canReject = true;
          }

          if (vals.fileAttachments) {
            vals.fileAttachments.forEach(function(e, i){
              vals.fileAttachments[i] = {id: e.path, name: e.name};
            });
          }

          if (result[0].readStates && typeof(result[0].readStates) !== "undefined") {
            vals.recipientsResolved = populateReadDates(vals.recipientsResolved, result[0].readStates.recipients);
            vals.ccListResolved = populateReadDates(vals.ccListResolved, result[0].readStates.cc);
          }

          if (utils.currentUserHasRoles(["letterlog"], req, res) == false) {
            vals.log = []
          } else {
            for (var i = 0; i < vals.log.length; i ++) {
              if (vals.log[i].date) {
                vals.log[i].date = moment(vals.log[i].date).format("dddd, DD MMMM YYYY HH:mm");
              }
            }
          }


          if (utils.currentUserHasRoles([app.simaya.administrationRole], req, res) == true) {

            if (result[0].creation == "normal") {
              switch (result[0].status) {
              case letter.Stages.SENT:
                var o = Object.keys(result[0].receivingOrganizations);
                for (var i = 0; i < o.length; i ++) {
                  if (req.session.currentUserProfile.organization ==o[i]) {
                    vals.receiving = true;
                    break;
                  }
                }
                break;
              case letter.Stages.APPROVED:
                vals.needsReview = true;
                break;
              }
            } else if (result[0].creation == "external") {
              var o = Object.keys(result[0].receivingOrganizations);
              // console.log(o);
              for (var i = 0; i < o.length; i ++) {
                if (req.session.currentUserProfile.organization ==o[i] && result[0].receivingOrganizations[o[i]].status == letter.Stages.SENT) {
                  vals.receiving = true;
                  break;
                }
              }
            }
          }

          var currentUser = req.session.currentUser;
          if (result[0].creation == "external" &&
              result[0].status == letter.Stages.RECEIVED) {
            if (isRecipient (req, result[0])) {
              letter.setReadState(req.params.id, currentUser);
            }
          }

          if (result[0].rejections &&
              result[0].rejections[currentUser.replace("__",".")]) {
              // This user has already rejected the letter
              vals.canRejectIncomingLetter = false;
              vals.allowDisposition = false;
              vals.rejectionDate = moment(result[0].rejections[currentUser.replace("__",".")].date).format("dddd, DD MMMM YYYY HH:mm");
              vals.rejectionReason = result[0].rejections[currentUser.replace("__",".")].reason;
          }
          disposition.list({search: {
            letterId: req.params.id,
            }
           }, function (r) {
            if (!vals.callFromOutside) {
              vals.successful = true;
              notification.viewByUrl("/letter/read/" + req.params.id);
              var currentUser = req.session.currentUser;
              letter.setReadState(req.params.id, currentUser);
              var currentUserIsRecipient = isRecipient(req, result[0]);
              if (currentUserIsRecipient) {
                sendNotificationToSender(result[0], currentUser, "{{title}} {{organization}} membuka surat nomor {{mailId}}", "/letter/read/" + req.params.id);
              }
            }
            if (r != null && r.length > 0) {
              vals.canRejectIncomingLetter = false;
              // This means that the disposition is already created and
              // this letter should not be able to be demoted
            }
            for (var j = 0; j < r.length; j ++) {
              var f = moment(r[j].date).format("dddd, DD MMMM YYYY");
              if (f.indexOf("undefined") == 0) {
                r[j].formattedDate = r[j].date
              } else {
                r[j].formattedDate = f
              }
              for (var i = 0; i < r[j].recipients.length; i ++) {
                if (r[j].recipients[i].date) {
                  r[j].recipients[i].formattedDate = moment(r[j].recipients[i].date).format("dddd, DD MMMM YYYY");
                }
                r[j].recipients[i]["instruction" + r[j].recipients[i].instruction] = true;
                r[j].recipients[i]["priority" + r[j].recipients[i].priority] = true;
                r[j].recipients[i]["security" + r[j].recipients[i].security] = true;
              }
            }
            vals.dispositions = r;

            utils.render(req, res, template, vals, "base-authenticated");
          });
        } else {
          vals.unsuccessful = true;
          utils.render(req, res, template, vals, "base-authenticated");
        }
      });
    }
  }

  var receiveLetter = function(req, res) {
    var vals = {};

    var id = req.params.id || req.body.id;

    if (id) {
      var o = "receivingOrganizations." + req.session.currentUserProfile.organization + ".status";
      var search = {
        search: {
          _id: ObjectID(req.params.id),
        }
      }

      search.search[o] = letter.Stages.SENT;

      letter.list(search, function(result){
        if (result.length == 1) {
          vals.letter = result[0];
          Object.keys(result[0]).forEach(function(key){
            vals[key] = result[0][key];
          });

          if (req.body.incomingAgenda && req.body.incomingAgenda.length > 0) {
            var changes = result[0].receivingOrganizations;
            changes[req.session.currentUserProfile.organization] = {
              status: letter.Stages.RECEIVED,
              agenda: req.body.incomingAgenda,
              date: new Date(),
            }

            var count = 0;
            var all = 0;
            Object.keys(changes).forEach(function(item) {
              if (changes[item].status == letter.Stages.RECEIVED)
                count ++;
              all ++;
            });


            var data = {
              receivingOrganizations: changes,
              log: [ {
                date: new Date(),
                username: req.session.currentUser,
                action: "received",
                message: "",
                } ],
            }

            if (count == all) {
              data.status = letter.Stages.RECEIVED;
            }

            vals.letterReceived = true;
            letter.edit(req.params.id, data, function(v) {
              view(vals, "letter-view", req, res);
            });
          } else {
            vals.receiving = true;
            view(vals, "letter-view", req, res);
          }
        } else {
          res.redirect("/");
        }
      });
    } else {
      res.redirect("/");
    }
  }

  var viewLetter = function(req, res) {
    var vals = {};
    view(vals, "letter-view", req, res);
  }

  var sendNotificationToSender = function(data, user, message, url) {
    if (data.status == letter.Stages.APPROVED) {
      var sendNotification = true;

      if (data.readStates) {
        if (data.readStates.recipients &&
            data.readStates.recipients[user]) {
          sendNotification = false;
        }
        if (data.readStates.cc &&
            data.readStates.cc[user]) {
          sendNotification = false;
        }
      }

      if (sendNotification) {
        modelUtils.resolveUsers([user], function(resolved) {
          message = message.replace(/{{title}}/g, resolved[0].title);
          message = message.replace(/{{organization}}/g, resolved[0].organization);
          message = message.replace(/{{mailId}}/g, data.mailId);

          azuresettings.makeNotification(message);
          notification.set(data.sender, data.originator, message, url);
          notification.set(data.originator, data.sender, message, url);
        });
      }
    }
  }

  var isRecipient = function(req, data) {
    var currentUserIsRecipient = false;
    var currentUser = req.session.currentUser;
    if (data.recipients) {
      for (var i = 0; i < data.recipients.length; i ++) {
        if (data.recipients[i] == currentUser) {
          currentUserIsRecipient = true;
        }
      }
    }
    if (data.ccList && currentUserIsRecipient == false) {
      for (var i = 0; i < data.ccList.length; i ++) {
        if (data.ccList[i] == currentUser) {
          currentUserIsRecipient = true;
        }
      }
    }

    return currentUserIsRecipient;
  }

  var downloadAttachment = function(req, res) {
    var vals = {};

    if (req.params.id) {
      letter.downloadAttachment(req.params.id, res);
    }
  }

  var viewSingleLetter = function(req, res) {
    var vals = {};

    if (req.params.id) {
      var search = {
        search: {
          _id: ObjectID(req.params.id)
        }
      }

      letter.list(search, function(result){
        // Make sure just one element in result array
        if (result.length == 1) {

          if (result[0].body != null) {
            if (result[0].letterhead != null && result[0].letterhead != '') {
              letterhead = "<img src='/template/letterhead/" + result[0].letterhead + "'><br>";
              vals.body = letterhead;
            }

            if (typeof(vals.body) !== "undefined") {
              vals.body = vals.body + result[0].body;
            } else {
              vals.body = result[0].body;
            }

            vals.title = result[0].title;
          } else {
            vals.body = "Surat ini tidak memiliki badan surat.";
          }
          utils.render(req, res, "letter-single-view", vals, "base-popup-window");
        }
      });
    }
  }

  // List letter based on search input
  var list = function(vals, template, searchInput, req, res, embed) {
    vals.letters = [];

    var organization = req.session.currentUserProfile.organization;
    populateSearch(req, searchInput, function(searchParameter) {
      // Build search data structure
      search = populateSort(req, searchParameter)
      if (req.query.search && req.query.search.string) {
        vals.searchString = req.query.search.string;
      }
      if (req.query.search && req.query.search.letterType) {
        vals["searchLetterType" + req.query.search.letterType] = "selected";
        vals.searchLetterType = req.query.search.letterType;
      }

      letter.list(search, function(result){
        search.limit = 10;

        var page = req.query.page || 1;
        if (embed) {
          page = 1;
        }
        var pages = cUtils.getPages(page, 10, result.length);
        vals.pages = pages;

        search.page = page;
        letter.list(search, function(r) {
          r.forEach(function(e, i) {
            if (r[i].nextReviewer && r[i].nextReviewer == req.session.currentUser) {
              r[i].letterInReview = true;
            }
            r[i].formattedDate = moment(e.date).format("dddd, DD MMMM YYYY");
            r[i]["type" + parseInt(r[i].type)] = true;
            if (typeof(r[i].receivingOrganizations) === "object" && typeof(r[i].receivingOrganizations[organization]) === "object") {
              r[i].incomingAgenda = r[i].receivingOrganizations[organization].agenda || r[i].incomingAgenda;
              r[i].firstDisposition = r[i].receivingOrganizations[organization].firstDisposition;
            }
          });
          vals.letters = r;

          if (embed) {
            embed(req, res, vals);
          } else {
            if (vals.source == "incoming") {
              dispositionController.listBase(req, res, {}, function(req, res, output) {
                var pages = cUtils.getPages(1, 10, output.dispositions.length);
                vals.dispPages = pages;
                vals.dispositionsList = output;
                if (output.dispositions) {
                  for (var i = 0; i < output.dispositions.length; i ++) {
                    if (output.dispositions[i].recipients) {
                      for (var j = 0; j < output.dispositions[i].recipients.length; j ++) {

                        if (output.dispositions[i].recipients[j].recipient == req.session.currentUser) {

                          if (output.dispositions[i].recipients[j].readDate) {
                            output.dispositions[i].readDate = true;
                          }
                          if (output.dispositions[i].recipients[j].followedUpDate) {
                            output.dispositions[i].followedUpDate = true;
                          }
                          break;
                        }
                      }
                    }
                  }
                }
                utils.render(req, res, template, vals, "base-authenticated");
              })
            } else {
              dispositionController.listOutgoingBase(req, res, {}, function(req, res, output) {
                vals.dispositionsList = output;
                utils.render(req, res, template, vals, "base-authenticated");
              })
            }
          }
        }); //letter.list
      }); // letter.list
    }); //populateSearch
  }

  var buildSearchForViewing = function(id, req, res) {
    var organization = req.session.currentUserProfile.organization;
    var o = "receivingOrganizations." + organization;

    var orgSearch = {};
    var search;
    orgSearch[o] = { $exists: true};

    if (utils.currentUserHasRoles([app.simaya.administrationRole], req, res)) {
     search = {
        search: {
          _id: ObjectID(id + ""),
          $or: [
            { senderOrganization: { $regex: "^" + organization } },
            { originator: req.session.currentUser},
          ]
        }
      }
      search.search["$or"].push(orgSearch);
    } else {
      search = {
        search: {
          _id: ObjectID(id + ""),
          $or: [
            { originator: req.session.currentUser},
            { sender: req.session.currentUser},
            { reviewers:
              { $in: [req.session.currentUser] }
            },
            { $and: [
              { recipients:
                { $in: [req.session.currentUser] }
              },
              { status: letter.Stages.RECEIVED }
              ]
            },
            { $and: [
              { senderOrganization: { $regex: "^" + organization } },
              { status: letter.Stages.RECEIVED }
              ]
            },
            { $and: [
              { ccList:
                { $in: [req.session.currentUser] }
              },
              { status: letter.Stages.RECEIVED }
              ]
            },
          ],
        }
      }

      search.search["$or"].push(orgSearch);
    }
    return search;
  }

  var buildSearchForIncoming = function(req, res) {
    // console.log("masuk buildSearchForIncoming");
    var search = {
      search: {}
    };
    if (utils.currentUserHasRoles([app.simaya.administrationRole], req, res)) {
      // console.log("masuk currentUserHasRoles");
      var o = "receivingOrganizations." + req.session.currentUserProfile.organization;
      // console.log("o "+o);
      var normalCase = {
        status: letter.Stages.SENT, // displays SENT and ready to be received
        creation: "normal",
      }
      normalCase[o] = { $exists: true};

      var externalCase = {
        creation: "external",
      }
      externalCase[o] = { status: letter.Stages.SENT };
      search.search["$or"] = [];
      search.search["$or"].push(normalCase);
      search.search["$or"].push(externalCase);
    } else {
      // console.log("masuk else");
      search.search = {
        recipients: {
          $in: [req.session.currentUser]
        },
      }
      var o = "receivingOrganizations." + req.session.currentUserProfile.organization + ".status";
      search.search[o] = letter.Stages.RECEIVED;
      // console.log(search.search[o]);
    }

    return search;
  }

  var listIncoming = function(req, res) {
    // console.log(req.session);
    return listIncomingBase(req, res);
  }

  var listIncomingBase = function(req, res, x, embed) {
    var vals = {
      source: "incoming",
      title: "Surat Masuk",
      currentUser: req.session.currentUser
    };

    var breadcrumb = [
      {text: 'Surat Masuk', isActive: true}
    ];
    vals.breadcrumb = breadcrumb;

    var search = buildSearchForIncoming(req, res);
    search = populateSortForIncoming(req, search);
    list(vals, "letter-incoming", search, req, res, embed);
  }

  var listCc = function(req, res) {
    var vals = {
      title: "Tembusan"
    };

    var breadcrumb = [
      {text: 'Surat Masuk', link: '/incoming'},
      {text: 'Tembusan', isActive: true}
    ];
    vals.breadcrumb = breadcrumb;

    var search = {
      ccList: {
        $in: [req.session.currentUser]
      },
    }
    var o = "receivingOrganizations." + req.session.currentUserProfile.organization + ".status";
    search[o] = letter.Stages.RECEIVED;
    // console.log("SEARCH[o]", search[o]);
    // console.log("SEARCH", search);
    list(vals, "letter-cc", { search: search }, req, res);
  }

  var listReview = function(req, res) {
    var vals = {
      title: "Perlu diproses"
    };

    var breadcrumb = [
      {text: 'Surat Masuk', link: '/incoming'},
      {text: 'Perlu diproses', isActive: true}
    ];
    vals.breadcrumb = breadcrumb;

    var search = {
      nextReviewer: req.session.currentUser,
      $or: [ {status: letter.Stages.WAITING} , {status:letter.Stages.APPROVED} ], // we only list approved letters in incoming
      creation: "external",
    }

    list(vals, "letter-review", { search: search }, req, res);
  }

  var buildSearchForOutgoing = function(req, res) {
    var search = {};
    // console.log("ADMINISTRATION ROLE: " + app.simaya.administrationRole);
    // console.log(req.session.currentUserRoles);
    if (utils.currentUserHasRoles([app.simaya.administrationRole], req, res)) {
      search.search = {
          senderOrganization: req.session.currentUserProfile.organization,
          status: letter.Stages.SENT, // displays SENT only for staff 
          creation: "normal",
      }

    } else {
      // console.log("else");
      search.search = {
        $and: [
        { $or: [
          { originator: req.session.currentUser},
          { reviewers:
            { $in: [req.session.currentUser] }
          }
        ]},
        { $or: [
          { status: letter.Stages.SENT }, // displays all SENT and RECEIVED
          { status: letter.Stages.RECEIVED },
        ]},
        ],
        creation: "normal",
      }
    }

    return search;
  }

  var listOutgoing = function(req, res) {
    return listOutgoingBase(req, res);
  }

  var listOutgoingBase = function(req, res, x, embed) {
    var vals = {
      title: "Surat Keluar",
      source: "outgoing"

    };

    var breadcrumb = [
      {text: 'Surat Keluar', isActive: true}
    ];
    vals.breadcrumb = breadcrumb;

    var search = buildSearchForOutgoing(req, res);
    list(vals, "letter-outgoing", search, req, res, embed);
  }

  var listOutgoingDraft = function(req, res) {
    var vals = {
      title: "Konsep"
    };

    var breadcrumb = [
      {text: 'Surat Keluar', link: '/outgoing'},
      {text: 'Konsep', isActive: true}
    ];
    vals.breadcrumb = breadcrumb;

    if (utils.currentUserHasRoles([app.simaya.administrationRole], req, res)) {
      var search = {
        $or: [
          {
            senderOrganization: { $regex: "^" + req.session.currentUserProfile.organization } ,
            status: letter.Stages.APPROVED, // displays APPROVED and ready to be received
          },
          {
            $and: [
              {$or: [
                { originator: req.session.currentUser},
                { reviewers:
                  { $in: [req.session.currentUser] }
                }
              ]},
              {$or: [
                { status: { $lte: letter.Stages.WAITING }, }, // displays new, in-review, and approved letters
                { status: letter.Stages.APPROVED } // displays new, in-review, and approved letters
              ]},
            ],
          }
          ],


          creation: "normal",
      }
    } else {
      var search = {
        $and: [
        {$or: [
          { originator: req.session.currentUser},
          { reviewers:
            { $in: [req.session.currentUser] }
          }
        ]},
        {$or: [
          { status: { $lte: letter.Stages.WAITING }, }, // displays new, in-review, and approved letters
          { status: letter.Stages.APPROVED } // displays new, in-review, and approved letters
        ]},
        ],

        creation: "normal",
      }
    }
    list(vals, "letter-outgoing-draft", { search: search }, req, res);
  }

  var listOutgoingCancel = function(req, res) {
    var vals = {
      title: "Batal"
    };

    var breadcrumb = [
      {text: 'Surat Keluar', link: '/outgoing'},
      {text: 'Batal', isActive: true}
    ];
    vals.breadcrumb = breadcrumb;

    var search = {
      $or: [
        { originator: req.session.currentUser},
        { reviewers:
          { $in: [req.session.currentUser] }
        }
      ],
      status: letter.Stages.DEMOTED,
      creation: "normal",
    }

    list(vals, "letter-outgoing-cancel", { search: search }, req, res);
  }

  var index = function(req, res) {
    var vals = {
      title: sinergisVar.appName,
    }

    utils.render(req, res, "index", vals, "base-authenticated");
  }

  var sendOutNotifications = function(nextReviewer, status, data, req, res) {
    data.senderResolved = data.senderResolved || {};
    var sender = req.session.currentUser;
    if (nextReviewer != "") {
      azuresettings.makeNotification("Ada surat baru perlu diperiksa, perihal: " + data.title);
      notification.set(sender, nextReviewer, "Ada surat baru perlu diperiksa, perihal: " + data.title, "/letter/read/" + data._id);
    } else {
      if (status == letter.Stages.APPROVED) {
        cUtils.notifyAdministrationOffice(data, req, res);
      }
      else if (status == letter.Stages.SENT) {
        if (data.creation != "internal") {
        // Send message to all receiving administrators
        // Fire and forget
        var organizations = Object.keys(data.receivingOrganizations);
        for (var i = 0; i < organizations.length; i ++) {
          var search = {
            "profile.organization": organizations[i],
            roleList: { $in: [app.simaya.administrationRole]}
          }
          user.list({search: search}, function(r) {
            for (var j = 0; j < r.length; j ++) {
              azuresettings.makeNotification("Ada surat baru perlu diterima, nomor surat: " + data.mailId);
              notification.set(sender, r[j].username, "Ada surat baru perlu diterima, nomor surat: " + data.mailId, "/letter/read/" + data._id);
            }
          });
        }}
      }
      else if (status == letter.Stages.RECEIVED) {
        if (data.creation != "external" && data.ccList) {
          // Send message to all recipients
          for (var i = 0; i < data.ccList.length; i ++) {
            if (data.ccList[i] != "") {
              if (data.senderResolved.title && data.senderResolved.title.length > 0) {
                azuresettings.makeNotification("Ada surat baru dari " + data.senderResolved.title + " " + data.senderResolved.organization+ " yang mana Anda masuk dalam daftar tembusan");
                notification.set(sender, data.ccList[i], "Ada surat baru dari " + data.senderResolved.title + " " + data.senderResolved.organization+ " yang mana Anda masuk dalam daftar tembusan", "/letter/read/" + data._id);
              } else if (data.senderManual) {
                azuresettings.makeNotification("Ada surat baru dari " + data.senderManual.name+ " " + data.senderManual.organization+ " yang mana Anda masuk dalam daftar tembusan");
                notification.set(sender, data.ccList[i], "Ada surat baru dari " + data.senderManual.name+ " " + data.senderManual.organization+ " yang mana Anda masuk dalam daftar tembusan", "/letter/read/" + data._id);
              }
            }
          }
        }

        for (var i = 0; i < data.recipients.length; i ++) {
          if (data.senderResolved.title && data.senderResolved.title.length > 0) {
            azuresettings.makeNotification("Ada surat baru dari " + data.senderResolved.title + " " + data.senderResolved.organization);
            notification.set(sender, data.recipients[i], "Ada surat baru dari " + data.senderResolved.title + " " + data.senderResolved.organization, "/letter/read/" + data._id);
          } else if (data.senderManual) {
            azuresettings.makeNotification("Ada surat baru dari " + data.senderManual.name+ " " + data.senderManual.organization);
            notification.set(sender, data.recipients[i], "Ada surat baru dari " + data.senderManual.name+ " " + data.senderManual.organization, "/letter/read/" + data._id);
          }
        }
      }
      else if (status == letter.Stages.DEMOTED) {
        azuresettings.makeNotification("Ada surat yang dibatalkan");
        notification.set(sender, req.body.originator, "Ada surat yang dibatalkan", "/letter/read/" + data._id);
      }
    }
  }

  var processLetter = function(vals, data, req, res) {
    if (utils.currentUserHasRoles([app.simaya.administrationRole], req, res)) {
      vals.isAdministration = true;
    }
    var ignoreFileAttachments = false;

    if (req.body.ignoreFileAttachments) {
      ignoreFileAttachments = true;
    }
    var savedData = {
      receivedDate: req.body.letter.receivedDate,
      outgoingAgenda: req.body.letter.outgoingAgenda,
      mailId: req.body.letter.mailId,
      fileAttachments: data.fileAttachments,
      ignoreFileAttachments: ignoreFileAttachments,
      recipients: data.recipients,
      senderOrganization: data.senderResolved.organization,
      receivingOrganizations: data.receivingOrganizations,
      ccList: data.ccList,
      title: req.body.letter.title,
      body: req.body.letter.body,
      priority: req.body.letter.priority,
      classification: req.body.letter.classification,
      comments: req.body.letter.comments,
      reviewers: data.reviewers,
      nextReviewer: data.nextReviewer,
      status: data.status,
      log: [ {
        date: new Date(),
        username: req.session.currentUser,
        action: data.action,
        message: req.body.message,
        } ],
    }

    if (req.body.letter.outgoingAgenda) {
      savedData.outgoingDate = new Date();
    }

    vals.letter.outgoingAgenda = req.body.letter.outgoingAgenda;
    vals.letter.mailId = req.body.letter.mailId;

    if (vals.sender) {
      savedData.sender = vals.sender;
    }

    if (vals.externalSender) {
      // Only saved into an external letter
      savedData.externalSender = vals.externalSender;
    }
    if (vals.Body) {
      savedData.body = vals.Body;
    }

    if (data.status == letter.Stages.SENT) {
      // At this point the letter is sent to the recipients
      // which need to have their own statuses

      Object.keys(savedData.receivingOrganizations).forEach(function(item) {
        savedData.receivingOrganizations[item].status = letter.Stages.SENT;
      });

    }

    letter.edit(req.body.id, savedData, function(v){
      if (v.hasErrors() == false) {
        vals.successful = true;
        letter.list({ search: {_id: ObjectID(req.body.id) } }, function(result) {


          sendOutNotifications(data.nextReviewer, data.status, result[0], req, res);

          vals.nextReviewerResolved = result[0].nextReviewerResolved;
          vals.recipientsResolved = result[0].recipientsResolved;

          if (!vals.nextReviewer) {
            vals.nextReviewerResolved = null;
          }

          utils.render(req, res, "letter-edit-review", vals, "base-authenticated");
        });

      } else {
        vals.unsuccessful = true;
        vals.form = true;
        if (data.status == letter.Stages.APPROVED) {
          vals.composing = true;
        } if (data.status == letter.Stages.SENT) {
          vals.readyToSend = true;
        }
        var dataErrors = {
          "mailId is not set": "Surat belum diberi nomor",
          "outgoing agenda is not set": "Belum ada nomor agenda keluar",
          "fileAttachments is not set": "Berkas pindaian belum dilampirkan"
        }

        var errorMessages = [];
        if (v.errors.Data != null) {
          for (var i = 0; i < v.errors.Data.length; i ++) {
            errorMessages.push( { errorTitle: dataErrors[v.errors.Data[i]] });
          }
        }

        if (v.errors.mailId != null) {
          for (var i = 0; i < v.errors.mailId.length; i ++) {
            errorMessages.push( { errorTitle: v.errors.mailId[i] });
          }
        }
        vals.errorMessages = errorMessages;
        utils.render(req, res, "letter-edit-review", vals, "base-authenticated");
      }
    });
  }

  var handleButtons = function(vals, data, req, res) {
    if (req.body.sendButton) {
      data.action = "sent";
      data.status = letter.Stages.SENT;
      vals.statusProcessed = true;
      if (data.creation == "internal") {
        // skip SENT state and immediately to RECEIVED state
        data.status = letter.Stages.RECEIVED;
      }
    } else if (req.body.approveButton) {
      data.action = "approved";
      if (data.status == letter.Stages.NEW) {
        // if current status is new
        // then the letter status is in-review
        data.nextReviewer = data.reviewers[0];
        data.status = letter.Stages.WAITING;
      } else {
        for (var i = 0; i < data.reviewers.length; i ++) {
          if (req.session.currentUser == data.reviewers[i]) {
            if (data.reviewers[i+1]) {
              data.nextReviewer = data.reviewers[i+1];
              data.status = letter.Stages.WAITING;
            } else {
              data.nextReviewer = "";
              data.status = letter.Stages.APPROVED;
              vals.statusApproved = true;
            }
          }
        }
      }
    }
    else if (req.body.declineButton) {
      data.action = "declined";
      data.status = letter.Stages.WAITING;
      for (var i = 0; i < data.reviewers.length; i ++) {
        if (req.session.currentUser == data.reviewers[i]) {
          if (i > 0) {
            data.nextReviewer = data.reviewers[i-1];
          } else {
            // if the next reviewer is the originator,
            // set the status back to new, so the review process is restarted
            data.nextReviewer = req.body.originator;
            data.status = letter.Stages.NEW;
          }
        }
      }
    }
    else if (req.body.demoteButton) {
      data.action = "demoted";
      data.status = letter.Stages.DEMOTED;
    }

  }

  // Gets the reviewer candidates
  var getReviewer = function(req, res) {
    var p = req.session.currentUserProfile;
    var pquery = req.query.org;
    var me = req.session.currentUser;

    // expand organizations
    // var org = p.organization;
    // console.log(p.organization, p.echelon);
    var org = pquery || p.organization;
    var orgs = [ org ];
    var i = org.lastIndexOf(";");
    while (i > 0) {
      org = org.substr(0, i);
      orgs.push(org);
      i = org.lastIndexOf(";");
    }

    // Only look into the organization of level 2
    var queryOrganization = org;
    // console.log(queryOrganization);
    if (orgs.length > 2) {
      queryOrganization = orgs[(orgs.length - 1)- 2];
    } else if (orgs.length > 1) {
      // Narrow down if length is only 2 echelons
      queryOrganization = orgs[(orgs.length - 1)- 1];
    }

    /*var search = {
      search: {
        "profile.organization": { $regex: "^" + queryOrganization },
        "profile.echelon": {$lt: (parseInt(p.echelon) + "z")},
        "username": {$ne: me}
      }
    }*/

    var search = {
      search: {
        "profile.organization": pquery,
        "profile.echelon": {$lt: 5 + "z"}
      }
    }
    user.list(search, function(r) {
      if (r == null) {
        r = [];
      }
      var added = [];
      if (req.query) {
        added = req.query.added
      }
      
      var copy = cUtils.stripCopy(r, added);
      res.send(JSON.stringify(copy));
    });
  }

  // Gets the Cc candidates
  var getCc = function(req, res) {
    if (req.query.org) { 
      var search = {
        search: {
          "profile.organization": req.query.org,
          $or: [
            {
              "profile.echelon": {$lte: "2z"}
            },
            {
              roleList: { $in: [ "sender" ]}
            }
          ]
        },
      }

      user.list(search, function(r) {
        if (r == null) {
          r = [];
        }

        var added = [];
        if (req.query) {
          added = req.query.added
        }

        var copy = cUtils.stripCopy(r, added);
        res.send(JSON.stringify(copy));
      });
    } else {
      res.send("[]");
    }
  }

  // Gets the Recipient candidates
  var getRecipient = function(req, res) {
    if (req.query.org) {
      deputy.getCurrent(req.query.org, function(info) {
        var search = {}

        if (info != null && info.active == true) {
          var deputyActive = true;
          search = {
            search: {
              username: info.assignee
            },
          }
        } else {
          search = {
            search: {
              "profile.organization": req.query.org,
              $or: [
                {
                  "profile.echelon": {$lte: "2z"}
                },
                {
                  roleList: { $in: [ "sender" ]}
                }
              ]
            },
          }
        }

        user.list(search, function(r) {
          if (r == null) {
            r = [];
          }

          var added = [];
          if (req.query) {
            added = req.query.added
          }

          var copy = cUtils.stripCopy(r, added);
          if (deputyActive) {
            copy[0].deputyActive = true;
            copy[0].title = info.title;
          }
          res.send(JSON.stringify(copy));
        });
      });
    } else {
      res.send("[]");
    }
  }

  // Gets the sender candidates for external letter
  var getSenderExternal = function(req, res) {
    if (req.query.org) {
      var search = {
        search: {
          "profile.organization": req.query.org,
          $or: [
            {
              "profile.echelon": {$lte: "2z"}
            },
            {
              roleList: { $in: [ "sender" ]}
            }
          ]
        },
      }

      user.list(search, function(r) {
        if (r == null) {
          r = [];
        }

        var added = [];
        if (req.query) {
          added = req.query.added
        }

        var copy = cUtils.stripCopy(r, added);
        res.send(JSON.stringify(copy));
      });
    } else {
      res.send("[]");
    }
  }


  // Gets the Recipient candidates for external letter
  var getRecipientExternal = function(req, res) {
  var myOrganization = req.session.currentUserProfile.organization;
    var search = {
      search: {
        "profile.organization": myOrganization,
        $or: [
          {
            "profile.echelon": {$lte: "2z"}
          },
          {
            roleList: { $in: [ "sender" ]}
          }
        ]
      },
    }

    deputy.getCurrent(myOrganization, function(info) {
      var deputy = false;
      if (info != null && info.active == true) {
        deputy = true;
        search.search = { username: info.assignee }
      }

      user.list(search, function(r) {
        if (r == null) {
          r = [];
        } else {
          if (deputy == true) {
            r[0].profile.title = "PLH " + r[0].profile.title;
          }
        }

        var added = [];
        if (req.query) {
          added = req.query.added
        }

        var copy = cUtils.stripCopy(r, added);
        res.send(JSON.stringify(copy));
      });
    });
  }

  var listIncomingAgenda = function (req, res) {
    var vals = {
      title: "Agenda Surat Masuk",
      currentUser: req.session.currentUser
    };
    if (utils.currentUserHasRoles([app.simaya.administrationRole], req, res)) {
      vals.hasAdministrationRole = true;
    }

    var breadcrumb = [
      {text: 'Agenda Masuk', isActive: true}
    ];
    vals.breadcrumb = breadcrumb;

    var o = "receivingOrganizations." + req.session.currentUserProfile.organization + ".status";
    var search = {
      search: {}
    }
    search.search[o] = letter.Stages.RECEIVED; // The letter is received in this organization
    search = populateSortForIncoming(req, search);
    list(vals, "agenda-incoming", search, req, res);
  }


  var listOutgoingAgenda = function(req, res) {
    var vals = {
      title: "Agenda Surat Keluar",
      currentUser: req.session.currentUser
    };
    if (utils.currentUserHasRoles([app.simaya.administrationRole], req, res)) {
      vals.hasAdministrationRole = true;
    }

    var breadcrumb = [
      {text: 'Agenda Keluar', isActive: true}
    ];
    vals.breadcrumb = breadcrumb;

    var search = {
      senderOrganization: req.session.currentUserProfile.organization,
      $or: [
        {status: letter.Stages.RECEIVED}, // displays SENT or RECEIVED
        {status: letter.Stages.SENT}, // displays SENT or RECEIVED
      ],
      outgoingAgenda: { $ne: null }
    }
    list(vals, "agenda-outgoing", { search: search }, req, res);
  }

  var preview = function(req, res) {
    var vals = {};
    if (typeof(req.body.letter) !== "undefined") {
      var body;
      if (req.body.letter.letterhead != null) {
        letterhead = "<img src='/template/letterhead/" + req.body.letter.letterhead + "'><br>";
        body = letterhead;
      }
      if (req.body.letter.body != null) {
        // Parsing template tag
        body = body + req.body.letter.body;
        body = body.replace("[NOMORSURAT]", req.body.letter.mailId);
        body = body.replace("[PERIHAL]", req.body.letter.title);
        body = body.replace("[TANGGAL]", req.body.letter.date);
        var tandaTangan = req.body.letter.title + "<br><br><br>" + req.body.letter.sender;
        body = body.replace("[TANDATANGAN]", tandaTangan);
      }
      vals.body = body;
      req.session.letterBody = body
      utils.render(req, res, "pdf-viewer-preview", vals, "base-popup-window");
      // console.log("preview " + req.body);
    }
  }

  var reject = function(req, res) {
    if (req.body.id) {
      var search = {
        search: {
          _id: ObjectID(req.body.id),
          recipients: { $in: [req.session.currentUser] },
        }
      }

      letter.list(search, function(result){
        // Make sure just one element in result array
        if (result.length == 1) {
          letter.reject(req.body.id,
              req.session.currentUser,
              req.session.currentUserProfile.organization,
              req.body.reason,
              function (result) {
            var code = 200;
            if (!result) {
              code = 500;
            }
            res.send(JSON.stringify({ok:result, code: code}));
          });
        } else {
          res.send(JSON.stringify({ok:false, code: 500}));
        }
      });
    } else {
      res.send(JSON.stringify({ok:false, code: 404}));
    }
  }

  var populateSortForIncoming = function (req, search) {
    var organization = req.session.currentUserProfile.organization;
    search.sort = search.sort || {};
    search.sort["date"] = -1;
    return search;
  }

  var populateSort = function (req, search) {
    var organization = req.session.currentUserProfile.organization;
    if (req.query.sort && req.query.sort.string) {
      var sort = req.query.sort["string"];
      search.sort = search.sort || {};
      var dir = parseInt(req.query.sort["dir"]) || -1;
      switch (sort) {
        case "type":
          search.sort["type"] = dir;
          break;
        case "date":
          search.sort["date"] = dir;
          break;
        case "mailId":
          search.sort["mailId"] = dir;
          break;
        case "sender":
          search.sort["sender"] = dir;
          break;
        case "recipients":
          search.sort["recipients"] = dir;
          break;
        case "title":
          search.sort["title"] = dir;
          break;
        case "incomingAgenda":
          search.sort["receivingOrganizations." + organization + ".agenda"] = dir;
          break;
        case "outgoingAgenda":
          search.sort["outgoingAgenda"] = dir;
          break;
        default:
          search.sort["date"] = dir;
          search.sort["receivingOrganizations." + organization + ".agenda"] = dir;
          break;
      }
    } else {
      search.sort = search.sort || {};
      search.sort["date"] = -1;
      search.sort["receivingOrganizations." + organization + ".agenda"] = -1;
    }
    return search;
  }

  var populateSearch = function(req, search, callback) {
    if (req.query.search && req.query.search.string) {
      var searchStrings = req.query.search["string"];
      user.list({search: { "profile.fullName" : { $regex: searchStrings, $options: "i" }}}, function(r) {
        var userSearch = [];
        if (r != null) {
          for (var i = 0; i < r.length; i ++) {
            userSearch.push(r[i].username);
          }
        }
        var searchLetterType = req.query.search["letterType"]
        var and = search.search["$and"]
        var organization = req.session.currentUserProfile.organization;
        var incomingAgendaSearch = "receivingOrganizations." + organization + ".agenda";
        // create search object
        var searchObj = {
              $or : [
                {
                  "title": { $regex : searchStrings, $options: "i" }
                }
                , {
                  "body": { $regex : searchStrings, $options: "i" }
                }
                , {
                  "senderManual.name": { $regex : searchStrings, $options: "i" }
                }
                , {
                  "senderManual.organization": { $regex : searchStrings, $options: "i" }
                }
                , {
                  "mailId": { $regex : searchStrings, $options: "i" }
                }
                , {
                  "outgoingAgenda": { $regex : searchStrings, $options: "i" }
                }
              ]}

        // For incoming agenda
        var a = {};
        a[incomingAgendaSearch] = searchStrings;
        searchObj["$or"].push(a);

        if (userSearch.length > 0) {
          searchObj["$or"].push({ sender: { $in: userSearch }});
          searchObj["$or"].push({ recipients: { $in: userSearch }});
        }

        // Append search object into the search input
        if (and) {
          search.search["$and"].push(searchObj)
        } else {
          search.search["$and"] = [searchObj]
        }
        if (searchLetterType) {
          if (search.search["$and"]) {
            search.search["$and"].push({"type": searchLetterType})
          } else {
            search.search["$and"] = [{"type": searchLetterType}]
          }
        }
        callback(search);
      }); // user.list
    } else {
      callback(search);
    }
  }

  var viewPDFStub = function(req, res) {
    data = req.params[0].split("/");
    var vals = {
      pdf: data[1],
      letter: data[0],
    };
    if (data[2]) {
      vals.disposition = data[2];
    }
    if (req.query.allowDisposition) {
      vals.allowDisposition = true;
    }
    utils.render(req, res, "pdf-viewer", vals, "base-authenticated");
  }

  var viewPDF = function(req, res) {
    var vals = {};
    utils.render(req, res, "pdfViewer", vals, "base-empty-body");
  }

  var previewHTMLProvider = function(req, res){
    res.set('Content-Type', 'text/html');
    res.send(req.session.letterBody);
  }

  var previewPDFStream = function(req, res){
    var args = ['phantomjs',  __dirname + '/scripts/pdf.js', 'http', "'" + req.headers.host + "'" , "'" + JSON.stringify(req.headers) + "'"];
    // handles linux nasty piping problem
    var preview = spawn('/bin/sh', ['-c', args.join(' ') + ' | cat']);
    preview.stdout.pipe(res);
  }

  var demoteLetter = function(req, res) {
    if (req.body && req.body.letterId && req.body.message) {
      var search = {
        search: {
          _id: ObjectID(req.body.letterId),
        }
      }
      letter.list(search, function(result){
        if (result != null && result.length == 1) {
          if (result[0].status == letter.Stages.WAITING
              && result[0].originator == req.session.currentUser) {
            var data = {
              status: letter.Stages.DEMOTED
              , log: [ {
                date: new Date(),
                username: req.session.currentUser,
                action: "demoted",
                message: req.body.message,
                } ],
            }
            letter.edit(req.body.letterId, data, function(v) {
              res.send(JSON.stringify({result: "OK"}));
              return;
            })
          }
        }
        res.send(JSON.stringify({result: "ERROR"}));
      })
    } else {
      res.send(JSON.stringify({result: "ERROR"}));
    }
  }

  var getDocumentMetadata = function(req, res) {
    var vals = {};

    if (req.params.id) {
      letter.getDocumentMetadata(req.params.id, res);
    } else {
      res.send(JSON.stringify({result: "ERROR"}));
    }
  }

  var renderDocumentPage = function(req, res) {
    data = req.params[0].split("/");
    if (data.length > 0 && data[0] && data[1]) {
      letter.renderDocumentPage(data[0], data[1], res);
    } else {
      res.send(JSON.stringify({result: "ERROR"}));
    }
  }

  // Returns attachments
  var attachments = function(req, res){
    var bundle = {files : []};

    // find the letter
    letter.list({ search : { _id : ObjectID(req.params.id)} } , function(r){

      if (r.length > 0) {
        if (r[0].hasOwnProperty('fileAttachments')) {
          var files = r[0].fileAttachments;
          // decorates the file with letterId
          if (files) {
            for (var i = 0; i < files.length; i++) {
              var file = files[i];
              file.letterId = req.params.id;
              bundle.files.push(file);
            }
          }
        }
      }
      // sends the bundle!
      res.send(bundle);
    })
  }

  // Handles file upload
  var uploadAttachment = function(req, res){

    var files = req.files.files;

    if (files && files.length > 0) {

      var file = files[0];
      var metadata = {
        path : file.path,
        name : file.name,
        type : file.type
      };

      // uploads file to gridstore
      letter.saveAttachmentFile(metadata, function(err, result) {

        var file = {
          path : result.fileId,
          name : metadata.name,
          type : metadata.type
        };

        letter.addFileAttachment({ _id : ObjectID(req.body.draftId)}, file, function(err) {
          if(err) {
            file.error = "Failed to upload file";
          }

          // wraps the file
          var bundles = { files : []}
          file.letterId = req.body.draftId
          bundles.files.push(file)
          // console.log(bundles);

          // sends the bundles!
          res.send(200, bundles);
        });

      });

    }
  }

  // Deletes an attachment of a letter
  var deleteAttachment = function(req, res){

    var file = {}

    function fileStatus(message) {

      file.deleted = true;

      if (message) {
        file.deleted = false;
        file.error = message;
      }

      // wraps the file
      var bundles = { files : []}
      file.letterId = req.params.draftId
      file.attachmentId = req.params.attachmentId
      bundles.files.push(file)

      return res.send(bundles);
    }

    // if undefined returns an error
    if(!req.params.letterId && !req.params.attachmentId) {
      return fileError("Unable to delete file");
    }

    var letterId = ObjectID(req.params.letterId)

    letter.list({ search : { _id : letterId} }, function(letters) {
      if (letters.length > 0) {

        var fileAttachments = letters[0].fileAttachments
        var fileTobeDeleted;
        for (var i = 0; i < fileAttachments.length; i++) {
          if (fileAttachments[i].path == req.params.attachmentId) {
            fileTobeDeleted = fileAttachments[i];
            break;
          }
        }

        if (fileTobeDeleted) {

          // delete
          letter.removeFileAttachment({ _id : ObjectID(req.params.letterId)}, fileTobeDeleted, function(err) {

            if (err) {
              return fileStatus("File not found");
            }

            // returns file status OK
            return fileStatus();

          })
        } else {
          return fileStatus("File not found");
        }
      }
    })
  }

  return {
    createExternal: createExternal
    , createNormal: createNormal
    , create: create
    , viewLetter: viewLetter
    , viewSingleLetter: viewSingleLetter
    , downloadAttachment: downloadAttachment
    , listIncoming: listIncoming
    , listIncomingBase: listIncomingBase
    , listCc: listCc
    , listReview: listReview
    , listOutgoing: listOutgoing
    , listOutgoingBase: listOutgoingBase
    , listOutgoingDraft: listOutgoingDraft
    , listOutgoingCancel: listOutgoingCancel
    , review: review
    , receive: receiveLetter
    , index: index
    , getReviewerCandidates: getReviewer
    , getCcCandidates: getCc
    , getRecipientCandidates: getRecipient
    , getSenderExternalCandidates: getSenderExternal
    , getRecipientExternalCandidates: getRecipientExternal
    , listIncomingAgenda: listIncomingAgenda
    , listOutgoingAgenda: listOutgoingAgenda
    , preview: preview
    , reject: reject
    , viewPDFStub : viewPDFStub
    , viewPDF : viewPDF
    , previewHTMLProvider : previewHTMLProvider
    , previewPDFStream : previewPDFStream
    , demoteLetter: demoteLetter
    , getDocumentMetadata: getDocumentMetadata
    , renderDocumentPage: renderDocumentPage
    , buildSearchForIncoming: buildSearchForIncoming
    , buildSearchForOutgoing: buildSearchForOutgoing
    , buildSearchForViewing: buildSearchForViewing
    , populateSortForIncoming: populateSortForIncoming
    , attachments : attachments
    , uploadAttachment : uploadAttachment
    , deleteAttachment : deleteAttachment
    , populateSearch: populateSearch
  }
};
}
