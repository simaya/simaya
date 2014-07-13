var utils = require('../utils.js')
var db = utils.db
var app = utils.app
var org = "Bimtek siMAYA" 

db.open(function(){
  var organization = app.db('organization')
  organization.count({path : { $regex: "^" + org }}, function(err, count){
    console.log(count)
    db.close()
  })
})