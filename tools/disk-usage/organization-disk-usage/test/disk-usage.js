var mongo = require('mongoskin')
var db = mongo.db('titik.blankon.rockybars.com:27017/simaya', { safe : false})

db.collection('diskUsage').find().toArray(function(err, items){
  if(err) throw err
  var count = 0

  console.log(items.length)
  if(items.length == 0) {
    db.close()
    return
  }

  items.forEach(function(item){
    count++
    console.log(item)
    if(count == items.length) db.close()
  })
})