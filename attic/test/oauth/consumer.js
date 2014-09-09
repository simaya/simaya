var utils = require('../utils.js')
var qs = require('querystring')
var user = require('../../sinergis/models/user')(utils.app)
var spawn = require('child_process').spawn
var request = require('request')
var accessToken = ''
var username = 'user.user'
var password = 'password'
var provider = spawn('node', ['provider.js'])
var secretEndpoint = 'http://localhost:3000/api/1/letter/list'

function createUser(callback){
  var profile = {
      firstName: 'Mimimi',
      lastName: 'Opopo',
      gender: 'f'
  }

  user.create(username, password, profile, function(v){
    user.setActive(username, function(){
      callback()  
    })
  })
}

var testCases = {
  setUp: function(callback) {
    utils.db.open(function() {
      
      if(numberOfTestsRun == numberOfTests) {
        // Drop database in the first run 
        utils.db.dropDatabase(function(err, done) {
          createUser(function(){
            setTimeout(function(){ callback() }, 2000)
          })  
        });                
      } else {
        callback()
      }    
    });
  },

  tearDown: function(callback) {
    numberOfTestsRun = numberOfTestsRun - 1;
    utils.db.close()
    if(numberOfTestsRun - 2 == 0){
      provider.kill()
    }
    callback();
  },

  'get protected resource without access token should be failed' : function(test){
        request(secretEndpoint, function(err, res, body){
          var obj = JSON.parse(body)
          test.ok(obj.status == 'error' && obj.message == 'access denied', '')
          test.done()
        })
  },

  'get valid access token' : function(test){
    var token = spawn('phantomjs', [__dirname + '/scripts/token.js'])

    token.stdout.on('data', function(data){
      var message = data.toString().trim()
      if(message.indexOf('#access_token') > -1){
        var str = message.substr(message.indexOf('#access_token') + 1)
        var q = qs.parse(str)
        var valid = q.access_token.length == 260

        // for next test
        if(valid) accessToken = q.access_token

        test.ok(valid)
        test.done()
      }
    })

    token.on('close', function(){
      test.done()
    })
  },

  'get protected resource with valid access token' : function(test){
    request(secretEndpoint + '?access_token=' + accessToken, function(err, res, body){
      test.ok(JSON.parse(body).status == 'success')
      test.done()
    })
  }
}

var numberOfTests = Object.keys(testCases).length
var numberOfTestsRun = numberOfTests
module.exports = testCases


