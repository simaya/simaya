module.exports = function(app) {
  var notification = require('../models/notification.js')(app)
    , utils = require('../../sinergis/controller/utils.js')(app)
    , moment= require('moment')
    
  var count = function(req, res) {
    notification.count(req.session.currentUser, function(r) {
      res.send(JSON.stringify({num:r}));
    });
  }
 
  var view = function(req, res) {
    notification.view(req.params.id, function(r) {
      if (r == null) {
        res.redirect('/notification');
      } else {
        res.redirect(r.url);
      }
    });
  }

    
  var list = function(req, res) {
    var vals = {
      title: 'Notification'
    }

    var breadcrumb = [
      {text: 'Notikasi', isActive: true}
    ];
    vals.breadcrumb = breadcrumb;
    
    notification.getAll(req.session.currentUser, function(r) {
      for (var i = 0; i < r.length; i ++) {
        r[i].formattedTime = moment(r[i].time).format("dddd, DD MMMM YYYY HH:ss");
      }
      vals.notifications = r;

      utils.render(req, res, 'notification', vals, "base-authenticated");
    });
  }
 
  var listJson = function(req, res) {
    var vals = {
      title: 'Notification'
    }
    
    notification.getAll(req.session.currentUser, function(r) {
      for (var i = 0; i < r.length; i ++) {
        r[i].formattedTime = moment(r[i].time).format("dddd, DD MMMM YYYY HH:ss");
      }
      res.send(JSON.stringify(r));
    });
  }
 
  var setViewed = function(req, res) {
    notification.view(req.params.id, function(r) {
      res.send(JSON.stringify({ok:1}));
    });
  }
 
  var readAll = function(req, res) {
    notification.readAll(req.session.currentUser, function(r) {
      res.send(JSON.stringify({ok:1}));
    });
  }
 
  var removeAll = function(req, res) {
    notification.removeAll(req.session.currentUser, function(r) {
      res.send(JSON.stringify({ok:1}));
    });
  }
 
  var updateState = function(req, res, next) {
    var me = req.session.currentUser;

    notification.updateByUrl(me, req.session.remoteData.url.path, function() {
      next();
    });
  }

  return {
    count: count,
    list: list,
    listJson: listJson,
    view: view,
    setViewed: setViewed,
    readAll: readAll,
    removeAll: removeAll,
    updateState: updateState
  }
};
