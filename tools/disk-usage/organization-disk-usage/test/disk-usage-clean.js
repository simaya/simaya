var mongo = require('mongoskin')
var db = mongo.db('titik.blankon.rockybars.com:27017/simaya', { safe : false})

db.collection('diskUsage').remove(function(err, result){
  if(err) throw err
  console.log(result)
  db.close()
})