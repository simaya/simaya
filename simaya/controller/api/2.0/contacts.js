module.exports = function(app) {
  var contacts = require('../../../models/contacts.js')(app)
    , contactsWeb = require('../../contacts.js')(app)
    , utils = require('../../../../sinergis/controller/utils.js')(app)
    , moment= require('moment')

   /**
   * @api {get} /contacts/waiting Gets list of contacts who are not yet approved
   * @apiName ListWaitingContacts
   * @apiGroup Contacts
   *
   * @apiSuccess {Object[]} contacts List of contacts
   * @apiSuccess {String} contatcs._id ID of the connection
   * @apiSuccess {String} contacts.end2 User name of the contact
   * @apiSuccess {String} contacts.name2 Full name of the contact
   * @apiSuccess {String} contacts.organization2 Organization of the contact
   */
  var waiting = function(req, res) {
    var me = req.session.currentUser
    var search = {
      search: {
        end1: me,
        initiator: me,
        established: false 
      }
    }

    contacts.listByUser(me, search, function(r) {
      if (r) {
        res.send({
          meta: {
            code: 200
          },
          data: r
        });
      } else {
        res.send(500, {
          meta: {
            code: 500,
            data: "Server error"
          }
        });
      }
    });
  }

  var checkConnection = function(req, res) {
    var me = req.session.currentUser
    var search = {
      search: {
        $or: [
          { end2: req.query.username },
          { end1: req.query.username },
        ]
      }
    }

    contacts.listByUser(me, search, function(r) {
      res.send(r);
    });
  }

  /**
   * @api {get} /contacts/to-be-approved Gets list of contacts who are requesting to be connected
   * @apiName ListToBeApprovedContacts
   * @apiGroup Contacts
   *
   * @apiSuccess {Object[]} contacts List of contacts
   * @apiSuccess {String} contatcs._id ID of the connection
   * @apiSuccess {String} contacts.end2 User name of the contact
   * @apiSuccess {String} contacts.name2 Full name of the contact
   * @apiSuccess {String} contacts.organization2 Organization of the contact
   */
  var toBeApproved = function(req, res) {
    var me = req.session.currentUser
    var search = {
      search: {
        end2: me,
        initiator: { $ne: me },
        established: false 
      }
    }

    contacts.listByUser(me, search, function(r) {
      if (r) {
        res.send({
          meta: {
            code: 200
          },
          data: r
        });
      } else {
        res.send(500, {
          meta: {
            code: 500,
            data: "Server error"
          }
        });
      }
    });
  }

  /**
   * @api {get} /contacts/list Gets list of contacts
   * @apiName ListContacts
   * @apiGroup Contacts
   *
   * @apiSuccess {Object[]} contacts List of contacts
   * @apiSuccess {String} contatcs._id ID of the connection
   * @apiSuccess {String} contacts.end2 User name of the contact
   * @apiSuccess {String} contacts.name2 Full name of the contact
   * @apiSuccess {String} contacts.organization2 Organization of the contact
   */
  var list = function(req, res) {
    var me = req.session.currentUser
    var search = {
      search: {
        end1: me,
        established: true
      }
    }

    contacts.listByUser(me, search, function(r) {
      if (r) {
        res.send({
          meta: {
            code: 200
          },
          data: r
        });
      } else {
        res.send(500, {
          meta: {
            code: 500,
            data: "Server error"
          }
        });
      }

    });
  }

  // Wraps letter's res
  var ResWrapper = function(callback) {
    return {
      send: function(data) {
        callback(data)
      }
    }
  };

  /**
   * @api {get} /contacts/request Requests to connect with a contact
   * @apiName RequestContact
   * @apiGroup Contacts
   *
   * @apiParam {String} username Username to be requested
   * @apiParam {String} text Request text
   */
  var request = function(req, res) {
    var r = ResWrapper(function(data) {
      if (data && data == "\"OK\"") {
        res.send({
          meta: {
            code: 200
          }
        });
      } else if (data && JSON.parse(data).Data) {
        res.send(400, {
          meta: {
            code: 400,
            data: "Invalid request: " + JSON.parse(data).Data.join(",")
          }
        });
      } else {
        res.send(400, {
          meta: {
            code: 400,
            data: "Invalid request"
          }
        });
      }
    });
    contactsWeb.requestConnection(req, r);
  }

  /**
   * @api {get} /contacts/remove Removes a connection with a contact 
   * @apiName RemoveContact
   * @apiGroup Contacts
   *
   * @apiParam {String} id The id of the connection
   */
  var remove = function(req, res) {
    var r = ResWrapper(function(data) {
      console.log(data);
      if (data && data == "\"OK\"") {
        res.send({
          meta: {
            code: 200
          }
        });
      } else if (data && JSON.parse(data).Data) {
        res.send(400, {
          meta: {
            code: 400,
            data: "Invalid request: " + JSON.parse(data).Data.join(",")
          }
        });
      } else {
        res.send(400, {
          meta: {
            code: 400,
            data: "Invalid request"
          }
        });
      }
    });

    contactsWeb.removeConnection(req, r);
  }

  /**
   * @api {get} /contacts/establish Establishes a connection with a contact 
   * @apiName EstablishContact
   * @apiGroup Contacts
   *
   * @apiParam {String} id The id of the connection
   */
  var establish = function(req, res) {
    var me = req.session.currentUser
    if (req.query.id) {
      contacts.getInfo(req.query.id, function(item) {
        if (item && item.originator != me) {
          contacts.establish(req.query.id, function(v) {
            if (v.errors) {
              res.send(400, {
                meta: {
                  code: 400,
                  data: "Invalid request"
                }
              });
            }
            contactsWeb.sendConnectedNotification(req.query.id, me, function() {
              res.send({meta: {code: 200}});
            });
          });
        } else {
          res.send(400, {
            meta: {
              code: 400,
              data: "Invalid request"
            }
          });
        }
      });
    } else {
      res.send(400, {
        meta: {
          code: 400,
          data: "Invalid request"
        }
      });
    }
  }
   
  return {
    list: list,
    waiting: waiting,
    toBeApproved: toBeApproved,
    request: request,
    remove: remove,
    establish: establish,
    checkConnection: checkConnection,
  }
};
