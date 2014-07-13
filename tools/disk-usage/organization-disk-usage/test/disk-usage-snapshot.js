var mongo = require('mongoskin')
var db = mongo.db('titik.blankon.rockybars.com:27017/simaya', { safe : false})
var diskUsage = db.collection('diskUsage')

var keys = ['snapshot']
var initial = { data : []}
var reduce = function(current, result){
  result.data.push({ organization : current.label, usage : current.usage})
}
var condition = {}
diskUsage.group(keys, condition, initial, reduce, true, function(err, docs){
  if(err) throw err
  console.log(docs)
})