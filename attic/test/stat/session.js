var utils = require('../utils.js')
var db = utils.db
var app = utils.app
var org = "Bimtek siMAYA" 

db.open(function(){
  var session = app.db('session')
  var user = app.db('user')

  function map(){
    if(new Date(this.expireAt).valueOf() > new Date()){
      emit (this.username, 1)
    }
  }

  function reduce(key, values){
    return Array.sum(values)
  }
  
  var options = {
    out : { inline : 1}
  }

  session.mapReduce(map, reduce, options, function(err, res){
    for(var i = 0; i < res.length; i++){
      user.findOne({ username : res[i]._id, "profile.organization" : { $regex : "^" + org} }, function(err, currentUser){
        console.log(currentUser)
      })
    }
  })
})