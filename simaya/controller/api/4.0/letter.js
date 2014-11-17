module.exports = function(app){

  var letterAPI = require("../1.0/letter")(app);
  var letterWeb = require("../../letter.js")(app);
  var letter = require("../../../models/letter.js")(app);
  var cUtils = require("../../utils.js")(app)
  var orgWeb = require("../../organization.js")(app)

  function isValidObjectID(str) {
    str = str + '';
    var len = str.length, valid = false;
    if (len == 12 || len == 24) {
      valid = /^[0-9a-fA-F]+$/.test(str);
    }
    return valid;
  }

  // Wraps letter's res
  var ResWrapper = function(callback) {
    return {
      send: function(data) {
        callback(data)
      }
    }
  };

  var ResWrapperJSONParse = function(callback) {
    return {
      send: function(data) {
        callback(JSON.parse(data))
      }
    }
  };

 
  var list = function(search, req, res) {

    letterWeb.populateSearch(req, search, function(search) {

      letter.list(search, function(result){
        
        if (result == null) {

          var obj = {
            meta : {}
          }
          
          obj.meta.code = 404;
          obj.meta.errorMessage = "Letters Not Found";
          return res.send(obj.meta.code, obj);

        }
        
        letterAPI.extractData(result, req, res, function(result) {

          var obj = {
            meta : { code : 200 },
          }

          if (result == null) {
            obj.meta.code = 404;
            obj.meta.errorMessage = "Letters Not Found";
            return res.send(obj.meta.code, obj);
          }
          
          var data = result;

          var paginations = {
            current : { 
              count : data.length,
              limit : search.limit,  
              page : parseInt(search.page),
            }
          }

          if (search.page != 1) {
            paginations.previous = { page : search.page - 1};
          }

          if (result.length > 0) {

            if (result.length == search.limit) {

              // peek for next data
              search.page++;

              letter.list(search, function (nextResult) {
                
                if (nextResult && nextResult.length > 0) {
                  paginations.next = {
                    count : nextResult.length,
                    page : search.page
                  }
                }

                obj.data = data;
                obj.paginations = paginations;

                return res.send(obj);

              });
            } else {
              
              obj.data = data;
              obj.paginations = paginations;
              res.send(obj);
            } 
          } else {
            obj.data = data;
            obj.paginations = paginations;
            res.send(obj);
          } 

        });

      });
    });
  }

  /**
   * @api {get} /letters/incomings Incoming Letters
   * @apiVersion 4.0
   * @apiName GetIncomingLetters
   * @apiGroup Letters And Agendas
   * @apiPermission token
   *
   * @apiDescription Get incoming letters
   * 
   * @apiParam {String} access_token The access token
   * @apiParam {String} page The <code>page-th</code> of result group
   * @apiParam {String} limit The maximum number of letters per page
   *
   * @apiExample URL Structure:
   * // DEVELOPMENT
   * http://ayam.vps1.kodekreatif.co.id/api/2/letters/incomings
   * 
   * @apiExample Example usage:
   * curl http://ayam.vps1.kodekreatif.co.id/api/2/letters/incomings?access_token=f3fyGRRoKZ...
   */
  var incomings = function (req, res) {
    var search = letterWeb.buildSearchForIncoming(req, res);
    search = letterWeb.populateSortForIncoming(req, search);
    search.fields = { title : 1, date : 1, sender : 1, receivingOrganizations : 1, senderManual : 1, readStates : 1};
    search.page = req.query["page"] || 1;
    search.limit = 20;
    list(search, req, res);
  }

  /**
   * @api {get} /letters/outgoings Outgoing Letters
   * @apiVersion 4.0
   * @apiName GetOutgoingLetters
   * @apiGroup Letters And Agendas
   * @apiPermission token
   *
   * @apiDescription Get outgoing letters
   * 
   * @apiParam {String} access_token The access token
   * @apiParam {String} page The <code>page-th</code> of result group
   * @apiParam {String} limit The maximum number of letters per page
   *
   * @apiExample URL Structure:
   * // DEVELOPMENT
   * http://ayam.vps1.kodekreatif.co.id/api/2/letters/outgoings
   * 
   * @apiExample Example usage:
   * curl http://ayam.vps1.kodekreatif.co.id/api/2/letters/outgoings?access_token=f3fyGRRoKZ...
   */
  var outgoings = function (req, res) {
    var search = letterWeb.buildSearchForOutgoing(req, res); 
    search.fields = {title: 1, date: 1, sender: 1, receivingOrganizations: 1, senderManual: 1, readStates: 1};
    search.page = req.query["page"] || 1;
    search.limit = 20;
    list(search, req, res);
  }

  /**
   * @api {get} /letter/read/:id Read a letter or agenda
   * @apiVersion 4.0
   * @apiName GetReadLetter
   * @apiGroup Letters And Agendas
   * @apiPermission token
   *
   * @apiDescription Get outgoing agendas
   * 
   * @apiParam {String} access_token The access token
   * @apiParam {String} id The letter id
   *
   * @apiExample URL Structure:
   * // DEVELOPMENT
   * http://ayam.vps1.kodekreatif.co.id/api/2/letters/:id
   * 
   * @apiExample Example usage:
   * curl http://ayam.vps1.kodekreatif.co.id/api/2/letters/52ff37bc2b744cf14eacd2ab?access_token=f3fyGRRoKZ...
   */
  var read = function(req, res) {

    var id = req.params.id;

    if(!isValidObjectID(id)) {

      var obj = {
        meta : { code : 400, errorMessage : "Invalid Parameters"}
      }

      return res.send(meta.obj.code, obj);
    }

    
    var search = letterWeb.buildSearchForViewing(id, req, res); 

    letter.list(search, function(result){

      if (!result || result.length == 0) {
        
        var obj = {
          meta : { code : 404, errorMessage : "Letter Not Found"}
        }

        return res.send(obj.meta.code, obj);
      }

      letterAPI.extractData(result, req, res, function(result) {

        if (!result || result.length == 0) {
        
          var obj = {
            meta : { code : 404, errorMessage : "Letter Not Found"}
          }

          res.send(obj.meta.code, obj);
        }

        var obj = {
          meta : { code : 200 },
          data : result[0]
        }

        var me = req.session.currentUser;
        letter.setReadState(id, me);
        res.send(obj);

      });
    });

  }

  /**
   * @api {get} /agendas/incomings Incoming Agendas
   * @apiVersion 4.0
   * @apiName GetIncomingAgendas
   * @apiGroup Letters And Agendas
   * @apiPermission token
   *
   * @apiDescription Get incoming agendas
   * 
   * @apiParam {String} access_token The access token
   * @apiParam {String} page The <code>page-th</code> of result group
   * @apiParam {String} limit The maximum number of letters per page
   *
   * @apiExample URL Structure:
   * // DEVELOPMENT
   * http://ayam.vps1.kodekreatif.co.id/api/2/agendas/incomings
   * 
   * @apiExample Example usage:
   * curl http://ayam.vps1.kodekreatif.co.id/api/2/agendas/incomings?access_token=f3fyGRRoKZ...
   */
  var agendaIncomings = function (req, res){
    var options = {
      agenda: true,
      myOrganization: myOrganization
    };
    options.page = parseInt(req.query.page) || 1;
    options.limit = parseInt(req.query.limit) || 20;
    var sortOptions = req.query.sort || {};
    options.sort = {
      type: sortOptions["string"] || "",
      dir: parseInt(sortOptions["dir"]) || 0
    }
    console.log(JSON.stringify(req.query, null, "  "));
    if (req.query && req.query.search) {
      options.search = req.query.search;
    }
    var me = req.session.currentUser;
    var myOrganization = req.session.currentUserProfile.organization;

    options.fields = {title:1, date:1, sender: 1, receivingOrganizations: 1, senderManual:1, readStates: 1};

    letter.listIncomingLetter(me, options, function(err, result) {
      res.send(result);
    });
  }

  /**
   * @api {get} /agendas/outgoings Outgoing Agendas
   * @apiVersion 4.0
   * @apiName GetOutgoingAgendas
   * @apiGroup Letters And Agendas
   * @apiPermission token
   *
   * @apiDescription Get outgoing agendas
   * 
   * @apiParam {String} access_token The access token
   * @apiParam {String} page The <code>page-th</code> of result group
   * @apiParam {String} limit The maximum number of letters per page
   *
   * @apiExample URL Structure:
   * // DEVELOPMENT
   * http://ayam.vps1.kodekreatif.co.id/api/2/agendas/outgoings
   * 
   * @apiExample Example usage:
   * curl http://ayam.vps1.kodekreatif.co.id/api/2/agendas/outgoings?access_token=f3fyGRRoKZ...
   */
  var agendaOutgoings = function (req, res){
    var options = {
      agenda: true,
      myOrganization: myOrganization
    };
    options.page = parseInt(req.query.page) || 1;
    options.limit = parseInt(req.query.limit) || 20;
    var sortOptions = req.query.sort || {};
    options.sort = {
      type: sortOptions["string"] || "",
      dir: parseInt(sortOptions["dir"]) || 0
    }
    var me = req.session.currentUser;
    var myOrganization = req.session.currentUserProfile.organization;
    if (req.query && req.query.search) {
      options.search = req.query.search;
    }

    options.fields = {title:1, date:1, sender: 1, receivingOrganizations: 1, senderManual:1, readStates: 1, outgoingAgenda:1};

    letter.listOutgoingLetter(me, options, function(err, result) {
      res.send(result);
    });
  }

  var attachments = function (req, res) {
    var id = req.params.id;

    if(!isValidObjectID(id)) {

      var obj = {
        meta : { code : 400, errorMessage : "Invalid Parameters"}
      }

      return res.send(obj);
    }

    var search = letterWeb.buildSearchForViewing(id, req, res); 

    letter.list(search, function(result){

      if (!result || result.length == 0) {
        
        var obj = {
          meta : { code : 404, errorMessage : "Letter Not Found"}
        }

        return res.send(obj.meta.code, obj);
      }

      letterAPI.extractData(result, req, res, function(result) {

        if (!result || result.length == 0) {
        
          var obj = {
            meta : { code : 404, errorMessage : "Letter Not Found"}
          }

          res.send(obj.meta.code, obj);
        }

        var obj = {
          meta : { code : 200 },
          data : result[0].fileAttachments
        }

        var me = req.session.currentUser;
        letter.setReadState(id, me);
        res.send(obj);

      });
    });

  }

  var attachment = function (req, res) {
    // TODO: get attachment metadata, depends of its mime type
  }

  var attachmentStream = function (req, res) {
    // TODO: stream the attachment, depends on its mime type
  }

  /**
   * @api {get} /letters/new Send a new letter for inspection 
   * @apiVersion 4.0
   * @apiName SendNewLetter
   * @apiGroup Letters And Agendas
   * @apiPermission token
   *
   * @apiDescription Send a new letter for inspection
   * 
   * @apiParam {String} access_token The access token
   * @apiParam {Object} letter Letter information 
   * @apiParam {String} letter.sender Sender name
   * @apiParam {Date} letter.date Letter's date
   * @apiParam {String} letter.mailId Letter's id
   * @apiParam {String} letter.title Letter's title
   * @apiParam {Number} letter.priority Letter's priority
   * @apiParam {Number} letter.classification Letter's classification
   * @apiParam {String} letter.comments Notes about the letter
   * @apiParam {Number} letter.type Letter's type
   * @apiParam {String} letter.recipients Comma separated recipient's usernames
   * @apiParam {String} ccList Comma separated CC's usernames
   * @apiParam {String} reviewers Comma separated reviewers' usernames
   *
   * @apiSuccess {Object} result Result of the operation 
   * @apiSuccess {Number} result.code Code
   * @apiSuccess {Object} result.data Embedded data
   * @apiSuccess {Object} result.data.id Letter id if success 
   * @apiSuccess {Object} result.data Cause of error if error 
   * @apiExample URL Structure:
   * // DEVELOPMENT
   * http://ayam.vps1.kodekreatif.co.id/api/2/letters/new
   * 
   * @apiExample Example usage:
   * curl -d "letter%5Bsender%5D=presiden.ri&letter%5Brecipients%5D=ketua.mpr&letter%5Btitle%5D=Jajal+api&letter%5Bclassification%5D=1&letter%5Bpriority%5D=1&letter%5Btype%5D=2&letter%5Bdate%5D=2014-03-05T08%3A37%3A30.956Z" http://ayam.vps1.kodekreatif.co.id/api/2/letters/new?access_token=f3fyGRRoKZ...
   */
  var sendLetter = function(req, res) {
    var vals = {
      jsonRequest: true
    };
    var r = ResWrapper(function(data) {
      var obj = {
        meta: {
        }
      }
      console.log(data);
      if (data.status == "ERROR" || data.result == "ERROR") {
        obj.meta.code = 400;
        obj.meta.data = "Invalid parameters: " + data.data.error;
      } else if (data.status == "OK" || data.result == "OK") {
        obj.meta.code = 200;
        obj.data = data.data;
      } else {
        obj.meta.code = 500;
        obj.meta.data = "Server error";
      }

      res.send(obj.meta.code, obj);
    });
    letterWeb.create({}, vals, "", letter.createNormal, req, r);
  }

  /**
   * @api {get} /letters/sender-selection Get a sender candidates selection list 
   * @apiVersion 4.0
   * @apiName SenderSelection
   * @apiGroup Letters And Agendas
   * @apiPermission token
   *
   * @apiDescription Get a sender selection candidates list
   * 
   * @apiSuccess {Object[]} result List of candidates
   * @apiSuccess {String} result.username Username of the candidate
   * @apiSuccess {Boolean} result.deputyActive Whether the candidate is a deputy
   * @apiSuccess {Object} result.profile Candidate profile
   * 
   * @apiExample URL Structure:
   * // DEVELOPMENT
   * http://ayam.vps1.kodekreatif.co.id/api/2/letters/sender-selection
   * 
   * @apiExample Example usage:
   * curl http://ayam.vps1.kodekreatif.co.id/api/2/letters/sender-selection?access_token=f3fyGRRoKZ...
   */
  var senderSelection = function(req, res) {
    var myOrganization = req.session.currentUserProfile.organization;
    var vals = {};
    cUtils.populateSenderSelection(myOrganization, "", vals, req, res, function(vals) {
      if (vals) {
        var obj = {
          meta: {
            code: 200
          },
          data: vals.senderSelection
        }
        res.send(200, obj);
      } else {
        var obj = {
          meta: {
            code: 500,
            data: "Server error" 
          }
        }
        res.send(500, obj);
      }
    });

  }

  /**
   * @api {get} /letters/recipient-organization-selection Get a recipient candidates organization selection list 
   * @apiVersion 4.0
   * @apiName RecipientOrganizationSelection
   * @apiGroup Letters And Agendas
   * @apiPermission token
   *
   * @apiDescription Get a recipient organization candidates selection list
   * 
   * @apiParam {String} onlyFirstLevel If the value is set, only first level of the organization is returned 
   * @apiParam {String} prefix The organization prefix of a certain organization, usually set to the first level name obtained by setting onlyFirstLevel
   * @apiSuccess {Object[]} result List of candidates
   * @apiSuccess {String} result.username Username of the candidate
   * @apiSuccess {Boolean} result.deputyActive Whether the candidate is a deputy
   * @apiSuccess {Object} result.profile Candidate profile
   * 
   * @apiExample URL Structure:
   * // DEVELOPMENT
   * http://ayam.vps1.kodekreatif.co.id/api/2/letters/recipient-organization-selection
   * 
   * @apiExample Example usage:
   * curl http://ayam.vps1.kodekreatif.co.id/api/2/letters/recipient-organization-selection?access_token=f3fyGRRoKZ...
   */
  var orgSelection = function(req, res) {
    var r = ResWrapperJSONParse(function(vals) {
      if (vals) {
        var obj = {
          meta: {
            code: 200
          },
          data: vals
        }
        res.send(obj);
      } else {
        var obj = {
          meta: {
            code: 500,
            data: "Server error" 
          }
        }
        res.send(500, obj);
      }
    });
    
    orgWeb.list(req, r);
  }

  /**
   * @api {get} /letter/recipient-candidates-selection Gets recipient candidates when composing a letter
   * @apiName RecipientCandidatesSelection
   * @apiVersion 4.0
   * @apiGroup Letter And Agendas
   * @apiPermission token
   * @apiParam {String} org Organization of the candidates
   * @apiSuccess {Object[]} result List of candidates
   * @apiSuccess {String} result.username Username of the candidate
   * @apiSuccess {Boolean} result.deputyActive Whether the candidate is a deputy
   * @apiSuccess {Object} result.profile Candidate profile
   */
  var recipientCandidatesSelection = function(req, res) {
    var r = ResWrapperJSONParse(function(vals) {
      if (vals) {
        console.log(vals);
        var obj = {
          meta: {
            code: 200
          },
          data: vals
        }
        res.send(obj);
      } else {
        var obj = {
          meta: {
            code: 500,
            data: "Server error" 
          }
        }
        res.send(500, obj);
      }

    });
    
    letterWeb.getRecipientCandidates(req, r);
  }

  /**
   * @api {get} /letter/cc-candidates-selection Gets Cc candidates when composing a letter
   * @apiName CcCandidatesSelection
   * @apiVersion 4.0
   * @apiGroup Letter And Agendas
   * @apiPermission token
   * @apiParam {String} org Organization of the candidates
   * @apiSuccess {Object[]} result List of candidates
   * @apiSuccess {String} result.username Username of the candidate
   * @apiSuccess {Boolean} result.deputyActive Whether the candidate is a deputy
   * @apiSuccess {Object} result.profile Candidate profile
   */
  var ccCandidatesSelection = function(req, res) {
    var r = ResWrapperJSONParse(function(vals) {
      if (vals) {
        console.log(vals);
        var obj = {
          meta: {
            code: 200
          },
          data: vals
        }
        res.send(obj);
      } else {
        var obj = {
          meta: {
            code: 500,
            data: "Server error" 
          }
        }
        res.send(500, obj);
      }

    });
    
    letterWeb.getCcCandidates(req, r);
  }

  /**
   * @api {get} /letter/reviewer-candidates-selection Get reviewer candidates when composing a letter
   * @apiName ReviewerCandidatesSelection
   * @apiVersion 4.0
   * @apiGroup Letter And Agendas
   * @apiPermission token
   * @apiParam {String} org Organization of the candidates
   * @apiSuccess {Object[]} result List of candidates
   * @apiSuccess {String} result.username Username of the candidate
   * @apiSuccess {Object} result.profile Candidate profile
   */
  var reviewerCandidatesSelection = function(req, res) {
    var r = ResWrapperJSONParse(function(vals) {
      if (vals) {
        console.log(vals);
        var obj = {
          meta: {
            code: 200
          },
          data: vals
        }
        res.send(obj);
      } else {
        var obj = {
          meta: {
            code: 500,
            data: "Server error" 
          }
        }
        res.send(500, obj);
      }

    });
    
    letterWeb.getReviewerCandidates(req, r);
  }

  /**
   * @api {post} /letter/reject Rejects an incoming letter
   * @apiVersion 4.0
   * @apiName RejectLetter
   * @apiGroup Letter And Agendas
   * @apiParam {String} id Object Id of the letter
   * @apiSuccess {Object} status Status of the request
   * @apiSuccess {Boolean} status.ok "true" if success 
   * @apiError {Object} status Status of the request
   * @apiError {Boolean} status.ok "false" if success 
   */
  var rejectLetter = function(req, res) {
    var obj = {
      meta: {
      }
    }

    var r = ResWrapperJSONParse(function(data) {
      if (data.ok == true) {
        obj.meta.code = 200;
      } else {
        obj.meta.code = data.code;
      }
      console.log(data.code);
      res.send(obj);
    });
    letterWeb.reject(req, r);
  }

  /**
   * @api {post} /letter/:id/link Links a letter with others
   * @apiVersion 4.0
   * @apiName LinkLetter
   * @apiGroup Letter And Agendas
   * @apiParam {String} id Object Id of the letter
   * @apiParam {String[]} ids Object Ids of the letters to be linked
   * @apiSuccess {Object} status Status of the request
   * @apiSuccess {Boolean} status.ok "true" if success 
   * @apiError {Object} status Status of the request
   * @apiError {Boolean} status.ok "false" if success 
   */
  var linkLetter = function(req, res) {
    var id = req.params.id;
    var me = req.session.currentUser;
    var ids = req.body.ids;

    letter.link(me, id, ids, function(err, result) {
      if (err) {
        res.send(500, {
          status: {
            ok: false
          }
        })
      } else {
        res.send(200, {
          status: {
            ok: true
          }
        })
      }
    });
  }




  return {
    incomings : incomings,
    outgoings : outgoings,
    read : read,
    sendLetter: sendLetter,

    attachments : attachments,
    attachment : attachment,
    attachmentStream : attachmentStream,

    agendaIncomings : agendaIncomings,
    agendaOutgoings : agendaOutgoings,

    senderSelection : senderSelection,
    orgSelection : orgSelection,
    recipientCandidatesSelection : recipientCandidatesSelection,
    ccCandidatesSelection : ccCandidatesSelection,
    reviewerCandidatesSelection : reviewerCandidatesSelection,
    rejectLetter : rejectLetter,

    linkLetter: linkLetter
  }
}
