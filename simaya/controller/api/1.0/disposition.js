module.exports = function(app){
  var utils = require("../../../../sinergis/controller/utils.js")(app)
  var user = require("../../../../sinergis/models/user.js")(app)
  var moment = require("moment")
  var ObjectID = app.ObjectID;
  var dispositionWeb = require("../../disposition.js")(app)
  var disposition = require("../../../models/disposition.js")(app)
  var notification = require('../../../models/notification.js')(app)
  var letterUtils = require("../../../models/utils.js")(app)

  var getRecipientCandidates = function(req, res) {
    dispositionWeb.getRecipientCandidates(req, res);
  }

  var create = function(req, res) {
    if (req.body.id &&
        req.body.recipients &&
        req.body.date &&
        req.body.instruction &&
        req.body.security &&
        req.body.priority &&
        req.body.description) {

      var recipients = [];
      for (var i = 0; i < req.body.recipients.length; i++) {
        var r = {
          message: req.body.description,
          recipient: req.body.recipients[i],
          date: new Date(req.body.date),
          instruction: req.body.instruction,
          security: req.body.security,
          priority: req.body.priority,
        }
        recipients.push(r);
      }

      var data = {
        date: new Date(),
        letterId: req.body.id,
        inReplyTo: req.body.dispositionId,
        sender: req.session.currentUser,
        letterTitle: req.body.letterTitle,
        letterMailId: req.body.letterNumber,
        letterDate: req.body.letterDate,
        recipients: recipients,
      }

      disposition.create(data, function(e, v) {
        req.body.recipients.forEach(function(item) {
          notification.set(item, 'Ada disposisi perihal ' + req.body.letterTitle, '/disposition/read/' + v._id);
        });
        res.send(JSON.stringify({result: "OK"}));
      });
    } else {
      res.send(JSON.stringify({result: "ERROR"}));
    }
  }
  
  var outgoing = function(req, res) {
    var me = req.session.currentUser;
    var search = {
      search: {
        sender: me, 
      },
      limit: 30,
      page: (req.query["page"] || 1) 
    }
    listBase(search, req, res);
  }


  var incoming = function(req, res) {
    var me = req.session.currentUser;
    var search = {
      search: {
        "recipients.recipient": me, 
      },
      limit: 30,
      page: (req.query["page"] || 1) 
    }
    listBase(search, req, res);
  }

  var listBase = function(search, req, res) {
    var me = req.session.currentUser;
    if (req.query.search && req.query.search.string) {
      search.search["$or"] = dispositionWeb.populateSearch(req.query.search.string);
    }
    disposition.list(search, function(r) {
      var recipientHash = {};
      r.forEach(function(e, i) {
        var d = moment(e.letterDate);
        if (d) {
          r[i].formattedDate = d.format('DD/MM/YYYY');
        }
        recipientHash[r[i].sender] = 1;
        if (r[i].letterDate) {
          r[i].letterDate = moment(r[i].letterDate).format("DD/MM/YYYY");
        }
        for (var j = 0; j < r[i].recipients.length; j++) {
          recipientHash[r[i].recipients[j].recipient] = 1;
          r[i].recipients[j]['priority' + r[i].recipients[j].priority] = true;
          r[i].recipients[j]['security' + r[i].recipients[j].security] = true;

          // For incoming
          if (r[i].recipients[j].recipient == me) {
            r[i].completionDate = moment(r[i].recipients[j].date).format("DD/MM/YYYY");
            r[i].priority = r[i].recipients[j].priority;
            r[i].security = r[i].recipients[j].security;
            if (r[i].recipients[j].readDate) {
              r[i].readDate = true;
            }
            if (r[i].recipients[j].followedUpDate) {
              r[i].followedUpDate = true;
            }
            if (r[i].recipients[j].declinedDate) {
              r[i].declinedDate = true;
            }
          }
        }
      });

      letterUtils.resolveUsers(Object.keys(recipientHash), function(resolved) {
        var resolvedHash = {};
        resolved.forEach(function(e, i) {
          var key = resolved[i].username;
          resolvedHash[key] = resolved[i];
        });

        r.forEach(function(e, i) {
          for (var j = 0; j < r[i].recipients.length; j++) {
            var resolvedRecipient = resolvedHash[r[i].recipients[j].recipient]; 
            if (resolvedRecipient) {
              r[i].recipients[j].recipientResolved = resolvedRecipient.name;
            }
          }
        });


        var data = {
          status: 0,
          data: r,
          next: (r== null) ? "" : (parseInt(search.page) + 1),
          prev: ""
        }
        res.send(data);
      });
    });
  }

  var decline = function(req, res) {
    dispositionWeb.decline(req, res);
  }

  var addComments = function(req, res) {
    dispositionWeb.addComments(req, res);
  }

  var markAsRead = function(req, res) {
    var me = req.session.currentUser;
    disposition.markAsRead(req.body.id, me, function(modified) {
      res.send({result:"OK"});
    })
  }

  var getInfo = function(req, res) {
    if (req.query.id) {
      disposition.list({search: {_id: app.ObjectID(req.query.id + "")}}, function(result) {
        res.send({result:result});
      });
    } else {
      res.send({result:"ERROR"});
    }
  }



  return {
    getRecipientCandidates: getRecipientCandidates
    , create: create
    , outgoing: outgoing
    , incoming: incoming 
    , decline: decline 
    , addComments: addComments 
    , markAsRead: markAsRead
    , getInfo: getInfo
  }
}
