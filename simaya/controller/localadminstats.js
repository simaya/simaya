module.exports = function(app) {
  
  var moment = require ('moment')
  var user = require ('../../sinergis/models/user')(app)
  var session = require ('../../sinergis/models/session')(app)
  var org = require ('../models/organization')(app)
  var letter = require('../models/letter')(app)
  var async = require ("async")

  var LETTER_HISTORY_LENGTH = 7;

  // get organization count
  var orgsCount = function (organization, cb) {
    org.list(organization, function(orgs){
      cb(null, { "stat-organizations" : { total : orgs.length} });
    })
  }

  // disk usage from diskUsage collection snapshot
  var disk = function (organization, cb) {
    
    var diskUsage = app.db('diskUsage');
    var pattern = organization;
    var orgname = new RegExp(pattern);

    function bytesToSize(bytes) {
      var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
      if (bytes == 0) return 'n/a'
      var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)))
      if (i == 0) return bytes + ' ' + sizes[i]
      return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i]
    }

    diskUsage.find({organization : orgname}, function(error, cursor) {
      
      cursor.sort({ timestamp : -1}).limit(1).toArray(function(err, result){

        if (err || !result) {
          return cb(null, { "stat-disk-usage" : [] });
        }

        if (result.length == 0) {
          return cb(null, { "stat-disk-usage" : [] });
        }
          
        diskUsage.findArray({ snapshot : result[0].snapshot, organization : orgname }, function (err, snapshot){

          var data = [];
          var i = snapshot.length;
          while (i--) {

            var part = snapshot[i];
            var theOrg = part.organization;

            data.push({label : theOrg.split(";").pop() + ' (' + bytesToSize(part.usage) + ')' , data : part.usage })
          }

          cb(null, { "stat-disk-usage" : data });

        });

      });

    });
  }

  var lettersSentCount = function (organization, cb) {
    
    var pattern = organization;
    var orgname = new RegExp(pattern);

    var query = {
      search : { 'senderOrganization' : orgname }
    }

    letter.list(query, function(sent){

      var now = moment();
      var i = sent.length;
      var range = {}

      while (i--) {
        var d = new Date(sent[i].date);
        var letterDate = moment(d);
        var diff = now.diff(letterDate, 'days');

        if (diff < LETTER_HISTORY_LENGTH) {
          if (range[diff]) {
            range[diff]++;
          } else {
            range[diff] = 1;
          }
        }
      }

      cb(null, { "stat-letters-sent" : { total : sent.length, history : range} });

    });
  }

  var lettersReceivedCount = function (organization, cb) {

    letter.list({ search : {}, sort : { _id : -1 } }, function(letters){

      function incoming (letter, cb) {

        if (letter.receivingOrganizations) {

          var keys = Object.keys(letter.receivingOrganizations);

          var i = keys.length;

          while(i--){
            if (keys[i].indexOf(organization) >= 0) {
              return cb(null, [letter]);
            }
          }
        }

        cb(null, []);
      };

      letters = letters || [];

      async.map (letters, incoming, function (err, result) {
        
        var received = []; 
        
        if (result && result.length > 0) {
          received = result.reduce(function(a, b) { return a.concat(b)});
        }

        var now = moment();
        var i = received.length;
        var range = {}

        while (i--) {
          var d = new Date(received[i].date);
          var letterDate = moment(d);
          var diff = now.diff(letterDate, 'days');

          if (diff < LETTER_HISTORY_LENGTH) {
            if (range[diff]) {
              range[diff]++;
            } else {
              range[diff] = 1;
            }
          }
        }
        cb(null, { "stat-letters-received" : { total : received.length, history : range} });
      });

    });
  }

  var userBulkCount = function (organization, cb) {
    
    if (organization) {
      var pattern = organization;
      var orgname = new RegExp(pattern);

      var query = { search : {
        "profile.organization" : orgname
      }}

      user.list(query, function (users) {
        cb (null, users);
      });
    } else {
      cb (new Error("Organization is required"));
    }
  }

  var usersCount = function (organization, callback) {

    function count(cb) {
      userBulkCount(organization, cb);
    }

    function online(users, cb) {

      var pattern = organization;
      var orgname = new RegExp(pattern);

      // get all users in session
      session.list({}, function(onlines) {

        // get active insiders
        function insiders (user, cb) {

          var username = user.username;
          var valid = user.expireAt > new Date();

          var filtered = users.filter(function(u){
            return (u.username == username && valid);
          });

          cb (null, filtered);
        }

        onlines = onlines || [];

        // map users from session db as insider and active users
        async.map(onlines, insiders, function(err, result){
          var onlineUsers = result.reduce(function(a, b) { return a.concat(b)});
          cb(err, { total : users.length, online : onlineUsers.length });
        });

      });
    }

    async.waterfall([count, online], function(err, result){
      callback(null, { "stat-users" :  result});
    });
  }

  var currentStat = function (req, res) {

    var organization = req.session.currentUserProfile.organization;

    async.parallel([
      function(cb){
        usersCount(organization, cb);
      },
      function(cb){
        orgsCount(organization, cb);
      },
      function(cb){
        lettersSentCount(organization, cb);
      },
      function(cb){
        lettersReceivedCount(organization, cb);
      },
      function(cb){
        disk(organization, cb);
      }
      ], function(err, result) {
        
        var obj = {};
        var i = result.length;
        while (i--) {
          for (var k in result[i]) {
            obj[k] = result[i][k];
          }
        }

        // users online 
        obj["stat-users-online"] = { total : obj["stat-users"].online }

        // leters history
        obj["stat-letters-today"] = { total : 0 };

        if (obj["stat-letters-received"].history[0]) {
          obj["stat-letters-today"] += obj["stat-letters-received"].history[0];
        }

        if (obj["stat-letters-sent"].history[0]) {
         obj["stat-letters-today"] += obj["stat-letters-sent"].history[0]; 
        }

        obj["stat-letters"] = { total : obj["stat-letters-received"].total + obj["stat-letters-sent"].total};

        var labels = [];
        var lin = [];
        var lout = [];

        for (var i = 0; i < LETTER_HISTORY_LENGTH; i++) {
          var l = moment().subtract('days', LETTER_HISTORY_LENGTH - (i + 1)).format('DD/MM/YY')
          labels.push([i, l]);
          lin.push([i, 0]);
          lout.push([i, 0]);
        }

        for (var k in obj["stat-letters-received"].history) {
          k = parseInt(k);
          lin[k] = [k, obj["stat-letters-sent"].history[k]];
        }

        for (var k in obj["stat-letters-sent"].history) {
          k = parseInt(k);
          lout[k] = [k, obj["stat-letters-sent"].history[k]];
        }

        obj["stat-letters"].history = { lin : lin, lout : lout, xaxis : { ticks : labels}};

        res.send(obj);
      }
    );
  }
  return {
    currentStat : currentStat
  }
}
