/**
 * Module dependencies.
 */

var Emitter = require("events").EventEmitter;
var Stream = require("stream");
var OwnBoxError = require("./error");
var Directory = require("./directory");
var inherits = require("util").inherits;
var async = require("async");
var mime = require("mime");
var path = require("path");
var fs = require("fs");
var debug = require("debug")("item");


// defines
var noop = function(){};

/**
 * Expose `Item`.
 * 
 *
 * .file()
 * .put() - to update() or to write()
 * .get() - to inspect() or to read()
 * .write()
 * .read()
 *
 * .revisions()
 * .destroy()
 * .remove()
 * .move()
 * .copy()
 * .rename()
 * .share()
 * 
 * .encrypt()
 */

module.exports = Item;

/**
 * Item
 *
 * @api public
 */

function Item(options) {
  if (!(this instanceof Item)) return new Item(options);
  if (!options) throw new TypeError("item settings required");
  this.merge(options);
  this.box = this.directory.box;
}

inherits(Item, Emitter);

/**
 * file
 *
 * @api public
 */

Item.prototype.file = function(file){
  if (!file) throw TypeError("file required");
  this._source = file;
  this._file = path.basename(file);
  this._mime = mime.lookup(file);
  this._metadata = this.metadata || {};
  return this;
};

/**
 * stream
 *
 * @api public
 */

Item.prototype.stream = function(file) {
  if (!file) throw TypeError("file required");
  if (!(this._stream instanceof Stream)) throw TypeError("readable stream required");
  this._file = path.basename(file);
  this._mime = mime.lookup(file);
  this._metadata = this.metadata || {}; // TODO: build metadata from this.box.owner
  return this;
}

/**
 * Encrypt `Item`.
 * 
 * Encrypt an item. Encryption/decryption can only be attempted by owner or shared user
 * 
 * @api public
 */
Item.prototype.encrypt = function(options, fn){
  debug("OwnBox.Item.encrypt is not implemented yet");
  throw new OwnBoxError({ message : "Not implemented yet", name : "OwnBox.Item.encrypt"});
}

/**
 * Decrypt `Item`.
 * 
 * Decrypt an item. Encryption/decryption can only be attempted by owner or shared user
 * 
 * @api public
 */
Item.prototype.decrypt = function(options, fn){
  debug("OwnBox.Item.decrypt is not implemented yet");
  throw new OwnBoxError({ message : "Not implemented yet", name : "OwnBox.Item.decrypt"});
}

/**
 * Put `Item`.
 * 
 * Update metadata only, or write the binary. The switch is in options.properties, or this.properties
 * 
 * @api public
 */
Item.prototype.put = function(options, fn) {
  var self = this;
  fn = fn || noop;
  self.properties = self.properties || options.properties;

  if (!options) {
    throw new OwnBoxError({ message : "`options` required", name : "OwnBox.Item.Put"});
  }

  if (self.properties) {
    // updating item's properties
    debug("updating properties...");
    self.update(options, fn);
  } else {
    // write the binary stream of defined item's stream to gridfs
    debug("writing...");
    
    if ("function" == typeof options) {
      fn = options;
    }
    self.write(fn);
  }
}

/**
 * Put `Item`.
 * 
 * @api public
 */
Item.prototype.update = function(options, fn){

  var self = this;
  fn = fn || noop;

  if (!self.properties) {
    throw new OwnBoxError({ message : "`properties` required", name : "OwnBox.Item.update"});
  }

  throw new OwnBoxError({ message : "Not implemented yet", name : "OwnBox.Item.update"});
}

/**
 * Put `Item`.
 * 
 * @api public
 */

Item.prototype.write = function(fn){

  var self = this;

  fn = fn || noop;

  self._stream = self._stream || fs.createReadStream(self._source);

  if (!(self._stream instanceof Stream)) {
    throw new OwnBoxError({ message : "readable stream required", name : "OwnBox.Item.put"}); 
  }

  var gfs = self.box.gfs;
  
  var options = {
    filename : self.directory.id + "/" + self._file,
    content_type : self._mime,
    mode : "w",

    // override this property from: box.directory.file("filename.ext", { metadata : { shareable : false, encrypted : true }})
    metadata : self._metadata || { shareable : true, encrypted : false } 
  };

  options.metadata.owner = self.box.owner;
  options.metadata.basename = self._file;
  options.metadata.dirname = self.directory.id + "/";

  gfs.files.find({ filename : options.filename}).sort({ uploadDate : -1 }).toArray(function(err, result){
    
    if (err) {
      return fn(err);
    }

    if (result.length > 0) {
      options.metadata.revision = (result[0].metadata.revision + 1); 
    } else {
      options.metadata.revision = 1;
    }

    options.root = self.box.root;
    var writeStream = gfs.createWriteStream(options);

    writeStream.on("close", function (file) {
      debug("file %s is successfully saved into %s",  self._file, self.directory.id);
      fn(null, file);
    });

    writeStream.on("error", function () {
      debug("failed to put %s to %s",  self._file, self.directory.id);
      fn(new OwnBoxError({ message : "error saving file", name: "Item.save"}));
    });

    self._stream.pipe(writeStream);
    debug("try to save save item %s (%s) to %s", self._file, self._mime, self.directory.id);

  });
}

/**
 * Revisions
 *
 * revision is proportional with result index
 *
 * result = [{ index : 0 }, { index : 1}] // result[0..n] equals revisions[0..n]
 *
 * @api public
 */
Item.prototype.revisions = function(fn) {
  fn = fn || noop;
  this.versions(fn);
}

Item.prototype.versions = function(fn) {
  var self = this;
  var files = self.box.gfs.files;
  var file = self.directory.id + "/" + self._file;

  files.find({ filename : file }).sort({uploadDate : -1}).toArray(function(err, result){
    
    debug("%s (%s revisions)", file, result.length);
    if (process.env.DEBUG) {
      for (var i = 0 ; i < result.length; i++){
        var owner = result[i].metadata.owner.user;
        var rev = result[i].metadata.revision;
        var shared = result[i].metadata.sharedTo ?  result[i].metadata.sharedTo.length : 0;
        debug("  `-- %s (rev-%s) %s %s %s %s", result[i]._id, rev, result[i].uploadDate, result[i].length, shared ? "shared" : "--    ", owner);
      }
    }

    fn(err, result);
  });
}


/**
 * Get
 *
 * @api public
 */
Item.prototype.get = function(options, fn) {
  debug("OwnBox.Item.get is not implemented yet");
  throw new OwnBoxError({ message : "not implemented yet, use .props() or .read() instead", name : "OwnBox.Item.get"});
}

/**
 * Inspect
 *
 * read item's content or properties (including metadata) given options
 *
 * @api public
 */
Item.prototype.inspect = function(options, fn) {
  this.props(options, fn);
}

/**
 * Get properties
 *
 * read item's content or properties (including metadata) given options
 *
 * @api public
 */
Item.prototype.props = function(options, fn) {

  var self = this;
  var gfs = self.box.gfs;
  var file = self.directory.id + "/" + self._file;
  if ("function" == typeof options) { fn = options }
  fn = fn || noop;
  
  self.versions(function(err, versions){

    if (err) {
      return fn(err);
    }

    if (self.rev != null && self.rev >= 0) {

      var rev = -1;
      for (var i = 0; i < versions.length; i++) {
        var version = versions[i];
        if (version.metadata.revision == self.rev) {
          debug("%s (rev-%s) properties: \n%s\n", version.filename, self.rev, JSON.stringify(version, null, 2));
          return fn(null, version);
        } 
      }

      if (rev < 0) {
        return fn(new OwnBoxError({ message : "version not found", name : "Item.prototype.props"}));
      }

    } else {

      // get the latest file
      gfs.files.findOne({ filename : file }, function(err, latest){
        
        if (err) {
          debug("error retrieving %s properties", file);
          return fn(err);
        }
        
        debug("%s (latest from %s revisions) properties: \n%s\n", latest.filename, versions.length, JSON.stringify(latest, null, 2));
        fn(null, { file : latest, revisions : versions.length});

      });
    }
  });
}

/**
 * Read
 *
 * honors `this._id` then `this.rev` then `this._file`
 * set this._stream as writable stream to pipe out the file's data
 *
 * @api public
 */
Item.prototype.read = function(options, fn) {

  var self = this;

  if (!(typeof options == "function") && options) {
    self._stream = self._stream || options.to;  
  }

  fn = (typeof options == "function") ? options : fn;
  fn = fn || noop; 

  if (!(self._stream instanceof Stream)) throw new OwnBoxError(
    {
      message : "a writable stream to pipe out the data is required \n e.g. to stream out the data to local filesystem,\n var writablestream = fs.createWriteStream(__dirname + \"/file.txt\"); \n box.directory(\"test\").file(\"file.txt\").read({ to : writablestream}, callback)\n",
      name : "OwnBox.Item.read"
    });

  // we have _id? if not, we should have (rev && _file)? ok, at least we should have _file!
  var allowed = self._id || ((self.rev != null) && self._file) || self._file;
  if (!(allowed)) throw TypeError("_id or (rev && file) or file is required");

  // setup the gfs
  var gfs = self.box.gfs;
  var file = self.directory.id + "/" + self._file;

  // pump, pump, pump!
  function _pump(options){
    options.root = self.box.root;
    gfs.createReadStream(options).pipe(self._stream);
  }

  // prepare the output stream
  self._stream.on("close", function(){
    debug("%s is successfully read (rev-%s)", self._id ? self._id.toString() : self._file, (self.rev != null )? self.rev : "latest");
    fn(null, { file : file});
  });

  // when there's error
  self._stream.on("error", function(){
    debug("failed to read %s", self._id ? self._id.toString() : file);
    fn(new OwnBoxError({ message : "error read file", name : "Item.read"}));
  });

  // the first priority _id
  if (self._id) {
    debug("read file of: %s", self._id.toString()); 
    _pump({_id : self._id});
  } else if (self.rev != null && self.rev >=0 ){

    // read file revisions and select the required revision
    debug("read file %s rev-%s", file, self.rev);
    self.versions(function(err, result){
      
      var idx = -1;
      for (var i = 0; i < result.length; i++) {
        if (result[i].metadata.revision == self.rev) {
          idx = i;
          break;
        }
      }

      if (idx >= 0 && idx < result.length) {
        var _id = result[idx]._id;      
        _pump({_id : _id});

      } else {
        debug("revision %s of %s is not found", self.rev, file);
        return fn(new OwnBoxError({ message : "file revision not found", name : "Item.read" }));
      }
    });
  } else {
    // we should have _file here to get the latest revision
    debug("read file : %s", file);
    _pump({filename : file});
  }
}

/**
 * Symbolic link a file. Put aliases
 *
 * @api public
 */
Item.prototype.symlink = function(options, fn) {

  var self = this;
  var gfs = self.box.gfs;
  var file = self.directory.id + "/" + self._file;

  if (!options) {
    throw new OwnBoxError({ message : "symlink settings required", name : "OwnBox.Item.symlink"});
  }

  if (!options.to) {
    throw new OwnBoxError({ message : "symlink destination required. call symlink({ to : \"path/to/link\"})", name : "OwnBox.Item.symlink"}); 
  }

  var destination = options.to;

  debug("OwnBox.Item.symlink is not implemented yet");
  throw new OwnBoxError({ message : "Not implemented yet", name : "OwnBox.Item.symlink"});

}

/**
 * Copy file.
 *
 * by _id, by filename + rev, by filename (latest, all revisions)
 * general rules:
 *  - copy inside current user tree (unless forced to copy outside user dir, create consecutive dirs, replace another file)
 *  - honors revisions
 *  - copy all or copy latest version. by default, copy only latest version
 *
 * @api public
 */
Item.prototype.copy = function(options, fn) {

  var self = this;
  var gfs = self.box.gfs;
  var file = self.directory.id + "/" + self._file;

  fn = fn || noop;

  if (!options) {
    throw new OwnBoxError({ message : "copy settings required", name : "OwnBox.Item.copy"});
  }

  if (!options.to) {
    throw new OwnBoxError({ message : "copy destination required. call copy({ to : \"path/to/link\"})", name : "OwnBox.Item.copy"}); 
  }

  var destination = options.to;
  var dirname = path.dirname(destination);
  var basename = path.basename(destination);

  var hasParts = self.directory.hasParts(dirname);

  var root = self.root(dirname);

  if (!root.abs) {
    dirname = self.directory.id;
    basename = destination;
  }

  debug("try to copy %s to %s", file, destination);

  self.box.directory(dirname).file(basename).versions(function(err, result){
    
    if (result.length > 0) {
      debug("%s exists", destination);
      return new OwnBoxError({ message : "destination exists", name : "OwnBox.Item.copy"});
    }
    debug(" `-- %s doesn't exists. it's ok to copy the file here", destination);

    function taskCopy(props) {
      if (options.all) {

        // TODO: loop all files in self.versions(), create readStream with _ids, then write
        throw new OwnBoxError({ message : "not yet implemented copy with { all : 1 }", name : "OwnBox.Item.copy"});

      } else {

        props.root = self.box.root;
        self._stream = gfs.createWriteStream(props);
        self.read(function(err, res){

          if (err) {
            debug("failed to copy % (rev-%) to %s", file, self.rev || "latest", props.metadata.filename);
          } else {
            debug("%s (rev-%s) copied to %s", file, self.rev || "latest", props.metadata.filename);
          }

          fn(err, res);

        });
      }
    }

    self.props(function(err, version){

      var properties = {
        filename : destination,
        content_type : version.file.contentType,
        mode : "w",
        metadata : version.file.metadata
      }

      var metaDir = path.dirname(destination);
      properties.metadata.basename = path.basename(destination);
      properties.metadata.dirname =  metaDir + "/";

      debug("destination file properties: \n%s\n", JSON.stringify(properties, null,2)); 

      self.directory.exists(metaDir, function(err, exists){
        if (!exists) {

          if (options.silent){
            self.box.directory(metaDir).create({ silent : true}, function(err, result){
              taskCopy(properties);
            });
          }
          else{
            debug("however, %s doesn't exists. set {silent : 1} to create it", metaDir);
            return fn(new OwnBoxError({ message : metaDir + " doesn't exists", name : "OwnBox.item.copy"}));  
          }
        } else {
          taskCopy(properties);
        }
      });
    });
  });  
}

/**
 * Share file.
 *
 * TODO: updating metadata as common task
 *
 * @api public
 */
Item.prototype.share = function(options, fn){
  
  var self = this;
  var gfs = self.box.gfs;
  var file = self.directory.id + "/" + self._file;

  if (!options) {
    throw new OwnBoxError({ message : "share settings required", name : "OwnBox.Item.Share"});
  }

  if (!options.to) {
    throw new OwnBoxError({ message : "recipients required", name : "OwnBox.Item.Share"});
  }
  var users = options.to;

  function contains(a, obj, key) {
    var i = a.length;
    while (i--) {
       if (a[i][key] === obj[key]) {
           return i;
       }
    }
    return -1;
  } 

  self.versions(function(err, versions) {
    var index = -1;
    var data = [];

    for (var i = 0; i < versions.length; i++) {
      var file = versions[i];

      if (self.rev != null && self.rev >= 0) {
        if (self.rev != versions[i].metadata.revision) {
          continue;
        } else {
          index = i;
        }
      }

      file.metadata.sharedTo = file.metadata.sharedTo || [];      
      
      for (var j = 0; j < users.length; j++) {
        var user = users[j];
        var idx = contains(file.metadata.sharedTo, user, "user");

        if (idx >= 0) {
          file.metadata.sharedTo[idx] = user;
        } else {
          file.metadata.sharedTo.push(user);  
        }
        
      }

      data.push(versions[i]);
    }

    if (data.length > 0) {

      function update(item, cb){
        gfs.files.update({ _id : item._id}, item, { w: 1}, cb);
      }

      async.map(data, update, function(err, res){
        fn(err, res);
      });

    } else {
      fn(new OwnBoxError("unable to share"));
    }

  });
}

// @api public
Item.prototype.move = function(to, force, fn){
  debug("OwnBox.Item.move is not implemented yet");
  throw new OwnBoxError({ message : "Not implemented yet", name : "OwnBox.Item.move"});
}

// @api public
Item.prototype.remove = function(fn){
  debug("OwnBox.Item.remove is not implemented yet");
  throw new OwnBoxError({ message : "Not implemented yet", name : "OwnBox.Item.remove"});
}

Item.prototype.destroy = function(fn){
  var self = this;
  var gfs = self.box.gfs;
  var file = self.directory.id + "/" + self._file;
  fn = fn || noop;

  function _destroy(options, cb){
    options.root = self.box.root;
    gfs.remove(options, cb);
  }
  
  self.versions(function(err, result){

    var rev = self.rev;
    var idx = -1;
    if (rev != null && rev > 0) {
      for (var i = 0; i < result.length; i++) {
        var f = result[i];
        if (f.metadata.revision == rev) {
          idx = i; 
          break;
        }
      }

      if (idx >= 0) {
        var _id = result[idx]._id;      
        _destroy({_id : _id}, fn);
      }
      else {
        debug("revision %s of %s is not found", rev, file);
        return fn(new OwnBoxError({ message : "file revision not found", name : "Item.read" }));
      }
    } else {
      async.map(result, _destroy, fn);
    }
    
  });
}

Item.prototype.root = function(dir){

  var self = this;

  if (self.directory.isAbsolute(dir)) {
    var parts = dir.split("/");

    if (parts.length > 0) {
      return { abs : true, root : dir[1]};
    } else {
      return { abs : true, root : "unknown"};  
    }
    
  } else {
    return { abs : false, root : self.box.owner.user };
  }
  
}

/**
 * Merge `obj`.
 *
 * @param {Object} obj
 * @api private
 */

Item.prototype.merge = function(obj){
  for (var key in obj) {
    this[key] = obj[key];
  }
};