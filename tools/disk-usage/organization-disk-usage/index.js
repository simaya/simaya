var mongo = require('mongoskin')
var uuid = require('node-uuid')
var lela = require('./lib/lela')

function snapshot(options, callback){
  var name = options.name || uuid.v4()
  var timestamp = (new Date()).valueOf()
  var db = options.db || mongo.db(options.dbConnection || 'localhost:27017/simaya', { safe : false})
  
  var files = db.collection('fs.files')
  var letters = db.collection('letter')

  var indexingOptions = {
    organization : 1,
    snapshot : 1,
    timestamp : -1
  }

  var keys = ['senderOrganization']
  var condition = {}
  var initial = { attachments : [] }
  var reduce = function(current, result){
    var attachments = current.fileAttachments || []
    for(var i = 0; i < attachments.length; i++){
      result.attachments.push({ attachment : attachments[i]})
    }
  }

  function size(file, cb){ 
    files.findById(file.path, function(err, file){
      if(!file) return cb(null, 0)
      cb(err, file.length)
    })
  }

  function done(db, expectedCount, currentCount, err, data, callback){
    if(err) return callback(err)
    if(currentCount == expectedCount){
      if(options.collection){
        db.collection(options.collection).insert(data, function(err, result){
          db.close()
          callback(err, data)    
        })
      }else{
        db.close()
        callback(err, data)
      }
    }
  }

  if(options.collection){
    db.collection(options.collection).ensureIndex(indexingOptions, {background : true})
  }

  letters.group(keys, condition, initial, reduce, true, function(err, docs){
    var count = 0
    var usage = []
    for(var i = 0; i < docs.length; i++){
      if(docs[i].attachments.length == 0) {
        count++
      }
      else{
        lela(size, docs[i].attachments, docs[i].senderOrganization, function(err, label,  res){
          var sum = 0
          for(var j = 0; j < res.length; j++) {
            sum += res[j]
          }
          var doc = {snapshot : name, timestamp : timestamp, organization : label, usage : sum}
          usage.push(doc)
          count++
          done(db, docs.length, count, err, usage, callback)
        })
      }
    }
  })
}

module.exports = snapshot