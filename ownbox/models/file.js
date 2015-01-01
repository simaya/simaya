module.exports = function(app) {
  var db = app.db.collection? app.db.collection("obFile") : app.db("obFile");
  var fs = require("fs");
  var Errors = {
    NONE: 0,
    DB: 1,
    FILE_NOT_FOUND: 2,
    GRID_NOT_FOUND: 3,
    SEQ_NOT_FOUND: 4,
  }

  var error = function(code, originalError) {
    if (code == Errors.NONE || originalError == null) {
      return null;
    }
    var e = {
      code: code,
      originalError: originalError
    }
    return e;
  }

  var prepareForUpload = function(metadata, callback) {
    if (metadata._id == null) {
      metadata._id = app.ObjectID();
      db.insert(metadata, function(e, result) {
        if (e != null) {
          callback(error(Errors.DB, e));
        } else {
          callback(null, metadata._id);
        }
      });
    } else {
      var id = metadata._id;
      delete(metadata._id);
      db.findAndModify(
          { _id: id },
          [],
          { $set: metadata },
          { new: true, upsert: true },
          function(e, result) {
            if (e != null) {
              callback(error(Errors.DB, e));
              return;
            }
            callback(null, id);
          }
        );
    }
  }

  var completeUpload = function(id, result, callback) {
    db.findAndModify(
          { _id: result._id },
          [],
          {
            $push: { 
              history: {
                id: id,
                uploadTime: new Date(),
                uploader: result.uploader,
              }
            },
          },
          { new: true },
          function(e, r) {
            if (e != null) {
              callback(error(Errors.DB, e));
              return;
            }
            callback(null, r);
          }
        );
  }

  var realDownload = function(id, metadata, stream, callback) {
    if (stream.attachment) {
      stream.attachment(metadata.name);
    }
    if (stream.contentType) {
      stream.contentType(metadata.type);
    }
    var store = app.store(id, "r");
    store.open(function(e, grid) {
      if (e) {
        callback(error(Errors.GRID_NOT_FOUND, e));
        return;
      }
      var gridStream = grid.stream(true);
      gridStream.on("end", function() {
        callback(null);
      });
      gridStream.pipe(stream);
    })
  }

  /* PUBLIC */

  /* 
   * Uploads a file according to the specified metadata 
   * which can be basically anything
     var metadata = {
        path: file.path
      , name: file.name
      , type: file.type
      , _id: app.ObjectID() 
      , location: path
      , sharedTo: [ 
        {
          user: user,
          access: 'r' || 'w' || 's' // read/write/share
        }, ...]
    }
 
   * Calls back with an error code and the file record
   */
  var upload = function(metadata, callback) {
    prepareForUpload(metadata, function(e, fileId) {
      if (e != null) {
        callback(e, null);
        return;
      }
      metadata._id = fileId;
      var id = app.ObjectID();
      var store = app.store(id, metadata.fileName, "w", {metadata: {fileId: fileId}});
      store.open(function(e, grid) {
        grid.writeFile(metadata.path, function(e, result) {
          if (e != null) {
            callback(error(Errors.DB, e), null);
            return;
          }
          fs.unlinkSync(metadata.path);
          completeUpload(id, metadata, callback);
        });
      });
    });
  }

  /* 
   * Uploads an express' file req.files file to a path
   * with publicly accessible permissions
   * Calls back with an error code and the file record
   */
  var simplePublicUpload = function(file, path, callback) {
    var metadata = {
      path: file.path
    , name: file.name
    , type: file.type
    , _id: app.ObjectID() 
    , location: path
    }

    upload(metadata, callback);
  }

  /*
   * Downloads a file specified by an id and a sequential id, using the specified stream
   * If seq is 0 it downloads take the latest version
   * If seq is non-existant, calls back with error
   * Calls back when finished with null if success, or error otherwise
   */
  var download = function(id, seq, stream, callback) {
    db.findOne({_id: app.ObjectID(id + "")}, function(e, item) {
      if (item == null) {
        callback(error(Errors.FILE_NOT_FOUND, e));
        return;
      }
      if (seq < 0 || (seq > 0 && item.history.length > seq)) {
        callback(error(Errors.SEQ_NOT_FOUND, e));
        return;
      }
      var itemId;
      if (seq == 0) {
        itemId = item.history[0].id;
      } else {
        itemId = item.history[seq - 1].id;
      }

      realDownload(itemId, item, stream, callback);
    });
  }

  return {
    upload: upload
  , simplePublicUpload: simplePublicUpload
  , download: download
  }
}
