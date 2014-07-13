module.exports = function(app){
  var utils = require("../../../../sinergis/controller/utils.js")(app)
  var letterWeb = require("../../letter.js")(app)
  var orgWeb = require("../../organization.js")(app)
  var letter = require("../../../models/letter.js")(app)
  var letterUtils = require("../../../models/utils.js")(app)
  var user = require("../../../../sinergis/models/user.js")(app)
  var moment = require("moment")
  var ObjectID = app.ObjectID;
  var disposition = require("../../../models/disposition.js")(app)
    , cUtils = require("../../utils.js")(app)

  // Resolve users and calls as a hash
  var resolveUsers = function(senders, result, callback) {
    letterUtils.resolveUsers(Object.keys(senders), function(resolved) {
      var resolvedHash = {};
      resolved.forEach(function(e, i) {
        var key = resolved[i].username;
        resolvedHash[key] = resolved[i];
      });

      result.forEach(function(e, i) {
        var sender = result[i].sender;
        result[i].senderUsername = result[i].sender;
        if (sender && resolvedHash[result[i].sender]) {
          result[i].sender = resolvedHash[result[i].sender].name + ", " + 
                             resolvedHash[result[i].sender].title + ", " + 
                             resolvedHash[result[i].sender].organization; 
        } else if (result[i].senderManual) {
          result[i].sender = result[i].senderManual.name + ", " + result[i].senderManual.organization;
          delete(result[i].senderManual);
        }
      });

      // Resolve dispositions
      if (result.length == 1 && result[0].dispositionList && result[0].dispositionList.length > 0) {
        for (var i = 0; i < result[0].dispositionList.length; i ++) {
          var key = result[0].dispositionList[i].sender;
          var name;
          if (resolvedHash[key]) {
            name = resolvedHash[key].name;
          }
          result[0].dispositionList[i].senderUsername = key; 
          result[0].dispositionList[i].sender = name || result[0].dispositionList[i].sender;
          result[0].dispositionList[i].date = moment(result[0].dispositionList[i].date).format("dddd, DD MMMM YYYY");
          if (result[0].dispositionList[i].readDate) {
            result[0].dispositionList[i].readDate = moment(result[0].dispositionList[i].readDate).format("dddd, DD MMMM YYYY");
          }

          for (var j = 0; j < result[0].dispositionList[i].recipients.length; j ++) {
            var key = result[0].dispositionList[i].recipients[j].recipient;
            var name;
            if (resolvedHash[key]) {
              name = resolvedHash[key].name;
            }
            result[0].dispositionList[i].recipients[j].recipientUsername = key;
            result[0].dispositionList[i].recipients[j].recipient = name || result[0].dispositionList[i].recipients[j].recipient;
            result[0].dispositionList[i].recipients[j].date = moment(result[0].dispositionList[i].recipients[j].date).format("dddd, DD MMMM YYYY");
            if (result[0].dispositionList[i].recipients[j].declinedDate) {
              result[0].canDeclineDisposition = false;
              var date = moment(result[0].dispositionList[i].recipients[j].declinedDate).format("DD MMMM YYYY");
              result[0].dispositionList[i].recipients[j].declinedDate = date;
            }
          }

          if (result[0].dispositionList[i].comments) {
            for (var j = 0; j < result[0].dispositionList[i].comments.length; j++) {
              var date = moment(result[0].dispositionList[i].comments[j].date).format("DD MMMM YYYY");
              result[0].dispositionList[i].comments[j].date = date;
              var commenter = result[0].dispositionList[i].comments[j].commenter;
              name = undefined;
              if (resolvedHash[commenter]) {
                name = resolvedHash[commenter].name;
              }
              result[0].dispositionList[i].comments[j].commenterUsername = commenter;
              result[0].dispositionList[i].comments[j].commenter = name || result[0].dispositionList[i].comments[j].commenter;
            }
          }
        }
      }
      callback(result);
    });
  }

  var extractData = function(result, req, res, callback) {
    var org = req.session.currentUserProfile.organization; 
    var me = req.session.currentUser;
    var meMangled = me.replace(".", "___");
    var senders = {};

    result.forEach(function(e, i) {
      senders[result[i].sender] = 1; 
      result[i].rawDate = result[i].date;
      result[i].date = moment(result[i].date).format("dddd, DD MMMM YYYY");
      if (result[i].receivingOrganizations[org]) {
        result[i].incomingAgenda = result[i].receivingOrganizations[org].agenda;
        if (result[i].receivingOrganizations[org].status == letter.Stages.RECEIVED) {
          result[i].isRead = true;
        }
        delete(result[i].receivingOrganizations);
      }
      if (result[i].readStates) {
        if (result[i].readStates["recipients"]) {
          if (result[i].readStates.recipients[meMangled]) {
            result[i].isRead = true;
          }
        } else if (result[i].readStates["cc"]) {
          if (result[i].readStates.cc[meMangled]) {
            result[i].isRead = true;
          }
        }
        delete(result[i].readStates);
      }
    });

    // Single data
    if (result.length == 1) {
      if (result[0].recipients) {
        for (var i = 0; i < result[0].recipients.length; i ++) {
          if (result[0].recipients[i] == me && result[0].isRead) {
            result[0].allowDisposition = true;
            result[0].canRejectIncomingLetter = true;
            result[0].canCommentDisposition = true;
          }
        }
      }
      disposition.list({search: {
        // letterId is not objectId, hence the + ""
        letterId: result[0]._id + ""
      }}, function(dispositionResult) {
        for (var i = 0; i < dispositionResult.length; i++) {
          senders[dispositionResult[i].sender] = 1;
          for (var j = 0; j < dispositionResult[i].recipients.length; j++) {
            senders[dispositionResult[i].recipients[j].recipient]  = 1;
            if (dispositionResult[i].recipients[j].recipient == me) {
              result[0].canDeclineDisposition = true;
              result[0].canCommentDisposition = true;
              result[0].allowDisposition = true;
            }
          }
        }
        result[0].dispositionList = dispositionResult;
        if (dispositionResult.length > 0) {
          // already has disposition
          // can no longer reject
          result[0].canRejectIncomingLetter = false;
        }
        resolveUsers(senders, result, function(result) {
          callback(result);
        });
      });
    } else {
      resolveUsers(senders, result, function(result) {
        callback(result);
      });
    }
  }

  var list = function(search, req, res) {
    letterWeb.populateSearch(req, search, function(search) {
      letter.list(search, function(result){
        if (result == null) {
          res.send([]);
          return;
        }
        extractData(result, req, res, function(result) {
          var data = {
            status: 0,
            data: result,
            next: (result == null) ? "" : (parseInt(search.page) + 1),
            prev: "",
          }

          res.send(data);
        });
      });
    });
  }

  /**
   * @api {get} /letter/incoming-agenda Gets list of incoming agenda
   * @apiName IncomingAgenda
   * @apiGroup Letter
   *
   * @apiParam {Number} [page=1]
   * @apiSuccess {Object} result
   * @apiSuccess {Object[]} data
   * @apiSuccess {String} _id The Object Id of the letter
   * @apiSuccess {Boolean} isRead Whether the letter is read
   * @apiSuccess {String} sender The sender of the letter
   * @apiSuccess {String} incomingAgenda The agenda number
   * @apiSuccess {String} title The title of the letter
   * @apiSuccess {String} senderUsername The username of the sender
   * @apiSuccess {String} date The date of the letter 
   * @apiSuccess {String} next Next page
   */
  var incomingAgenda = function(req, res){
    var search = {
      search: {} 
    }
    search.fields = {title:1, date:1, sender: 1, receivingOrganizations: 1, senderManual:1, readStates: 1};
    search.page = req.query["page"] || 1;
    search.limit = 30;

    console.log(JSON.stringify(search));
    var o = "receivingOrganizations." + req.session.currentUserProfile.organization + ".status";
    search.search[o] =  letter.Stages.RECEIVED; // The letter is received in this organization 
    search = letterWeb.populateSortForIncoming(req, search);

    list(search, req, res);
  }

  /**
   * @api {get} /letter/outgoing Gets list of outgoing letters
   * @apiName Outgoing
   * @apiGroup Letter
   *
   * @apiParam {Number} [page=1]
   * @apiSuccess {Object} result
   * @apiSuccess {Object[]} data
   * @apiSuccess {String} _id The Object Id of the letter
   * @apiSuccess {Boolean} isRead Whether the letter is read
   * @apiSuccess {String} sender The sender of the letter
   * @apiSuccess {String} outgoingAgenda The agenda number
   * @apiSuccess {String} title The title of the letter
   * @apiSuccess {String} senderUsername The username of the sender
   * @apiSuccess {String} date The date of the letter 
   * @apiSuccess {String} next Next page
   */
  var outgoingAgenda = function(req, res){
    var search = {
    }
    search.fields = {title:1, date:1, sender: 1, receivingOrganizations: 1, senderManual:1, readStates: 1};
    search.page = req.query["page"] || 1;
    search.limit = 30;
    search.search = { 
      senderOrganization: req.session.currentUserProfile.organization,
      $or: [
        {status: letter.Stages.RECEIVED}, // displays SENT or RECEIVED 
        {status: letter.Stages.SENT}, // displays SENT or RECEIVED 
      ],
      outgoingAgenda: { $ne: null }
    }

    list(search, req, res);
  }
  /**
   * @api {get} /letter/incoming Gets list of incoming letters
   * @apiName Incoming
   * @apiGroup Letter
   *
   * @apiParam {Number} [page=1]
   * @apiSuccess {Object} result
   * @apiSuccess {Object[]} data
   * @apiSuccess {String} _id The Object Id of the letter
   * @apiSuccess {Boolean} isRead Whether the letter is read
   * @apiSuccess {String} sender The sender of the letter
   * @apiSuccess {String} incomingAgenda The agenda number
   * @apiSuccess {String} title The title of the letter
   * @apiSuccess {String} senderUsername The username of the sender
   * @apiSuccess {String} date The date of the letter 
   * @apiSuccess {String} next Next page
   */
  var incoming = function(req, res){
    var search = letterWeb.buildSearchForIncoming(req, res);
    search = letterWeb.populateSortForIncoming(req, search);
    search.fields = {title:1, date:1, sender: 1, receivingOrganizations: 1, senderManual:1, readStates: 1};
    search.page = req.query["page"] || 1;
    search.limit = 30;
    list(search, req, res);
  }

  /**
   * @api {get} /letter/outgoing Gets list of outgoing letters
   * @apiName Outgoing
   * @apiGroup Letter
   *
   * @apiParam {Number} [page=1]
   * @apiSuccess {Object} result
   * @apiSuccess {Object[]} data
   * @apiSuccess {String} _id The Object Id of the letter
   * @apiSuccess {Boolean} isRead Whether the letter is read
   * @apiSuccess {String} sender The sender of the letter
   * @apiSuccess {String} outgoingAgenda The agenda number
   * @apiSuccess {String} title The title of the letter
   * @apiSuccess {String} senderUsername The username of the sender
   * @apiSuccess {String} date The date of the letter 
   * @apiSuccess {String} next Next page
   */
  var outgoing = function(req, res){
    var search = letterWeb.buildSearchForOutgoing(req, res); 

    search.fields = {title:1, date:1, sender: 1, receivingOrganizations: 1, senderManual:1, readStates: 1};
    search.page = req.query["page"] || 1;
    search.limit = 30;
    list(search, req, res);
  }

  /**
   * @api {get} /letter/view Opens and views a letter
   * @apiName View
   * @apiGroup Letter
   *
   * @apiParam {String} id Object Id of the letter
   * @apiSuccess {Boolean} isRead Whether the letter is read
   * @apiSuccess {String} sender The sender of the letter
   * @apiSuccess {String} outgoingAgenda The agenda number (outgoing)
   * @apiSuccess {String} incomingAgenda The agenda number (incoming)
   * @apiSuccess {String} title The title of the letter
   * @apiSuccess {String} senderUsername The username of the sender
   * @apiSuccess {String} date The date of the letter 
   * @apiSuccess {String} mailId Mail number 
   * @apiSuccess {Object[]} fileAttachments List of attachments
   * @apiSuccess {String} fileAttachments.name File name 
   * @apiSuccess {String} fileAttachments.path File path 
   * @apiSuccess {Object[]} recipientResolved List of recipients
   * @apiSuccess {String} recipientResolved.name Name of recipient
   * @apiSuccess {String} recipientResolved.title Title of recipient
   * @apiSuccess {String} recipientResolved.organization Organization of recipient
   * @apiSuccess {String} comments Notes and comments
   * @apiSuccess {String} sender Sender of the letter
   * @apiSuccess {String} senderOrganization Organization of the letter
   * @apiSuccess {Number} priority Priority of the letter
   * @apiSuccess {Number} classification Classification of the letter
   * @apiSuccess {Number} type Type of the letter
   */
  var view = function(req, res) {
    var search = letterWeb.buildSearchForViewing(req.query.id, req, res); 
    var search = {
      search: {
        _id: ObjectID(req.query.id)
      }
    }

    letter.list(search, function(result){
      var me = req.session.currentUser;
      var myOrganization = req.session.currentUserProfile.organization;
      var passed = false;
      if (result && result.length == 1) {
        if (result[0].originator == me) {
          passed |= true;
        }
        if (!passed &&  result[0].receivingOrganizations) {
          var keys = Object.keys(result[0].receivingOrganizations);
          for (var i = 0; i < keys.length; i ++) {
            if (keys[i] == myOrganization) {
              passed |= true;
            }
          }
        }
        if (!passed && result[0].senderOrganization == myOrganization) {
          passed |= true;
        }
        
        disposition.list({
          search: {
            letterId: req.query.id
          }
        }, function(disposition) {
          if (disposition) {
            for (var j = 0; j < disposition.length; j ++) {
              for (var k = 0; k < disposition[j].recipients.length; k ++) {
                console.log(disposition[j].recipients);
                var recipient = disposition[j].recipients[k].recipient;
                if (recipient == me) {
                  passed |= true;
                }
              }
            }
          }
          if (passed) {
            extractData(result, req, res, function(result) {
              var data = {
                status: 0,
                data: result,
              }
              letter.setReadState(req.query.id, me);
              res.send(data);
            });
          } else {
            res.send({
              status: 0,
              data: []
            });
          }
        })
      }
    });
  }

  /**
   * @api {get} /letter/document/metadata Gets metadata of an attachment
   * @apiName DocumentMetadata
   * @apiGroup Letter
   *
   * @apiParam {String} id Object Id of the attachment
   * @apiSuccess {Number} Pages Number of pages
   */
  var documentMetadata = function(req, res) {
    var vals = {};
    
    if (req.query.id) {
      letter.getDocumentMetadata(req.query.id, res);
    } else {
      res.send(JSON.stringify({result: "ERROR"}));
    }
  }
 
  var documentRenderingBase = function(base64, req, res) {
    var file = req.query.file;
    var page = req.query.page;
    if (file && page) {
      if (base64) {
        letter.renderDocumentPageBase64(file, page, res);
      } else {
        letter.renderDocumentPage(file, page, res);
      }
    } else {
      res.send(JSON.stringify({result: "ERROR"}));
    }
  }

  /**
   * @api {get} /letter/document/rendering Gets an attachment stream
   * @apiName Rendering
   * @apiGroup Letter
   * @apiParam {String} file File Object Id
   * @apiParam {Number} page Page number
   */
  var documentRendering = function(req, res) {
    documentRenderingBase(false, req, res);
  }

  var documentRenderingBase64 = function(req, res) {
    documentRenderingBase(true, req, res);
  }

  /**
   * @api {post} /letter/reject Rejects an incoming letter
   * @apiName Reject
   * @apiGroup Letter
   * @apiParam {String} id Object Id of the letter
   * @apiSuccess {Object} status Status of the request
   * @apiSuccess {Boolean} status.ok "true" if success 
   * @apiError {Object} status Status of the request
   * @apiError {Boolean} status.ok "false" if success 
   */
  var rejectLetter = function(req, res) {
    letterWeb.reject(req, res);
  }

  /**
   * @api {get} /letter/sender-selection Gets sender candidates when composing a letter
   * @apiName SenderSelection
   * @apiGroup Letter
   * @apiSuccess {Object[]} result List of candidates
   * @apiSuccess {String} result.username Username of the candidate
   * @apiSuccess {Boolean} result.deputyActive Whether the candidate is a deputy
   * @apiSuccess {Object} result.profile Candidate profile
   */
  var senderSelection = function(req, res) {
    var myOrganization = req.session.currentUserProfile.organization;
    var vals = {};
    cUtils.populateSenderSelection(myOrganization, "", vals, req, res, function(vals) {
      res.send(vals.senderSelection);      
    });
  }

  var ResWrapperJSONParse = function(callback) {
    return {
      send: function(data) {
        callback(JSON.parse(data))
      }
    }
  };

  var orgSelection = function(req, res) {
    var r = ResWrapperJSONParse(function(data) {
      res.send(data);
    });
    
    orgWeb.list(req, r);
  }

  /**
   * @api {get} /letter/recipient-candidates-selection Gets recipient candidates when composing a letter
   * @apiName RecipientCandidatesSelection
   * @apiGroup Letter
   * @apiSuccess {Object[]} result List of candidates
   * @apiSuccess {String} result.username Username of the candidate
   * @apiSuccess {Boolean} result.deputyActive Whether the candidate is a deputy
   * @apiSuccess {Object} result.profile Candidate profile
   */
  var recipientCandidatesSelection = function(req, res) {
    var r = ResWrapperJSONParse(function(data) {
      res.send(data);
    });
    
    letterWeb.getRecipientCandidates(req, r);
  }

  /**
   * @api {get} /letter/cc-candidates-selection Gets cc candidates when composing a letter
   * @apiName CcCandidatesSelection
   * @apiGroup Letter
   * @apiSuccess {Object[]} result List of candidates
   * @apiSuccess {String} result.username Username of the candidate
   * @apiSuccess {Object} result.profile Candidate profile
   */
  var ccCandidatesSelection = function(req, res) {
    var r = ResWrapperJSONParse(function(data) {
      res.send(data);
    });
    
    letterWeb.getCcCandidates(req, r);
  }

  /**
   * @api {get} /letter/reviewer-candidates-selection Gets reviewer candidates when composing a letter
   * @apiName ReviewerCandidatesSelection
   * @apiGroup Letter
   * @apiSuccess {Object[]} result List of candidates
   * @apiSuccess {String} result.username Username of the candidate
   * @apiSuccess {Object} result.profile Candidate profile
   */
  var reviewerCandidatesSelection = function(req, res) {
    var r = ResWrapperJSONParse(function(data) {
      res.send(data);
    });
    
    letterWeb.getReviewerCandidates(req, r);
  }

  var sendLetter = function(req, res) {
    var vals = {
      jsonRequest: true
    };
    letterWeb.create({}, vals, "", letter.createNormal, req, res);
  }

  return {
    incoming : incoming
    , outgoing : outgoing
    , incomingAgenda : incomingAgenda
    , outgoingAgenda : outgoingAgenda
    , view: view
    , documentMetadata: documentMetadata
    , documentRendering: documentRendering
    , documentRenderingBase64: documentRenderingBase64
    , rejectLetter: rejectLetter
    , senderSelection: senderSelection 
    , orgSelection: orgSelection
    , recipientCandidatesSelection: recipientCandidatesSelection
    , ccCandidatesSelection: ccCandidatesSelection
    , reviewerCandidatesSelection: reviewerCandidatesSelection
    , sendLetter: sendLetter
    , extractData : extractData
  }
}
