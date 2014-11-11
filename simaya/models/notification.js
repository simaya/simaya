module.exports = function(app) {
  // Private 
  var ObjectID = app.ObjectID;
  var db = app.db('notification')
  var push = require("./push-notification.js")(app);
  
  // Public API
  return {
    set: function(sender, user, message, url, callback) {
      var self = this;
      db.getCollection(function (error, collection) {
        var data = {
          sender: sender,
          username: user,
          message: message,
          url: url,
          isRead: false,
          time: new Date()
        };
        data._id = collection.pkFactory.createPk();

        db.insert(data, function (error) {
          self.count(user, function(n) {
            push.send(user, n, message);
            app.io.sendPrivateMessage(user, {
              message: "notification"
            });
            if (callback) {
              callback();
            }
          });
        });
      });
    },

    setWithActions: function(sender, user, message, url, actions, callback) {
      var self = this;
      db.getCollection(function (error, collection) {
        var data = {
          sender: sender,
          username: user,
          message: message,
          url: url,
          isRead: false,
          actions: actions,
          time: new Date()
        };
        data._id = collection.pkFactory.createPk();

        db.insert(data, function (error) {
          self.count(user, function(n) {
            push.send(user, n, message);
            app.io.sendPrivateMessage(user, {
              message: "notification"
            });
            if (callback) {
              callback();
            }
          })
        });
      });
    },

    count: function(user, callback) {
      db.find({username: user, isRead: false}, function(err, cursor) { 
        if (cursor != null) {
          cursor.count(function(e, n) {
            if (n == null) {
              callback(0);
            } else {
              callback(n);
            }
          });
        } else {
          callback(0);
        }
      });
    },

    getAll: function(user, callback) {
      db.find({username: user}, function(err, cursor) { 
        if (cursor != null) {
          cursor.sort({time: -1}).limit(10).toArray(function(err, items) {
            callback(items);
          });
        } else {
          callback([]);
        }
      });
    },

    get: function(user, callback) {
      db.findArray({username: user, isRead: false}, function(err, items) { 
        if (err == null && items != null) {
          callback(items);
        } else {
          callback([]);
        }
      });
    },


   removeAll: function(user, callback) {
    db.remove(
      {username: user}, 
      function(err) {
        callback();
      });
   },

   readAll: function(user, callback) {
    db.update(
      {username: user}, 
      { '$set': {isRead: true}}, 
      { safe: true, multi: true},
      function(err) {
        callback();
      });
   },

   view: function(id, callback) {
      var self = this;
      db.findOne({_id: ObjectID(id)}, function(err, item) { 
        if (err == null && item != null) {
          db.update({_id: ObjectID(id)}, 
            { '$set': {isRead: true}}, 
            function(err) {

            self.count(item.username, function(n) {
              push.send(item.username, n);
              if (callback) {
                callback(item);
              }
            });
          });
        } else {
          if (callback) {
            callback(null);;
          }
        }
      });
    },

   viewByUrl: function(url, callback) {
      db.findOne({url: url}, function(err, item) { 
        if (err == null && item != null) {
          db.update({url: url}, 
            { '$set': {isRead: true}}, 
            function(err) {
            if (callback) {
              callback(item);
            }
          });
        } else {
          if (callback) {
            callback(null);;
          }
        }
      });
    },

   updateByUrl: function(who, url, callback) {
      db.findOne({username: who, url: url}, function(err, item) { 
        if (err == null && item != null) {
          db.update({_id: item._id}, 
            { '$set': {isRead: true}}, 
            function(err) {
            if (callback) {
              callback(item);
            }
          });
        } else {
          if (callback) {
            callback(null);;
          }
        }
      });
    },




  }
}
