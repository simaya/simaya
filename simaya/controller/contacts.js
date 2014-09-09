module.exports = function(app) {
  var ObjectID = app.ObjectID
    , contacts = require("../models/contacts.js")(app)
    , notification = require("../models/notification.js")(app)
    , modelUtils = require("../models/utils.js")(app)
    , utils = require("../../sinergis/controller/utils.js")(app)
    , session = require("../../sinergis/models/session.js")(app)
    , azuresettings = require("../../azure-settings.js");


  var listBase = function(search, template, vals, req, res) {
    var me = req.session.currentUser

    contacts.listByUser(me, search, function(r) {
      vals.contacts = r;
      utils.render(req, res, template, vals, "base-authenticated"); 
    })
  }

  var establishMany = function(me, count, data, callback) {
    if (count < data.length) {
      contacts.establish(data[count], function() {
        sendConnectedNotification(data[count], me, function() {
          establishMany(me, count + 1, data, callback);
        })
      })
    } else {
      callback();
    }
  }

  var removeMany = function(count, data, callback) {
    if (count < data.length) {
      contacts.remove(data[count], function() {
        removeMany(count + 1, data, callback);
      })
    } else {
      callback();
    }
  }

  var removeContacts = function(template, vals, req, res) {
    if (typeof(req.body.marked) === "string") {
      contacts.remove(req.body.marked, function() {
        listBase(search, template, vals, req, res);
      })
    } else {
      removeMany(0, req.body.marked, function() {
        listBase(search, template, vals, req, res);
      })
    }
  }

  var list = function(req, res) {
    var me = req.session.currentUser
    var search = {
      search: {
        end1: me,
        established: true
      }
    }

    var vals = {
      requireAdmin: true,
      isContactMenu: true
    }

    var breadcrumb = [
      {text: 'Kontak', isActive: true}
    ];
    vals.breadcrumb = breadcrumb;

    if (req.body.marked) {
      removeContacts("contacts", vals, req, res);
    } else {
      listBase(search, "contacts", vals, req, res);
    }
  }

  var waiting = function(req, res) {
    var me = req.session.currentUser
    var search = {
      search: {
        end1: me,
        initiator: me,
        established: false 
      }
    }

    var vals = {
      requireAdmin: true,
      isContactMenu: true
    }

    var breadcrumb = [
      {text: 'Kontak', link: '/contacts'},
      {text: 'Daftar Tunggu', isActive: true}
    ];
    vals.breadcrumb = breadcrumb;

    if (req.body.marked) {
      removeContacts("contacts-waiting", vals, req, res);
    } else {
      listBase(search, "contacts-waiting", vals, req, res);
    }
  }

  var notMe = function(me, users) {
    if (users[0] != me) {
      return users[0];
    } else {
      return users[1];
    }
  }

  var sendConnectedNotification = function(id, me, callback) {
    contacts.getInfo(id, function(item) {
      if (item == null) {
        callback();
      } else {
        modelUtils.resolveUsers([me], function(resolved) {
          azuresettings.makeNotification("Sekarang Anda telah terhubung ke " + resolved[0].name, + "/contacts", app.req.session.currentUserProfile.id);
          notification.set(me, notMe(me, item.connections), "Sekarang Anda telah terhubung ke " + resolved[0].name, "/contacts", function() {
            callback();
          })
        })
      }
    })
  }

  var toBeApproved = function(req, res) {
    var me = req.session.currentUser
    var vals = {
      requireAdmin: true,
      isContactMenu: true
    }

    var breadcrumb = [
      {text: 'Kontak', link: '/contacts'},
      {text: 'Daftar Periksa', isActive: true}
    ];
    vals.breadcrumb = breadcrumb;

    var search = {
      search: {
        end2: me,
        initiator: { $ne: me },
        established: false 
      }
    }
    var template = "contacts-to-be-approved"
    if (req.body.marked) {
      if (req.body.remove) {
        removeContacts(template, vals, req, res);
      } else {
        if (typeof(req.body.marked) === "string") {
          contacts.establish(req.body.marked, function() {
            sendConnectedNotification(req.body.marked, me, function() {
              listBase(search, template, vals, req, res);
            })
          })
        } else {
          establishMany(me, 0, req.body.marked, function() {
            listBase(search, template, vals, req, res);
          })
        }
      }
    } else {
      if (req.query && req.query.approve) {
        contacts.establish(req.query.approve, function() {
          sendConnectedNotification(req.query.approve, me, function() {
            listBase(search, template, vals, req, res);
          })
        })
      } else if (req.query && req.query.ignore) {
        contacts.remove(req.query.ignore, function() {
          listBase(search, template, vals, req, res);
        })
      } else {
        listBase(search, template, vals, req, res);
      }
    }
  }

  var requestConnection = function(req, res) {
    if (req.query && req.query.username) {
      var me = req.session.currentUser
      var data = {
        connections: [ me, req.query.username ],
        established: false,
        initiator: me,
        date: new Date()
      }
      if (req.query.text) {
        data.text = req.query.text;
      }
      contacts.connect(data, function(v) {
        if (v.hasErrors()) {
          res.send(JSON.stringify(v.errors));
        } else {
          modelUtils.resolveUsers([me, req.query.username], function(resolved) {
            var message = resolved[0].name + " ingin menambahkan Anda sebagai kontaknya.";
            if (req.query.text) {
              message += " Pesan: " + req.query.text + ""; 
            }
            var actions = [
              { type: "link",
                data: {
                  title: "Setujui",
                  url: "/contacts/to-be-approved?approve=" + v.resultId
                }
              }
              , { type: "link",
                data: {
                  title: "Abaikan",
                  url: "/contacts/to-be-approved?ignore=" + v.resultId
                }
              }
            ]
            notification.setWithActions(req.session.currentUser, req.query.username, message, "/contacts/to-be-approved", actions);
            // test
            azuresettings.makeNotification(message, req.session.currentUserProfile.id);
            res.send(JSON.stringify("OK"));
          })
        }
      })
    } else {
      res.send(JSON.stringify("ERROR"));
    }
  }

  var removeConnection = function(req, res) {
    if (req.query && req.query.id) {
      contacts.remove(req.query.id, function(r) {
        res.send(JSON.stringify("OK"));
      })
    } else {
      res.send(JSON.stringify("ERROR"));
    }
  }

  var checkConnection = function(req, res) {
    if (req.query && req.query.username) {
      var me = req.session.currentUser
      var search = {
        search: {
          end2: req.query.username
        }
      }

      contacts.listByUser(me, search, function(r) {
        if (r != null && r.length > 0) {
          res.send(JSON.stringify({result: true}));
        } else {
          res.send(JSON.stringify({result: false}));
        }
      })

    } else {
      res.send(JSON.stringify("ERROR"));
    }
  }

  var getOnlineState = function(req, res) {
    if (req.query && req.query.username) {
      var me = req.session.currentUser
      var search = {
        search: {
          end2: req.query.username
        }
      }
      contacts.listByUser(me, search, function(r) {
        if (r != null && r.length > 0) {
          session.getLoginState(req.query.username, function(state) {
            res.send(JSON.stringify({"state": state}));    
          })
        } else {
          res.send(JSON.stringify({state: 0}));    
        }
      })
    } else {
      res.send(JSON.stringify({state: 0}));    
    }
  }

  return {
    list: list
    , waiting: waiting
    , toBeApproved: toBeApproved
    , requestConnection : requestConnection 
    , removeConnection : removeConnection 
    , checkConnection : checkConnection 
    , getOnlineState: getOnlineState 
    , sendConnectedNotification: sendConnectedNotification
  }
}
