module.exports = function(app) {
  // Private 
  var db = app.db('captcha');
  var bcrypt = require('bcrypt');  
  var fs = require('fs')
  var fabric = require('fabric').fabric


  var getToken = function() {
    var salt = bcrypt.genSaltSync(10, 16);
    var b = new Buffer(salt);
    return b.slice(8).toString('hex');
  }

  var getText = function() {
    var a = 'abcdefghjkmnpqrtwxyz';
    var result = '';

    for (var i = 0; i < 6; i ++) {
      result += a[Math.floor(Math.random() * a.length)];
    }
    return result;
  }

  var neg = function(keep) {
    if (keep < 0)
      return 1;

    var e = Math.random();
    if (e < 0.5) 
      return -1;
    else
      return 1;
  }

  var render = function(text, stream) {

    var canvas = fabric.createCanvasForNode(200, 200);
    var left = 50;
    for (var i = 0; i < text.length; i++) {
      var char = text[i];
      var pol = (Math.random() > 0.5) ? -1 : 1;
      var angle = (Math.random() * 15);
      var shift = (Math.random() * 5);
      var t = new fabric.Text(char, {
        left: left - shift,
        top: 100 - shift,
        fill: '#f55',
        angle: (angle * pol),
      });
      canvas.add(t);
      left = left + t.width;
    }

    stream.writeHead(200, { 'Content-Type': 'image/png' });
    var png = canvas.createPNGStream();
    png.on('data', function(chunk) {
      stream.write(chunk);
    });
    png.on('end', function() {
      stream.end();
    });
  }
 
  // Public API
  return {
    // Creates a captcha record 
    // Returns a callback
    //    error: database error if any
    //    token: the token
    //    text: the text
    create: function (callback) {
      db.getCollection(function (error, collection) {
        var data = {
          token: getToken(),
          text: getText(),
        };
        data._id = collection.pkFactory.createPk();

        db.insert(data, function (error) {
          callback(data.token, data.text);
        }); 
      });
    },

    // Validates a captcha record 
    // and data will bre removed after validated
    //    token: the token to be validated
    //    text: text validation
    // Returns a callback
    //    error: database error if any
    //    result: true if validated
    validate: function(token, text, callback) {
      db.findOne({token:token}, function(err, item) { 
        if (err == null && item != null) {
          var result = false;
          if (item.text == text) {
            result = true;
          }
          db.remove({token: token}, function(err, removed) {
            callback(result); 
          });
        } else {
          callback(false); 
        }
      });
    },

    // Renders a captcha record
    //    token: the token to be rendered 
    // Returns a callback
    //    error: database error if any
    render: function(token, stream, callback) {
      db.findOne({token:token}, function(err, item) { 
        var text = "error";
        if (err == null && item != null) {
          if (item.text.length > 0) {
            text = item.text;
          }
        }
        render(text, stream);
        if (typeof(callback) !== "undefined")
          callback();
      });
    }
  }
}
