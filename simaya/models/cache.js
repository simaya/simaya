module.exports = function(app) {
  var db = app.db("cache");

  return {
    update: function(collectionName, valid, callback) {
      db.getCollection(function(error, collection) {
        var data = {
          collection: collectionName
          , valid: valid 
          , time: new Date()
        }
        db.findOne({collection: collectionName}, function(err, item) {
          if (err == null && item != null) {
            db.update({
              collection: collectionName
            }, {
              "$set": data
            }, function(err, validator) {
              if (err != null) {
                callback(null);
              console.log("yyy")
              } else {
                callback(item._id);
              }
            })
          } else {
            data._id = collection.pkFactory.createPk();
            db.insert(data, function(error, validator) {
              if (err != null) {
                callback(null)
              } else {
                callback(data._id)
              }
            })
          }
        })
      })
    }
    , isValid: function(collection, callback) {
      db.findOne({collection: collection, valid: true}, function(err, item) {
        if (err == null && item != null) {
          var colon = collection.indexOf(":");
          if (colon > 0) {
            collection = collection.substring(0, colon); 
          }
          var c = app.db(collection + "_cache");
          c.findArray({cacheId: item._id}, function(e, r) {
            if (r != null && r.length > 0) {
              callback(item._id, item.time);
            } else {
              db.remove({_id: item._id}, function(r) {
                console.log("foce remove")
                callback(null);
              })
            }
          })
        } else {
          callback(null);
        }
      })
    }
    , removeCollections: function(collections, callback) {
      db.remove({collection: { $in : collections }}, function (err) {
        callback();
      });
    }
  }
}
