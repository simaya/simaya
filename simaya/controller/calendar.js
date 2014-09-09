module.exports = function(app) {
  var ObjectID = app.ObjectID
    , calendar = require("../models/calendar.js")(app)
    , calendarAlarm = require("../models/calendar-alarm.js")(app)
    , user = require("../../sinergis/models/user.js")(app)
    , notification = require("../models/notification.js")(app)
    , modelUtils = require("../models/utils.js")(app)
    , cUtils = require("../../simaya/controller/utils.js")(app)
    , moment = require("moment")
    , utils = require("../../sinergis/controller/utils.js")(app)
    , calendar = require("../../simaya/models/calendar.js")(app)
    , azuresettings = require("../../azure-settings.js");

  var monthView = function(req, res)
  {
    var vals = {
      username: req.session.currentUser,
      requireAdmin: true
    };

    var breadcrumb = [
      {text: 'Kalender', link: '/calendar/day'},
      {text: 'Bulan', isActive: true}
    ];
    vals.breadcrumb = breadcrumb;

    utils.render(req, res, "calendar-month", vals, "base-authenticated"); 
  }

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



  var weekView = function(req, res)
  {
    var vals = {
      username: req.session.currentUser,
      requireAdmin: true
    };

    var breadcrumb = [
      {text: 'Kalender', link: '/calendar/day'},
      {text: 'Pekan', isActive: true}
    ];
    vals.breadcrumb = breadcrumb;

    utils.render(req, res, "calendar-week", vals, "base-authenticated"); 
  }


  var dayView = function(req, res)
  {
    var vals = {
      username: req.session.currentUser,
      requireAdmin: true
    };


    var breadcrumb = [
      {text: 'Kalender', link: '/calendar/day'},
      {text: 'Hari', isActive: true}
    ];
    vals.breadcrumb = breadcrumb;

    if (req.query.invitationId) {

      vals.invitationId = req.query.invitationId;
      calendar.list({ search: {_id: ObjectID(req.query.invitationId +"")}}, function(result) {
        vals.invitationDate = result[0].start;
      
        utils.render(req, res, "calendar-day", vals, "base-authenticated"); 
      });
    } else {
      utils.render(req, res, "calendar-day", vals, "base-authenticated"); 
    }
  }

  var listView = function(req, res)
  {
    var vals = {
      requireAdmin: true
    };

    var breadcrumb = [
      {text: 'Kalender', link: '/calendar/day'},
      {text: 'Daftar', isActive: true}
    ];
    vals.breadcrumb = breadcrumb;

    utils.render(req, res, "calendar-list", vals, "base-authenticated"); 
  }

  var notifyRecipients = function(req, id, data, callback) 
  {
    if (data.recipients == null || data.recipients.length == 0) {
      callback();
      return;
    }
    var me = req.session.currentUser;
    var actions = [
      { type: "link",
        data: {
          title: "Buka Undangan",
          url: "/calendar/day?invitationId=" + id 
        }
      }
    ]
    modelUtils.resolveUsers([me], function(resolved) {
      var message = resolved[0].name + " mengundang Anda ke pertemuan dengan perihal: " + data.title;
      for (var i = 0; i < data.recipients.length; i ++) {
        if (data.recipients[i] != me) {
          azuresettings.makeNotification(message, req.session.currentUserProfile.id);
          notification.setWithActions(me, data.recipients[i], message, "/calendar/day?invitationId=" + id, actions);
        }
      }
      callback();
    });
  }


  var notifyInvitationUpdate = function(id, me, type, callback) 
  {
    var actions = [
      { type: "link",
        data: {
          title: "Buka Undangan",
          url: "/calendar/day?invitationId=" + id 
        }
      }
    ]
    calendar.list({search: {_id: ObjectID(id + "")}}, function(result) {
      if (result != null && result.length == 1) {
        var data = result[0];
        modelUtils.resolveUsers([me], function(resolved) {
          var message;
          if (type == "cancel") {
            message = resolved[0].name + " membatalkan pertemuan dengan perihal: " + data.title;
          }
          else if (type == "accept") {
            message = resolved[0].name + " menerima pertemuan dengan perihal: " + data.title;
          }
          else if (type == "decline") {
            message = resolved[0].name + " menolak pertemuan dengan perihal: " + data.title;
          }
          azuresettings.makeNotification(message, app.req.session.currentUserProfile.id);
          notification.setWithActions(me, data.user, message, "/calendar/invitation", actions);
          callback();
        });
      } else {
        callback();
      }
    })
  }

  var newJSON = function(req, res)
  {
    // console.log('HERE NEWJSON!');
    // console.log(req.body);
    // console.log('HERE HEADERS');
    // console.log(req.headers);
    if (req.body.title && req.body.startDate && req.body.startTime && req.body.endDate && req.body.endTime) {
      var start = new Date(moment(req.body.startDate, "DD/MM/YYYY").toDate());
      start.setHours(parseInt(req.body.startTime[0] + req.body.startTime[1], 10));
      start.setMinutes(parseInt(req.body.startTime[2] + req.body.startTime[3], 10));

      var end = new Date(moment(req.body.endDate, "DD/MM/YYYY").toDate());
      end.setHours(parseInt(req.body.endTime[0] + req.body.endTime[1], 10));
      end.setMinutes(parseInt(req.body.endTime[2] + req.body.endTime[3], 10));

      var fileAttachments = collectAttachments(req, res);
      if (start < end) {
        var recipients = [];
        if (req.body.recipients) {
          recipients = req.body.recipients.split(",");
        }
        var data = {
          user: req.session.currentUser,
          title: req.body.title,
          start: start,
          end: end,
          recipients: recipients,
          fileAttachments: fileAttachments,
          description: req.body.description || "",
          status: req.body.status || 0,
          visibility: req.body.visibility || 0,
          reminder: req.body.reminder || 0,
          recurrence: req.body.recurrence || 0,
        }
        // console.log("HERE DATA");
        // console.log("HERE", data);
        // console.log("HERE req.files");
        // console.log(req.files);
        if (req.body.id && req.body.id != "") {
          calendar.edit(req.body.id, data, function(v) {
            if (v.hasErrors() > 0) {
              res.send(JSON.stringify({status:"NOK", error: "system", v: v}))
            } else {
              if (req.body.reminder) {
                var alarmTime = start;
                alarmTime.setMinutes(alarmTime.getMinutes() - req.body.reminder);

                var alarmData = {
                  calendarId: ObjectID(req.body.id + ""),
                  time: alarmTime,
                }
                calendarAlarm.edit(req.body.id, alarmData, function(v) {
                  notifyRecipients(req, req.body.id, data, function() {
                    res.send(JSON.stringify({status:"OK"}))
                  })
                });
              } else {
                notifyRecipients(req, req.body.id, data, function() {
                  res.send(JSON.stringify({status:"OK"}))
                })
              }
            }
          });
        } else {
          calendar.create(data, function(v) {
            var resultId = v.resultId;
            if (v.hasErrors() > 0) {
              res.send(JSON.stringify({status:"NOK", error: "system", v: v}))
            } else {
              if (req.body.reminder) {
                var alarmTime = start;
                alarmTime.setMinutes(alarmTime.getMinutes() - req.body.reminder);

                var alarmData = {
                  calendarId: ObjectID(v.resultId + ""),
                  time: alarmTime,
                }
                calendarAlarm.create(alarmData, function(v) {
                  notifyRecipients(req, resultId, data, function() {
                    res.send(JSON.stringify({status:"OK"}))
                  });
                });
              } else {
                notifyRecipients(req, req.body.id, data, function() {
                  res.send(JSON.stringify({status:"OK"}))
                });
              }
            }
          });
        }
      } else {
        res.send(JSON.stringify({status:"NOK", error: "date-sequence"}))
      }
    } else {
      res.send(JSON.stringify({status:"NOK", error: "incomplete"}))
    }
  }

  var listDayJSON = function(req, res)
  {
    var me = req.session.currentUser; 
    var date = new Date();
    if (typeof(req.query.date) !== "undefined") {
      date = new Date(req.query.date);
    }

    date.setHours(0);
    date.setMinutes(0);

    var dateEnd = new Date(date);
    var numDays = 0;
    if (typeof(req.query["num-days"]) !== "undefined") {
      numDays = parseInt(req.query["num-days"]);
      if (isNaN(numDays) || numDays <= 0) {
        numDays = 1;
      }
      numDays = numDays - 1;
    }
    dateEnd.setDate(dateEnd.getDate() + numDays);
    dateEnd.setHours(23);
    dateEnd.setMinutes(59);

    var search = {
      search: {
        start: { $gte: date},
        end: { $lte: dateEnd},
        $or: [
            { user: me} ,
            { recipients: { $in: [me] }},
            { global: true } ,
          ]
      }
    }
    //console.log(search.search);
    calendar.list(search, function(result) {
      //console.log(result);
      var recipientHash = {};
      for (var i = 0; i < result.length; i++) {
        var r = result[i].recipients;
        for (var j = 0; j < r.length; j ++) {
          recipientHash[r[j]] = 1;
        }
      }
      if (recipientHash.length > 0) {
        res.send(JSON.stringify(result));
      } else {
        modelUtils.resolveUsers(Object.keys(recipientHash), function(resolved) {
          recipientHash = {};
          for (var i = 0; i < resolved.length; i ++) {
            recipientHash[resolved[i].username] = resolved[i].name;
          }
          for (var i = 0; i < result.length; i++) {
            var r = result[i].recipients;
            var rs = [];
            for (var j = 0; j < r.length; j ++) {
              rs.push(recipientHash[r[j]]);
            }
            result[i].recipientsResolved = rs;
          }
          res.send(JSON.stringify(result));
        });
      }
    })
  }

  var listDatesInMonthJSON = function(req, res)
  {
    var me = req.session.currentUser; 
    var date = new Date();
    if (typeof(req.query.date) !== "undefined") {
      date = new Date(req.query.date);
    }

    date.setUTCHours(0);
    date.setUTCMinutes(0);
    date.setUTCDate(1);

    var dateEnd = new Date(date);
    dateEnd.setUTCMonth(date.getUTCMonth() + 1);

    var search = {
      search: {
        start: { $gte: date},
        end: { $lt: dateEnd},
        $or: [
            { user: me} ,
            { recipients: { $in: [me] }} ,
            { global: true } ,
          ]
      }
    }

    calendar.list(search, function(result) {
      var dates = {}

      for (var i = 0; i < result.length; i ++) {
        var span = ((result[i].end - result[i].start)/1000/60/60/24) + 1; // Gets the number of day span
        for (var j = 0; j < span; j ++) {
          var date = result[i].start.getDate();
          dates[date] = 1; // record the occurences
        }
      }

      res.send(JSON.stringify(Object.keys(dates)));
    })
  }

  var downloadAttachment = function(req, res) {
    var vals = {};
    
    if (req.params.id) {
      calendar.downloadAttachment(req.params.id, res);
    } else {
      res.redirect("/calendar/day");
    }
  }
 
  // Gets the Recipient candidates
  var getRecipientJSON = function(req, res) {
    if (req.query.org) {
      var search = {
        search: {
          "profile.organization": req.query.org, 
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

  // Gets the alarm 
  var getAlarmJSON = function(req, res) {
    var time = new Date();
    if (req.query.time) {
      time = new Date(req.query.time);
    }

    var search = {
      search: {
        $or: [
          {
            time: time
          }, 
          {
            reshow: true
          }
        ]
      }
    }

    var updateAlarm = function(i, data, res) {
      if (i < data.length && typeof(data[i].reshow === "undefined")) {
        data[i].reshow = true;
        calendarAlarm.edit(data[i].calendarId, data[i], function(e) {
          if (i == (data.length - 1)) {
            res.send(JSON.stringify(data));
            return;
          } else {
            i ++;
            if (i < data.length) {
              updateAlarm(i, data, res);
            }
          }
        });
      }
     
      i ++;
      if (i < data.length) {
        updateAlarm(i, data, res);
      }
    }

    calendarAlarm.list(search, function(r) {
      if (r == null || r.length == 0) {
        r = [];
        res.send(JSON.stringify(r));
      } else {
        updateAlarm(0, r, res);
      }
    });
  }

  // Removes the alarm 
  var removeAlarmJSON = function(req, res) {
    if (req.params.id) {
      calendarAlarm.remove(req.params.id, function(r) {
        res.send(JSON.stringify("OK"));
      });
    } else {
      res.send(JSON.stringify("OK"));
    }
  }

  // Removes the alarm data 
  var getAlarmDataJSON = function(req, res) {
    if (req.params.id) {
      var search = {
        search: {
          _id: ObjectID(req.params.id)
        }
      }
      calendar.list(search, function(r) {
        res.send(JSON.stringify(r));
      });
    } else {
      res.send(JSON.stringify("[]"));
    }
  }

  // Declines an invitation 
  var declineInvitationJSON = function(req, res) {
    var me = req.session.currentUser;
    if (req.params.id) {
      calendar.declineInvitation(req.params.id, me, function(r) {
        notifyInvitationUpdate(req.params.id, me, "decline", function() {
          res.send(JSON.stringify("OK"));
        })
      });
    } else {
      res.send(JSON.stringify("ERR"));
    }
  }

  // Accepts an invitation 
  var acceptInvitationJSON = function(req, res) {
    var me = req.session.currentUser;
    if (req.params.id) {
      calendar.acceptInvitation(req.params.id, me, function(r) {
        notifyInvitationUpdate(req.params.id, me, "accept", function() {
          res.send(JSON.stringify("OK"));
        })
      });
    } else {
      res.send(JSON.stringify("ERR"));
    }
  }

  // Cancels an invitation 
  var cancelInvitationJSON = function(req, res) {
    var me = req.session.currentUser;
    if (req.params.id) {
      calendar.cancelInvitation(req.params.id, me, function(r) {
        notifyInvitationUpdate(req.params.id, me, "cancel", function() {
          res.send(JSON.stringify("OK"));
        })
      });
    } else {
      res.send(JSON.stringify("ERR"));
    }
  }

  // Cancels an invitation 
  var removeInvitationJSON = function(req, res) {
    var me = req.session.currentUser;
    if (req.params.id) {
      calendar.removeInvitation(req.params.id, me, function(r) {
        res.send(JSON.stringify("OK"));
      });
    } else {
      res.send(JSON.stringify("ERR"));
    }
  }

  var redirectToCalendarDay = function(req, res) {
    res.redirect('/calendar/day');
  }



  return {
    dayView: dayView, 
    list: listView, 
    weekView: weekView, 
    monthView: monthView, 
    newJSON: newJSON,
    listDayJSON: listDayJSON,
    listDatesInMonthJSON: listDatesInMonthJSON,
    downloadAttachment: downloadAttachment,
    getRecipientCandidatesJSON: getRecipientJSON,
    getAlarmJSON: getAlarmJSON,
    removeAlarmJSON: removeAlarmJSON,
    getAlarmDataJSON: getAlarmDataJSON,
    acceptInvitationJSON: acceptInvitationJSON,
    cancelInvitationJSON: cancelInvitationJSON,
    declineInvitationJSON: declineInvitationJSON,
    removeInvitationJSON: removeInvitationJSON,
    redirectToCalendarDay: redirectToCalendarDay,
  }
};
