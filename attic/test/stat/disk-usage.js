var utils = require('../utils.js')
var db = utils.db
var app = utils.app
var org = "Bimtek siMAYA" 

db.open(function(){
  var diskUsage = app.db('diskUsage')

  function map(){
    if(this.organization.indexOf(organization) > -1){
      emit (this.organization, this.usage)
    }
  }

  function reduce(key, values){
    return bytesToSize(Array.sum(values))
  }

  var options = {
    out : { inline : 1},
    scope : { organization : org, date : new Date()}
  }

  function bytesToSize(bytes) {
    var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    if (bytes == 0) return 'n/a'
    var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)))
    if (i == 0) return bytes + ' ' + sizes[i]
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i]
  }

  diskUsage.mapReduce(map, reduce, options, function(err, res){
    for(var i = 0; i < res.length; i++){
      console.log(res[i]._id, bytesToSize(res[i].value))
    }
    db.close()
  })

})