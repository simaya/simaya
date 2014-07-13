// Timeline
module.exports = function(app) {
  var db = app.db("timeline");
  var ObjectID = app.ObjectID;

  var insert = function(data, callback) {
    db.getCollection(function (error, collection) {
      data._id = collection.pkFactory.createPk();

      db.insert(data, function(error) {
        callback(error, data._id);
      });
    });
  }

  /* Posts a comment to a post in the timeline
   *
   */
  var comment = function(data, callback) {
    var id = ObjectID(data.id + "");
    delete(data.id);
    list({search: { _id: id}}, function(result) {
      if (result && result.length > 0) {
        var comments = result[0].comments || [];
        comments.push(data);
        db.findAndModify({_id: id},[], {
          $set: {comments: comments}
        }, function(error, result) {
          callback(error == null && result != null);
        });
      } else {
        callback(null);
      }
    });
  }

  /* Loves a comment to a post in the timeline
   *
   */
  var love = function(data, callback) {
    var id = ObjectID(data.id + "");
    delete(data.id);
    list({search: { _id: id}}, function(result) {
      if (result && result.length == 1) {
        var loves = result[0].loves || {};
        var userMangled = data.user.replace(".", "___");
        loves[userMangled] = data;
        db.findAndModify({_id: id},[], {
          "$set": {loves: loves}
        }, function(error, result) {
          callback(error == null && result != null);
        });
      } else {
        callback(false);
      }
    });
  }

  /* Unloves a comment to a post in the timeline
   *
   */
  var unlove = function(data, callback) {
    var id = ObjectID(data.id + "");
    delete(data.id);
    list({search: { _id: id}}, function(result) {
      var userMangled = data.user.replace(".", "___");
      if (data.user && result && result.length == 1 && result[0].loves && result[0].loves[userMangled]) {
        var loves = result[0].loves;
        delete(loves[userMangled]);
        db.findAndModify({_id: id},[], {
          $set: {loves: loves}
        }, function(error, result) {
          callback(error == null && result != null);
        });
      } else {
        callback(false);
      }
    });
  }




  var list = function(search, callback) {
    var getCount = (search["getCount"] == true);
    var fields = search["fields"] || {};

    if (getCount) {
      db.find(search.search, {_id:1}, function(err, cursor) {
        cursor.count(function(err, count) {
          callback(count);
        });
      });
    } else {
      db.find(search.search, function(err, cursor) {
        cursor.sort(search.sort || {date:-1}).toArray(function(error, result) {
          callback(result);
        });
      });
    }
  }

  return {
    insert: insert,
    list: list,
    comment: comment,
    love: love,
    unlove: unlove,
  }
};
