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
      res.send(r);
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
      res.send(r);
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
      res.send(r);
    });
  }

  /**
   * @api {get} /contacts/request Requests to connect with a contact
   * @apiName RequestContact
   * @apiGroup Contacts
   *
   * @apiParam {String} username Username to be requested
   * @apiParam {String} text Request text
   * @apiSuccess {String} "OK"
   * @apiError {string} "ERROR"
   */
  var request = function(req, res) {
    contactsWeb.requestConnection(req, res);
  }

  /**
   * @api {get} /contacts/remove Removes a connection with a contact 
   * @apiName RemoveContact
   * @apiGroup Contacts
   *
   * @apiParam {String} id The id of the connection
   * @apiSuccess {String} "OK"
   * @apiError {string} "ERROR"
   */
  var remove = function(req, res) {
    contactsWeb.removeConnection(req, res);
  }

  /**
   * @api {get} /contacts/establish Establishes a connection with a contact 
   * @apiName EstablishContact
   * @apiGroup Contacts
   *
   * @apiParam {String} id The id of the connection
   * @apiSuccess {String} "OK"
   * @apiError {string} "ERROR"
   */
  var establish = function(req, res) {
    var me = req.session.currentUser
    if (req.query.id) {
      contacts.establish(req.query.id, function() {
        contactsWeb.sendConnectedNotification(req.query.id, me, function() {
          res.send({result: "OK"});
        });
      });
    } else {
      res.send({result: "ERROR"});
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
