// Apple Notification`

module.exports = function(app) {
  // Private 
  var ObjectID = app.ObjectID;
  var db = app.db('pushNotification')
  var notify = require("push-notify");
  var GCM = require("gcm").GCM;
  
  var mode = process.env.PUSHMODE || "dev";

  var apn = new notify.apn({
    gateway: (mode == "dev") ? "gateway.sandbox.push.apple.com" : "gateway.push.apple.com",
    passphrase: process.env.CERTPASSPHRASE,
    key: __dirname + "/../../certs/" + mode + "/private.pem",
    cert: __dirname + "/../../certs/" + mode + "/simaya.pem"
  });

  apn.on("transmitted", function(n, d) {
    console.log("TRANSMITTED" + ":" + d);
    console.log(n);
  });
  apn.on("transmissionError", function(e, n, d) {
    
    console.log("TRANSMIT ERROR" + ":" + d);
    console.log(n);
    console.log(e);
  });

  var gcm = new GCM(process.env.GCMAPIKEY || "AIzaSyCRQ3_aw0TMlIbKx_0n22q58syrBrWAicA");

  var sendAPN = function(data, count, message) {
    var data = {
      token: data.token,
      badge: count,
    }

    if (message) {
      data.alert = message;
    }
    apn.send(data);
  }

  var sendGCM = function(data, message) {
    if (message) {
      var payload = {
        registration_id: data.token,
        collapse_key: "simaya",
        "data.message": message,
        "data.title": "Simaya",
      }
      gcm.send(payload, function(err, messageId) {
        if (err) {
          console.log("GCM ERROR");
          console.log(err);
        } else {
          console.log("GCM sent as " + messageId);
        }
      })
    }
  }

  // Public API
  return {
    set: function(user, type, uuid, token, callback) {
      db.getCollection(function (error, collection) {
        var data = {
          username: user,
          type: type,
          token: token,
          uuid: uuid,
          time: new Date()
        };

        db.findArray({username: user, uuid: uuid}, function(error, result) {
          if (result&& result.length > 0) {
            result[0].time = new Date();
            db.save(result[0], callback);
          } else {
            db.insert(data, function(error) {
              callback();
            })
          }
        })
      });
    },

    get: function(user, callback) {
      db.findArray({username: user}, function(err, items) { 
        if (err == null && items != null) {
          callback(items);
        } else {
          callback([]);
        }
      });
    },

   remove: function(user, token, callback) {
    db.remove(
      {username: user,
        token: token}, 
      function(err) {
        callback();
      });
  },

  send: function(user, count, message) {
    db.findArray({username: user}, function(err, items) { 
      for (var i = 0; i < items.length; i++) {
        if (items[i].type == "ios") {
          sendAPN(items[i], count, message);
        } else {
          sendGCM(items[i], message);
        }
      }
    })
  },
}
}
