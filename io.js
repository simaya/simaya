module.exports = function(app) {
  var contacts = require("./simaya/models/contacts.js")(app)
  var sockets = {};

  app.io.isOnline = function(user) {
    var socket = sockets[user];
    if (socket && socket) {
      return true;
    }
    return false;
  }

  app.io.sendPrivateMessage = function(user, message) {
    var socket = sockets[user];
    if (socket && socket) {
      console.log("Sending private message to " + user);
      socket.emit("private-message", message);
    } else {
      console.log("User " + user + " is not online, PM not sent");
    }
  }

  // User disconnects, e.g. closing browser tab, switch pages
  app.io.route('disconnect', function(req) {
    if (req.session && req.session.currentUser) {
      var user = req.session.currentUser;
      updatePresence(user, "going-offline");

      delete sockets[user];
    }
  });

  // User (re-)connects, called on every page
  app.io.route('ready', function(req) {
    if (req.session && req.session.currentUser) {
      var user = req.session.currentUser;
      sockets[user] = req.io.socket; 

      updatePresence(user, "online");
    }
  })


  // Update presence-status
  var updatePresence = function(me, status) {
    var search = {
      search: {
        end1: me,
        established: true
      }
    }

    contacts.listByUser(me, search, function(r) {
      if (r) {
        for (var i = 0; i < r.length; i ++) {
          var user = r[i].end2;
          if (sockets[user]) {
            var socket = sockets[user];
            socket.emit("presence-status", {
              user: me,
              status: status,
            });
          }
        }
      }
    });
  }

  // Update timeline
  app.io.updateTimeline = function(data) {
    var search = {
      search: {
        end1: data.me,
        established: true
      }
    }

    contacts.listByUser(data.me, search, function(r) {
      if (r) {
        for (var i = 0; i < r.length; i ++) {
          var user = r[i].end2;
          if (sockets[user]) {
            var socket = sockets[user];
            socket.emit("timeline", {
              user: data.me,
              id: data.id,
            });
          }
        }
      }
    });
  }

};
