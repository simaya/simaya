if (typeof(Disposition) === "undefined") {
Disposition = module.exports = function(app) {
  var disposition = require('../models/disposition.js')(app)
    , letter = require('../models/letter.js')(app)
    , utils = require('../../sinergis/controller/utils.js')(app)
    , cUtils = require('../../simaya/controller/utils.js')(app)
    , mUtils = require('../../simaya/models/utils.js')(app)
    , session = require('../../sinergis/models/session.js')(app)
    , sinergisVar = app.get('sinergisVar')
    , notification = require('../models/notification.js')(app)
    , ObjectID = app.ObjectID
    , user = require('../../sinergis/models/user.js')(app)
    , moment= require('moment')
    , _ = require("lodash");
  
  var letterController = null;
  if (typeof(Letter) === "undefined") {
    letterController = require('./letter.js')(app)
  } else {
    letterController = Letter(app)
  }
  
  var index = function(req, res) {
    var vals = {
      title: sinergisVar.appName,
    }
   
    utils.render(req, res, 'index', vals, 'base-authenticated');
  }
  
  var create = function(req, res) {
    var vals = {
      title: 'Buat Disposisi',  
    }

    var breadcrumb = [
      {text: 'Disposisi', link: '/dispositions'},
      {text: 'Buat Baru', isActive: true}
    ];
    vals.breadcrumb = breadcrumb;
    var me = req.session.currentUser;
    var myOrganization = req.session.currentUserProfile.organization;

    if (req.params.id !== null) {
      if (typeof(req.body.disposition) !== "undefined") {
        var recipients = [];
        if (typeof(req.body.disposition.recipient) === "string" && req.body.disposition.recipient.indexOf(",") < 0) {
          var r = {
            message: req.body.disposition.message,
            recipient: req.body.disposition.recipient,
            date: req.body.disposition.date || new Date(),
            instruction: req.body.disposition.instruction,
            security: req.body.disposition.security,
            priority: req.body.disposition.priority,
          }
          recipients.push(r);
        } else {
          var postedRecipients = req.body.disposition.recipient;
          if (typeof(req.body.disposition.recipient) === "string" && req.body.disposition.recipient.indexOf(",") > 0) {
            postedRecipients = req.body.disposition.recipient.split(",");
          }
          for (var i = 0; i < postedRecipients.length; i++) {
            var r = {
              message: req.body.disposition.message,
              recipient: postedRecipients[i],
              date: req.body.disposition.date || new Date(),
              instruction: req.body.disposition.instruction,
              security: req.body.disposition.security,
              priority: req.body.disposition.priority,
            }
            if (r.recipient) {
              recipients.push(r);
            }
          }

        }

        var data = {
          date: new Date(),
          letterId: req.params.id,
          inReplyTo: req.body.disposition.dispositionId,
          sender: req.session.currentUser,
          letterTitle: req.body.disposition.letterTitle,
          letterMailId: req.body.disposition.letterMailId,
          letterDate: new Date(req.body.disposition.letterDate),
          recipients: recipients,
        }
        
        var shareDisposition = function(id, cb) {
          var superiors = req.body["cc-superiors"];
          if (superiors && _.isString(superiors)) {
            superiors = [ superiors ];
          }
          if (superiors && superiors.length > 0) { 
            var message = "Disposisi untuk bawahan Anda"; 
            disposition.share(id, me, superiors, message, cb);
          } else {
            cb(null);
          }
        }

        disposition.create(data, function(e, v) {
          if (v.hasErrors() == false) {
            vals.successful = true;
            if (typeof(req.body.disposition.recipient) === "string") {
              notification.set(req.session.currentUser, req.body.disposition.recipient, 'Ada disposisi perihal ' + req.body.disposition.letterTitle, '/disposition/read/' + v._id);
            } else {
              req.body.disposition.recipient.forEach(function(item) {
                notification.set(req.session.currentUser, item, 'Ada disposisi perihal ' + req.body.disposition.letterTitle, '/disposition/read/' + v._id);
              });
            }
            // Update disposition state
            letter.list({search: { _id: ObjectID(req.params.id) }},
              function(result) {
                if (result != null && result.length == 1) {
                  var data = {
                    log: [ {
                      date: new Date(),
                      username: req.session.currentUser, 
                      action: "disposition",
                      message: v._id
                    }]
                  }
                  data.receivingOrganizations = result[0].receivingOrganizations;
                  if (data.receivingOrganizations[myOrganization]) {
                    // we save the first disposition 
                    // otherwise just keep the log
                    if (!data.receivingOrganizations[myOrganization].firstDisposition) {
                    data.receivingOrganizations[myOrganization].firstDisposition = v._id;
                    }

                    letter.edit(req.params.id, data, function() {
                      shareDisposition(v._id, function(err) {
                        console.log(err);
                        utils.render(req, res, 'disposition-create', vals, 'base-authenticated');
                      });
                    });
                  } else {
                    utils.render(req, res, 'disposition-create', vals, 'base-authenticated');
                  }
                } else {
                  // Should not go here
                  utils.render(req, res, 'disposition-create', vals, 'base-authenticated');
                }
              });
          } else {
            vals.unsuccessful = true;
            
            if (v.errors.Data !== "undefined") {
              vals.error = v.errors.Data;  
            }
            
            utils.render(req, res, 'disposition-create', vals, 'base-authenticated');
          }
        });
      } else {
        if (req.query.letterId && req.query.letterId.length == 24) {
          var search = {
            search: {
              _id: ObjectID(req.query.letterId)
            }
          }
        
          letter.list(search, function(result){
            // Make sure just one element in result array
            if (result.length == 1) {
              vals.letter = result[0];
              vals.letterId = result[0]._id;
              vals.priorities = {};
              vals.priorities['p'+result[0].priority] = true;
              vals.classifications = {};
              vals.classifications['c'+result[0].classification] = true;
              vals['type'+parseInt(result[0].type)] = true;

              if (req.query.reply) {
                vals.dispositionId = req.query.reply;
              }
              
              if (req.query.to) {
                vals.replyTo = req.query.to;
              }
              
              var search = {
                search: {
                  _id: ObjectID(req.query.reference)
                }
              }
              vals.reference = null;
              disposition.list(search, function(result) {
                if (result.length == 1) {
                  vals.allowDisposition = false;
                  vals.dispositions = result[0];
                
                  vals.recipientList = [];
                  vals.dispositionRecipients = [];
                  for (var i = 0; i < result[0].recipients.length; i ++) {
                    vals.dispositionRecipients.push(result[0].recipients[i].recipient);
                    if (result[0].recipients[i].recipient == req.session.currentUser) {
                      vals.reference = {
                        date: result[0].recipients[i].date,
                        priority: result[0].recipients[i].priority,
                        security: result[0].recipients[i].security
                      }
                      vals.reference['priorities' + vals.reference.priority] = true; 
                      vals.reference['securities' + vals.reference.security] = true; 
                      if (result[0].recipients[i].date) {
                        vals.reference.formattedDate = moment(result[0].recipients[i].date).format('dddd, DD MMMM YYYY');
                      }
                    }
                  }
                }
                utils.render(req, res, 'disposition-create', vals, 'base-authenticated');
              });
         
            } else {
              // Redirect to disposition list
              vals.unsuccessful = true;
              vals.error = 'Create new disposition failed, not valid letter.';
                  
              res.redirect('/dispositions');
            }
          });
        } else {
          // Redirect to disposition list
          vals.unsuccessful = true;
          vals.error = 'Create new disposition failed, not valid letter.';
              
          res.redirect('/dispositions');
        }
      }
    }
  }
  
  var downloadAttachment = function(req, res) {
    var vals = {};

    if (req.params.id) {
      disposition.downloadAttachment({
        protocol: req.protocol,
        host: req.host,
        username: req.session.currentUser,
        id: req.params.id,
        stream: res
      }, function() {
        res.end();
      });
    } else {
      res.send(500);
    }
  }


  var view = function(req, res) {
    var vals = {
      username: req.session.currentUser,
    };
    var me = req.session.currentUser;

    var breadcrumb = [
      {text: 'Disposisi', link: '/dispositions'},
      {text: 'Lihat', isActive: true}
    ];
    vals.breadcrumb = breadcrumb;
    
    if (req.params.id != null && req.params.id.length == 24) {
      var search = {
        search: {
          '_id': ObjectID(req.params.id),
          $or: [
            {'recipients.recipient': req.session.currentUser},
            {'sharedRecipients.recipient': req.session.currentUser},
            {sender: req.session.currentUser},
            ],
        }
      }
      
      var markAsRead = false;
      disposition.list(search, function(result) {
        if (result.length == 1) {
          vals.allowDisposition = false;
          vals.dispositions = result[0];
        
          vals.recipientList = [];
          vals.dispositions.formattedDate = moment(result[0].date).format('dddd, DD MMMM YYYY');

          // Handle old data
          if (vals.dispositions.formattedDate.indexOf("undefined") == 0) {
            vals.dispositions.formattedDate = result[0].date
          }

          var isRecipient = false;
          for (var i = 0; i < result[0].recipients.length; i ++) {
            if (result[0].recipients[i].date) {
              result[0].recipients[i].formattedDate = moment(result[0].recipients[i].date).format('dddd, DD MMMM YYYY');
            }
            if (result[0].recipients[i].readDate) {
              var f = moment(result[0].recipients[i].readDate).format('dddd, DD MMMM YYYY HH:mm');
              if (f.indexOf("undefined") == 0 // unable to convert 
                || result[0].recipients[i].readDate.length == 16) { // or already formatted
                f = result[0].recipients[i].readDate
              }
              result[0].recipients[i].formattedReadDate = f 
            }
            if (result[0].recipients[i].declinedDate) {
              var f = moment(result[0].recipients[i].declinedDate).format('dddd, DD MMMM YYYY HH:mm');
              if (f.indexOf("undefined") == 0 // unable to convert 
                || result[0].recipients[i].declinedDate.length == 16) { // or already formatted
                f = result[0].recipients[i].declinedDate
              }
              result[0].recipients[i].formattedDeclinedDate = f 
            }
 
            if (result[0].recipients[i].followedUpDate) {
              var f = moment(result[0].recipients[i].followedUpDate).format('dddd, DD MMMM YYYY HH:mm');
              if (f.indexOf("undefined") == 0 // unable to convert 
                || result[0].recipients[i].followedUpDate.length == 16) { // or already formatted
                f = result[0].recipients[i].followedUpDate
              }
              result[0].recipients[i].formattedFollowedUpDate = f 
            }
            
            if (result[0].recipients[i].recipient == req.session.currentUser) {
              if (typeof(result[0].recipients[i].readDate) === "undefined") {
                markAsRead = true;
              }
              if (typeof(result[0].recipients[i].followedUpDate) === "undefined" && typeof(result[0].recipients[i].declinedDate) === "undefined") {
                vals.allowDecline = true;
              }
              isRecipient = true;
            }

            result[0].recipients[i]['instruction' + result[0].recipients[i].instruction] = true;
            result[0].recipients[i]['priority' + result[0].recipients[i].priority] = true;
            result[0].recipients[i]['security' + result[0].recipients[i].security] = true;
            if (result[0].recipients[i].recipient == req.session.currentUser) {
              vals.allowDisposition = true;
              vals.allowCreateLetter = true;
            }
            vals.recipientList.push(result[0].recipients[i]);
          }

          if (isRecipient) {
            vals.isRecipient = true;
            vals.isIncoming = true;
            vals.isOutgoing = false
          } else {
            vals.isIncoming = false;
            vals.isOutgoing = true;
          }

          vals.sender = result[0].sender;
          vals.dispositionId = req.params.id;
          vals._id = result[0]._id;
          if (result[0].sender == req.session.currentUser) {
              vals.recipientList = result[0].recipients;
          }

          letter.openLetter(result[0].letterId, me, {}, function(err, r) {
            vals.letter = r;
            if (r != null && r.length == 1) {
              vals.letterId = r[0]._id;
              if (r[0].creation == 'normal') {
                vals.canViewLetter = true;
              }
              vals.letter.formattedDate = moment(r[0].date).format('dddd, DD MMMM YYYY');
              var receivedDate = moment(r[0].receivedDate);
              if (receivedDate) {
                vals.letter.formattedReceivedDate = receivedDate.format('dddd, DD MMMM YYYY');
              }
              vals.priorities = {};
              vals.priorities['p'+r[0].priority] = true;
              vals.classifications = {};
              vals.classifications['c'+r[0].classification] = true;

              
              var organization = "";
              if (req.session.currentUserProfile &&
                  req.session.currentUserProfile.organization) {
                organization = req.session.currentUserProfile.organization;
              }
              if (typeof(r[0].receivingOrganizations) === "object" && 
                  typeof(r[0].receivingOrganizations[organization]) === "object") {

                vals.incomingAgendaNumber = r[0].receivingOrganizations[organization].agenda; 
                vals.readDate = r[0].receivingOrganizations[organization].date; 
              }
              // exclude staff to give disposition
              if (vals.allowDisposition) {
                if (req.session.currentUserProfile.echelon == "5a") {
                  vals.allowNewDisposition = false;
                } else {
                  vals.allowNewDisposition = true;
                };
              }
              if (result[0].comments) {
                result[0].comments.forEach(function(e) {
                  e.formattedDate = moment(e.date).format('dddd, DD MMMM YYYY HH:mm');
                });
                vals.comments = result[0].comments;
              }

              if (markAsRead) {
                disposition.markAsRead(vals._id, req.session.currentUser, function(modified) {
                  utils.render(req, res, 'disposition-view', vals, 'base-authenticated');
                });
              } else {
                utils.render(req, res, 'disposition-view', vals, 'base-authenticated');

              }
            } else {
              res.redirect('/dispositions');
            }
          });
        } else {
          res.redirect('/dispositions');
        }
      });
    }
  }
  
  var populateSearch = function(searchStrings) {
    var searchObj = 
      [
        {
          "letterTitle": { $regex : searchStrings, $options: "i" }
        }
        , {
          "letterMailId": { $regex : searchStrings, $options: "i" }
        }
        , {
          "recipients.message": { $regex : searchStrings, $options: "i" }
        }
        , {
          "sender": { $regex : searchStrings, $options: "i" }
        }

      ]

    var trimmed = searchStrings.trim();
    if (trimmed.length == 10 && 
        trimmed.indexOf("/") == 2 &&
        trimmed.lastIndexOf("/") == 5) {
      // probably a date
      var d = trimmed.split("/");
      var date = parseInt(d[0]);
      var month = parseInt(d[1]);
      var year = parseInt(d[2]);
      var start = new Date(Date.UTC(year, month - 1, date, 0, 0, 0));
      var end = new Date(Date.UTC(year, month - 1, date, 23, 59, 59));
      searchObj.push({
        "letterDate" : {
          $gte: start,
          $lt: end
        }
      });
    }

    return searchObj;
  }
 
  var list = function(req, res) {
    return listBase(req, res);
  }

  var listBase = function(req, res, x, embed) {
    var vals = {};

    var breadcrumb = [
      {text: 'Surat Masuk', link: '/incoming'},
      {text: 'Disposisi Masuk', isActive: true}
    ];
    vals.breadcrumb = breadcrumb;

    
    session.getUser(req.session.authId, function(username) {
      var search = {
        search: {
          'recipients.recipient': username
        }
      }
     
      if (req.query.search && req.query.search.string) {
        vals.searchKey = req.query.search.string;
        search.search["$or"] = populateSearch(req.query.search.string);
      }else{
        vals.searchKey ="";
      }
      var page = req.query.page || 1;
      if (embed) {
        page = 1;
      }
      search.fields = {_id: 1};
      disposition.list(search, function(result) {
        search.page = page;
        search.limit = 10;
        delete(search.fields);
          
        var pages = cUtils.getPages(page, 10, result.length);
        vals.dispPages = pages;
        search.page = page;
        disposition.list(search, function(result) {
          result.forEach(function(e, i) {
            var f = moment(e.date).format('dddd, DD MMMM YYYY');
            if (f.indexOf("undefined") == 0) {
              f = e.date;
            }
            result[i].formattedDate = f 

            for (var j = 0; j < result[i].recipients.length; j++) {
              if (result[i].recipients[j]['recipient'] == req.session.currentUser) {
                if (result[i].recipients[j].date) {
                  result[i].completionDate = moment(result[i].recipients[j].date).format('dddd, DD MMMM YYYY');
                }
                result[i]['priority' + result[i].recipients[j].priority] = true;
                result[i]['security' + result[i].recipients[j].security] = true;
              }
            }
          });
          vals.dispositions = result;
          if (result) {
            for (var i = 0; i < result.length; i ++) {
              if (result[i].recipients) {
                for (var j = 0; j < result[i].recipients.length; j ++) {

                  if (result[i].recipients[j].recipient == req.session.currentUser) {

                    if (result[i].recipients[j].readDate) {
                      result[i].readDate = true;
                    }
                    if (result[i].recipients[j].followedUpDate) {
                      result[i].followedUpDate = true;
                    }
                    if (result[i].recipients[j].declinedDate) {
                      result[i].declinedDate = true;
                    }
                    break;
                  }
                }
              }
            }
          }
          if (embed) {
            embed(req, res, vals);
          } else {
            letterController.listIncomingBase(req, res, x, function(req, res, output) {
              vals.letterList = output;
              utils.render(req, res, 'disposition-list', vals, 'base-authenticated');
            })
          }
        });
      });
    });
  }
  
  var listOutgoing = function(req, res) {
    return listOutgoingBase(req, res);
  }

  var listCc = function(req, res) {
    var vals = {};

    var breadcrumb = [
      {text: 'Disposisi Tembusan', link: '/dispositions/cc'},
    ];
    vals.breadcrumb = breadcrumb;
  
    session.getUser(req.session.authId, function(username) {
      var search = {
        search: {
          'sharedRecipients.recipient': { 
            $in: [ username ]
          }
        }
      }
      
      if (req.query.search && req.query.search.string) {
        search.search["$or"] = populateSearch(req.query.search.string);
      }
      disposition.list(search, function(result) {
        search.limit = 10;
          
        var page = req.query.page || 1;
        var length = 0;
        if (result && result.length) length = result.length;
        var pages = cUtils.getPages(page, 10, length);
        vals.dispPages = pages;
        
        search.page = page;
        disposition.list(search, function(r) {
          if (r) {
            r.forEach(function(e, i) {
              var d = moment(e.date);
              if (d) {
                r[i].formattedDate = d.format('DD/MM/YYYY');
              }
              for (var j = 0; j < r[i].recipients.length; j++) {
                r[i].recipients[j]['priority' + r[i].recipients[j].priority] = true;
                r[i].recipients[j]['security' + r[i].recipients[j].security] = true;
              }
            });
          }
          vals.dispositions = r;
          utils.render(req, res, 'disposition-list-cc', vals, 'base-authenticated');
        });
      });
    });
  }


  var listOutgoingBase = function(req, res, x, embed) {
    var vals = {};

    var breadcrumb = [
      {text: 'Surat Keluar', link: '/outgoing'},
      {text: 'Disposisi Keluar', isActive: true}
    ];
    vals.breadcrumb = breadcrumb;
  
    session.getUser(req.session.authId, function(username) {
      var search = {
        search: {
          'sender': username
        }
      }
      
      if (req.query.search && req.query.search.string) {
        search.search["$or"] = populateSearch(req.query.search.string);
      }
      disposition.list(search, function(result) {
        search.limit = 10;
          
        var page = req.query.page || 1;
        if (embed) {
          page = 1;
        }
        var pages = cUtils.getPages(page, 10, result.length);
        vals.dispPages = pages;
        
        search.page = page;
        disposition.list(search, function(r) {
          r.forEach(function(e, i) {
            var d = moment(e.date);
            if (d) {
              r[i].formattedDate = d.format('DD/MM/YYYY');
            }
            for (var j = 0; j < r[i].recipients.length; j++) {
              r[i].recipients[j]['priority' + r[i].recipients[j].priority] = true;
              r[i].recipients[j]['security' + r[i].recipients[j].security] = true;
            }
          });
          vals.dispositions = r;
          if (embed) {
            embed(req, res, vals);
          } else {
            letterController.listOutgoingBase(req, res, x, function(req, res, output){
              vals.letterList = output; 
              utils.render(req, res, 'disposition-list-outgoing', vals, 'base-authenticated');
            });
          }
        });
      });
    });
  }

  // Gets user list
  var getUserList = function(search, req, res) {
    user.list(search, function(r) {
      if (r == null) {
        r = [];
      }

      var added = [];
      if (req.query && req.query.added) {
        added = req.query.added
      }
      added.push(req.session.currentUser)

      var copy = cUtils.stripCopy(r, added);
      res.send(JSON.stringify(copy));
    });
  }

  // Gets the Recipient candidates
  var getShareRecipient = function(req, res) {
    var myOrganization = req.session.currentUserProfile.organization;
    var org = myOrganization.split(";")[0];
    var search = {
      search: {
          // people with administration role
          'profile.organization': { $regex: '^' + org} , // can span across orgs 
      },
    }

    if (req.query && req.query.letterId) {
      disposition.list({search: {letterId: req.query.letterId}}, function(result) {
        var recipients = [];
        if (result != null) {
          _.each(result, function(d) {
            _.each(d.recipients, function(r) {
              recipients.push(r.recipient);
            });
            _.each(d.sharedRecipients, function(r) {
              recipients.push(r.recipient);
            });
          });
          req.query.added = recipients;
        } 
        getUserList(search, req, res);
      });
    } else {
      getUserList(search, req, res);
    }
  }
  // Gets the Recipient candidates
  var getRecipient = function(req, res) {
    var find = function(exclude) {
      var me = req.session.currentUser;
      var org = req.session.currentUserProfile.organization;

      exclude.push(me);
      disposition.candidates(exclude, org, function(err, data) {
        if (err) {
          res.send(400);
        } else {
          res.send(data);
        }
      });
    };

    if (req.query && req.query.letterId) {
      disposition.list({search: {letterId: req.query.letterId}}, function(result) {
        var recipients = [];
        if (result != null) {
          for (var i = 0; i < result.length; i++) {
            for (var j = 0; j < result[i].recipients.length; j++) {
              recipients.push (result[i].recipients[j].recipient);
            }
          }
        } 
        find(recipients);
      });
    } else {
      find([]);
    }
  }
 
  var decline = function(req, res) {
    if (req.body && req.body.dispositionId && req.body.message) {
      var search = {
        search: {
          _id: ObjectID(req.body.dispositionId),
        }
      }
      disposition.list(search, function(result) { 
        if (result != null && result.length == 1) {
          disposition.markAsDeclined(ObjectID(req.body.dispositionId), req.session.currentUser, req.body.message, function(ok) {
            if (ok) {
              notification.set(req.session.currentUser, result[0].sender, req.session.currentUserProfile.fullName + ' menolak disposisi dari Anda.', '/disposition/read/' + req.body.dispositionId + "#recipient-" + req.session.currentUser);
              res.send(JSON.stringify({result: "OK"}));
            } else {
              res.send(JSON.stringify({result: "ERROR"}));
            }
          });
        } else {
          res.send(JSON.stringify({result: "ERROR"}));
        }
      });

    } else {
      res.send(JSON.stringify({result: "ERROR"}));
    }
  }

  var sendNotificationComments = function(currentUser, recipients, index, comment, url, callback) {
    if (typeof(recipients[index]) === "undefined") {
      callback();
      return;
    }
    if (currentUser != recipients[index].recipient) {
      notification.set(currentUser, recipients[index].recipient, comment, url, function() {
        sendNotificationComments(currentUser, recipients, index + 1, comment, url, callback); 
      })
    } else {
      sendNotificationComments(currentUser, recipients, index + 1, comment, url, callback); 
    }
  }

  var addComments = function(req, res) {
    if (req.body && req.body.dispositionId && req.body.message) {
      var search = {
        search: {
          _id: ObjectID(req.body.dispositionId),
        }
      }
      disposition.list(search, function(result) { 
        if (result != null && result.length == 1) {
          disposition.addComments(ObjectID(req.body.dispositionId), req.session.currentUser, req.body.message, req.body.attachments, function(id) {
            if (id) {
              var message = req.session.currentUserProfile.fullName + ' mengomentari disposisi Anda.'
              sendNotificationComments(req.session.currentUser, result[0].recipients, 0, message, "/disposition/read/" + req.body.dispositionId + "#comments-" + id, function() {
                if (req.session.currentUser != result[0].sender) {
                  notification.set(req.session.currentUser, result[0].sender, message, "/disposition/read/" + req.body.dispositionId + "#comments-" + id, function() {
                    res.send(JSON.stringify({result: "OK"}));
                  })
                } else {
                  res.send(JSON.stringify({result: "OK"}));
                }
              })
            } else {
              res.send(JSON.stringify({result: "ERROR"}));
            }
          });
        } else {
          res.send(JSON.stringify({result: "ERROR"}));
        }
      });

    } else {
      res.send(JSON.stringify({result: "ERROR"}));
    }
  }

  var isReDispositioned = function(req, res) {
    if (req.query && req.query.letterId) {
      var search = {
        search: {
          letterId: req.query.letterId,
          sender: req.session.currentUser,
        }
      }
      disposition.list(search, function(result) { 
        if (result != null && result.length == 1) {
          res.send({ result: true });
        } else {
          res.send({ result: false });
        }
      });
    } else {
      res.send(400, { status: "ERROR" });
    }
  }

  var share = function(req, res) {
    var id = req.body.id;
    var sender = req.session.currentUser;
    var recipients = req.body.recipients.split(",");
    var message = req.body.message;
    disposition.share(id, sender, recipients, message, function(err, data) {
      if (err) {
        res.send(400, data);
      } else {
        res.send(data);
      }
    });
  }
 
  var findSuperiors = function(req, res) {
    var people = req.query.people;
    var me = req.session.currentUser;

    if (_.isString(people) && people.indexOf(",") > 0) {
      people = people.split(",");
    } else if (_.isString(people) && people.length > 0) {
      people = [ people ];
    } else {
      return res.send(400);
    }
    var user = app.db("user");
    var org = app.db("organization");

    // Get all heads from the specified orgs
    // except myself
    var findHeads = function(orgs, cb) {
      org.findArray({path: {$in: orgs}}, function(err, result) {
        if (err) return cb(err);
        var heads = [];
        _.each(result, function(item) {
          if (item.head && item.head != me) heads.push(item.head);
        });
        cb(null, heads);
      });
    }

    // Get all people's information
    var findPeople = function(people, cb) {
      user.findArray({username: { $in: people }}, { username:1, profile: 1}, function(err, result) {
        if (err) return cb(err);
        cb(null, result);
      });
    };

    // Get the subordinates' info
    findPeople(people, function(err, subordinates) {
      if (err) return res.send(500, err.message);
      var orgs = [];
      _.each(subordinates, function(item) {
        if (item && item.profile.organization) {
          orgs.push(item.profile.organization);
        }
      });
      // get the heads
      findHeads(orgs, function(err, foundHeads) {
        if (err) return res.send(500, err.message);
        var removedHeads = _.intersection(people, foundHeads);
        var heads = _.difference(foundHeads, removedHeads);
        // get the heads' info
        findPeople(heads, function(err, result) {
          if (err) return res.send(500, err.message);
          return res.send(result);
        });
      });
    });
  }

  var uploadAttachment = function(req, res){
    var id = req.body._id;

    var files = req.files.files;

    if (files && files.length > 0) {

      var file = files[0];
      var metadata = {
        path : file.path,
        name : file.name,
        type : file.type
      };

      // uploads file to gridstore
      disposition.saveAttachmentFile(metadata, function(err, result) {
        var file = {
          path : result.fileId,
          name : metadata.name,
          type : metadata.type
        };

        if (err) return res.send(500);
        // wraps the file
        var bundles = { files : []}
        bundles.files.push(file)

        res.send(bundles);
      })
    } else {
      if (err) return res.send(400);
    }
  }



  return {
    create: create
    , view: view
    , list: list
    , listBase: listBase
    , listOutgoing: listOutgoing
    , listCc: listCc
    , listOutgoingBase: listOutgoingBase
    , index: index
    , getRecipientCandidates: getRecipient
    , getShareRecipientCandidates: getShareRecipient
    , decline: decline
    , addComments: addComments
    , populateSearch: populateSearch
    , isReDispositioned: isReDispositioned
    , share: share
    , findSuperiors: findSuperiors
    , uploadAttachment: uploadAttachment
    , downloadAttachment: downloadAttachment
  }
};
}
