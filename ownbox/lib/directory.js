/**
 * Module dependencies.
 */

var Item = require("./item");
var OwnBoxError = require("./error");
var Emitter = require("events").EventEmitter;
var inherits = require("util").inherits;
var async = require("async");
var path = require("path");
var debug = require("debug")("directory");

// defines
var OB_CONTENT_TYPES = {
  directory : "application/directory.ownbox"
};

var noop = function(){}

/**
 * Expose `Directory`.
 * 
 * Public APIs:
 *
 * [new] Directory()
 *
 * .file()
 * .stream()
 * .item()
 * .items()
 * 
 * .create()
 * .destroy()
 * .remove()
 * .move()
 * .copy()
 * .rename()
 * .share()
 *
 */

module.exports = Directory;

/**
 * Initialize a new `directory` with the given options:
 *
 *  - `id` mandatory string id as directory title
 *
 * Example:
 *
 * @param {Object} options
 * @api public
 */
function Directory(options) {
  if (!(this instanceof Directory)) return new Directory(options);
  if (!options) throw new TypeError("directory settings required");

  this.merge(options);
  this._items = [];

  // we only use absolute path, force it!
  // TODO: if it has no `id`, then generate it using uuid
  this.id = this.absolute(this.id, this.box.owner.user);

  debug("box root in dir: %s", this.box.root);
}

inherits(Directory, Emitter);

/**
 * Initialize a new `Item (type=file)` with the given options:
 *
 *  - `file` mandatory string id as file title
 *
 * Example:
 *
 * @param {String} file
 * @param {Object} options
 * @api public
 */
Directory.prototype.file = function(file, options){
  return this.item(options).file(file);
};

/**
 * Initialize a new `Item (type=readable stream)` with the given options:
 *
 *  - `file` mandatory string id as file title
 *  - `options._stream` mandatory readable stream 
 *
 * Example:
 *
 * @param {String} file
 * @param {Object} options
 * @api public
 */
Directory.prototype.stream = function(file, options){
  return this.item(options).stream(file);
};

/**
 * Initialize a new `Item ()` with the given options:
 *
 * Example:
 *
 * @param {Object} options
 * @api public
 */
Directory.prototype.item = function(options) {
  if ("string" == typeof options) options = { id : options };
  options = options || {};
  options.directory = this;
  var item = new Item(options);
  this._items.push(item);
  this.emit("item", item);
  return item;
}

/**
 * Put multiple items
 *
 * @api public
 */
Directory.prototype.putItems = function(fn){
  
  /*

  TODO: multiple files writing
  something like this:
    var self = this;
    var items = this._items;
    items.forEach(function(item){
      item.put(function(err){});
    });
  */

  debug("OwnBox.Directory.putItems is not implemented yet");
  throw new OwnBoxError({ message : "Not implemented yet", name : "OwnBox.Directory.putItems"});
}

/**
 * List out the first level items inside the `option.name` with mandatory callback `fn`
 *
 * @param {Object} obj
 * @param {Function} [fn] 
 * @api public
 */
Directory.prototype.items = function(options, fn) {
  fn = (typeof options == "function") ? options : fn;
  fn = fn || noop;
  var self = this;
  options = options || {};
  self.inspect(options, fn);
}

/**
 * Create a directory given `self.id` as its path .
 *
 * @param {Object} options
 * @param {Function} [fn] 
 * @api public
 */
Directory.prototype.create = function(options, fn) {

  var self = this;
  fn = (typeof options == "function") ? options : fn;
  fn = fn || noop;
  var subdirs = self.subdirs(self.id);

  // check whether all subdirs exist in db
  self.batchExists(subdirs, function(err, result){

    // get the first index of subdir that doesn't exist
    var falseIndex = result.indexOf(false);

    // if we have subdirs that doesn't exist
    if (falseIndex >= 0) {

      // cleanup the `gfs` property from `subdir` objects. (gfs is attached to each subdir to let async method access the db)
      subdirs = self.removeKey(subdirs, "gfs").slice(result.indexOf(false), subdirs.length);

      // prepare for creating the subdirs (which builds the path i.e. the directory id -> self.id)
      debug("creating %s ...", self.id);

      // create the dirs
      self.createDirs(subdirs, function(err, result){

        if (err) {
          return fn(err);
        }

        // handle error and re-map the result
        var obj = {
          dir : self.id,
          result : result
        };

        // tell the caller with `null` error
        debug("%s created", self.id);
        fn(null, obj);
      });

    } else {

      var silent = false;
      
      if(options && (typeof options != "function")) {
        silent = options.silent;
      }

      debug("%s exist, and throw error? %s", self.id, !silent);

      // tell the caller
      fn(silent ? null : (new OwnBoxError(self.id + " exists")), { dir : self.id });
    }

  });
}

/**
 * Destroy a directory and its contents (hard destroy, nuke, seriously wipe the data from db).
 *
 * @param {Function} [fn]
 * @api public
 */
Directory.prototype.destroy = function(fn) {
  
  var self = this;
  var gfs = self.box.gfs;
  fn = fn || noop;

  debug("try to nuke %s", self.id);

  var pattern = "(" + self.id.split("/").join("\\/") + ")";
  var dirname = new RegExp(pattern);

  // suicide action
  function suicide(){
    debug("%s is attempting suicide", self.id);
    gfs.remove({ filename : self.id, root : self.box.root }, fn);
  }

  gfs.files.find({ "metadata.dirname" : dirname }).toArray(function(err, files){
    if (err || files == null) {
      return fn(err);
    }
    debug("%s has %s children, it tries to kill its children before the nuke day", self.id, files.length);

    files = files || [];

    if (files.length > 0) {

      // parallel  destroy, set files, gfs and root to async's context
      self.mapDestroy({ files : files, gfs : gfs, root : self.box.root }, function(err, result){
        if (err) {
          return fn(err);
        }

        // ok it is a good time to say goodbye
        suicide();

      });  
    } else {
      // an empty dir. hey dir, please kill yourself!
      suicide();
    }
    
  });
}

/**
 * Remove `directory`.
 *
 * @api public
 */
Directory.prototype.remove = function(fn) {
  // recursively remove all related file, or move to thrash dir, e.g. /box.owner.user/thrash and add meta data from
  debug("OwnBox.Directory.remove is not implemented yet");
  throw new OwnBoxError({ message : "Not implemented yet", name : "OwnBox.Directory.remove"});
}

/**
 * Move
 *
 * @api public
 */
Directory.prototype.move = function(options, fn) {

  if (!options) throw TypeError("move definition required");
  if (!options.to) throw TypeError("move destination required, set { to : \"destination/path\"}");

  var self = this;
  var moveTo = options.to;
  var hasParts = false;
  var isAbs = false;
  fn = fn || noop;

  if (self.isAbsolute(moveTo)) {
    debug("%s is absolute path", moveTo);
    isAbs = true;
  }

  if (self.hasParts(moveTo)) {
    debug("%s has parts", moveTo);
    hasParts = true;
  }

  if (isAbs) {
    
    // TODO: check user's root folder
    debug("destination is an absolute path, possibly outside user's dir"); 
    throw new OwnBoxError({ message : "Not implemented yet", name : "OwnBox.Directory.move"});

  } else {
    // it is not an absolute path, it will work in current dir
    if (hasParts) {

      debug("inside current dir, and create subdirs");

      var destination = path.dirname(self.id) + "/" + moveTo;
      var delta = path.dirname(self.id) + "/" + moveTo.substr(0, moveTo.lastIndexOf("/"));

      self.box.directory(delta).create({ silent : true}, function(err, result){
        self.rename({ to : moveTo, silent : true}, fn);
      });

    } else {
      debug("inside current dir, then rename() hopefully will be fine");
      self.rename({to : moveTo}, fn);
    }
  }
}


/**
 * Copy
 *
 * @api public
 */
Directory.prototype.copy = function(options, fn) {
  // recursively copy all dir contents to `to`-dir
  debug("OwnBox.Directory.copy is not implemented yet");
  throw new OwnBoxError({ message : "Not implemented yet", name : "OwnBox.Directory.copy"});
}

/**
 * Rename `directory`.
 *
 * @api public
 */
Directory.prototype.rename = function(options, fn) {

  var self = this;
  var gfs = self.box.gfs;
  var pattern = "(" + self.id.split("/").join("\\/") + ")";
  var dirname = new RegExp(pattern);
  var renameTo = path.dirname(self.id) + "/" + options.to;
  fn = fn || noop;

  // don't rename if it is the same thing
  if (renameTo == self.id) {
    debug("`%s` and `%s` are the same thing, aren't they?", renameTo, self.id);
    return fn (new OwnBoxError({ message : "cannot rename with the same name", name : "Directory.rename"}));
  }

  // checking for destination existence
  self.exists({ filename : renameTo}, function(err, exists){
    
    if (err) {
      debug("something wrong when checking %s existence", renameTo);
      return fn(err);
    }
    
    // if the destination exists
    if (exists && !options.silent) {
      debug("%s exists", renameTo);
      return fn (new OwnBoxError(renameTo + " exists"));
    } 

    // items to find
    var items = {
      $or : [
        { "filename" : self.id},
        { "metadata.dirname" : dirname}
      ]
    };

    debug("try to rename %s to %s", self.id, renameTo);

    // try to find the old dir and its related childrens and rename it
    gfs.files.find(items).toArray(function(err, result){
      
      if (err) {
        return fn(err);
      }

      if (result.length > 0) {
        self.mapRename({ items : result, renameTo : renameTo, files : gfs.files }, fn);  
      } else {
        debug("%s doesn't exist", self.id);
        fn (new OwnBoxError({ message : "not found", name : "Directory.rename"}));
      }
    });
  });
}

/**
 * Share `directory`.
 *
 * @api public
 */
Directory.prototype.share = function(options, fn) {
  // recursively copy all dir contents to `to`-dir
  // debug("OwnBox.Directory.share is not implemented yet");
  // throw new OwnBoxError({ message : "Not implemented yet", name : "OwnBox.Directory.share"});

  // todo throw when there is no "options.to"

  var self = this;
  var gfs = self.box.gfs;
  var to = options.to || []; // temporary

  function shareTo(item, cb){
    gfs.files.update({ _id : item._id}, item, { w : 1}, cb);  
  }

  // temporary array unique
  function arrayUnique(array) {
    var a = array.concat();
    for(var i=0; i<a.length; ++i) {
        for(var j=i+1; j<a.length; ++j) {
            if(a[i] === a[j])
                a.splice(j--, 1);
        }
    }
    return a;
  };

  // find files
  gfs.files.find({ "metadata.dirname" : this.id + "/"}).toArray(function(err, result){

    if (err) return fn(err);

    for (var i = 0; i < options.to.length; i++) {
      options.to[i].rights = "rws";
    }

    for (var i = 0; i < result.length; i++) {
      result[i].metadata.sharedTo = result[i].metadata.sharedTo || [];
      result[i].metadata.sharedTo = arrayUnique(result[i].metadata.sharedTo.concat(options.to));
    }

    async.map(result, shareTo, function(err){

      if (err) return fn(err);

      gfs.files.findOne({ filename : self.id }, function(err, item){

        if (err) return fn(err);

        item.metadata.sharedTo = item.metadata.sharedTo || [];
        item.metadata.sharedTo = arrayUnique(item.metadata.sharedTo.concat(options.to));

        gfs.files.update({ _id : item._id}, item, { w : 1}, fn);
      });
    })
  });
}

/**
 * Check whether a `directory` exists with the given options:
 *
 * - `filename` directory absolute path (misleading 'eh?, well we can use it to check file's or any other paths existence too)
 * - `gfs` GridFs handle (needed for async process or when the context is not `this`)
 * 
 * @api public
 */
Directory.prototype.exists = function(dir, fn) {
  
  dir = dir || { filename : this.id };
  var box = this.box || {};
  var gfs = box.gfs || dir.gfs;
  var files = gfs.files;
  files.findOne({ filename : dir.filename}, function(err, result) { 
    fn(err, result != null);
  });
}

// privates start here

/**
 * Update `directory` data.
 *
 * @api private
 */
Directory.prototype.update = function(options, fn) {
  var box = this.box || {};
  var gfs = box.gfs || options.gfs;
}


/**
 * Return `directory` absolute path.
 *
 * @api private
 */
Directory.prototype.absolute = function(dir, owner) {

  var self = this;
  var parts = dir.split("/");
  var absPath;

  if (dir[0] == "/" && parts.length > 1) {
    if (parts[1] != owner) {
      debug("%s is invalid directory path", dir);
    } else {
      absPath = dir;
    }
  } else {
    absPath = self.build(owner, dir);
  }

  debug("current directory absolute path: %s", absPath);

  return absPath;
}

/**
 * Merge `obj`.
 *
 * @param {Object} obj
 * @api private
 */
Directory.prototype.merge = function(obj){
  for (var key in obj) this[key] = obj[key];
};

/**
 * Arrange directory items in order.
 *
 * @param {Object} err
 * @param {Array} list
 * @param {Function} fn
 * @api private
 */
Directory.prototype.arrange = function(err, list, fn) {

  if (err) {
    return fn (new OwnBoxError("the list is messy", "Directory.arrange"));
  }

  // TODO: group the same filename, build tree
  // debug("%s", JSON.stringify(list, null, 2));
  var rows = {};
  for (var i = 0; i < list.length; i++) {
    var item = list[i];
    rows[item.filename] = rows[item.filename] || { revisions : [] }
    rows[item.filename].revisions.push(item);
  }

  var files = Object.keys(rows);

  debug("%s (%s items)", this.id, files.length);

  if (process.env.DEBUG) {
    for (var i = 0; i < files.length; i++) {
      var revs = rows[files[i]].revisions;
      var type = "";
      var owner = "";
      if (revs.length > 0) {
        type = revs[0].contentType;
        owner = revs[0].metadata.owner.user;
      }
      debug("  `-- %s (%s revisions) %s %s", files[i], revs.length, type, owner);
    }
  }

  fn(err, rows);
}

// @api private
Directory.prototype.inspect = function(options, fn){
  var self = this;
  options.query = options.query || {};
  var gfs = self.box.gfs;
  var files = gfs.files;
  options.query["metadata.dirname"] = self.id + "/";
  files.find(options.query).toArray(function(err, list){ self.arrange(err, list, fn); });
}

// @api private
Directory.prototype.build = function(){
  var p = "";
  for(var i = 0; i < arguments.length; i++) {
    p += "/" + arguments[i];
  }
  return p;
}

// @api private
Directory.prototype.subdirs = function(subpath){
  
  var self = this;
  
  var parts = subpath.split("/");
  var subs = [];

  var subdir = "";
  for (var i = 1; i < parts.length; i++) {

    subdir += "/" + parts[i];

    // filename, uploadDate, contentType (application/directory.ownbox)
    // metadata.basename, metadata.dirname, metadata.owner
    dirname = path.dirname(subdir);
    var dir = {
      filename : subdir,
      uploadDate : new Date,
      contentType : OB_CONTENT_TYPES.directory,
      gfs : self.box.gfs,
      metadata : {
        basename : path.basename(subdir),
        dirname : ((dirname == "/") ? "/" : (dirname + "/")), // if root, we don't have to put another "/"
        owner : self.box.owner
      }
    }

    subs.push(dir);
  }

  return subs;
}

// @api private
Directory.prototype.batchExists = function(dirs, fn) {
  async.map(dirs, this.exists, fn);
}
  
// @api private
Directory.prototype.removeKey = function(arr, key) {
  for (var i = 0; i < arr.length; i++) {
    delete arr[i][key];
  }
  return arr;
}

Directory.prototype.mapRename = function(options, fn) {
  
  var self = this;
  var items = options.items;
  var renameTo = options.renameTo;

  var updatedItems = [];
  for (var i = 0; i < items.length; i++) {
    var item = items[i];

    item.previous = {
      filename : item.filename,
      basename : item.metadata.basename,
      dirname : item.metadata.dirname
    };

    item.filename = item.filename.split(self.id).join(renameTo);
    item.metadata.dirname = path.dirname(item.filename) + "/";
    item.metadata.basename = path.basename(item.filename);
    
    item.modifiedDate = new Date;

    updatedItems.push({ item : item, files : options.files });
  }

  // async map update items
  async.map(updatedItems, self.asyncRename, fn);
}

Directory.prototype.asyncRename = function(options, fn) {

  var item = options.item;
  var files = options.files;

  debug("renaming %s to %s", item.previous.filename, item.filename);
  files.update({ _id : item._id}, item, { w : 1}, fn);
}

Directory.prototype.mapDestroy = function(options, fn) {
  
  var self = this;
  fn = fn || noop; 
  
  var files = [];
  
  for (var i = 0; i < options.files.length; i++) {
    var file = { _id : options.files[i]._id, gfs : options.gfs, root : options.root, filename : options.files[i].filename }
    files.push(file);
  }

  async.map(files, self.asyncDestroy, fn);
}

Directory.prototype.asyncDestroy = function(options, fn){
  
  var self = this;
  var box = self.box || {}
  var gfs = box.gfs || options.gfs;
  var file = options.filename;
  var _id = options._id;

  debug("wiping %s from %s.files and %s.chunks", file, options.root , options.root);


  // set remove root db context
  gfs.remove({ _id : _id, root : options.root }, fn);
}

// @api private
Directory.prototype.createDirs = function(dirs, fn) {
  var gfs = this.box.gfs;
  var files = gfs.files;
  files.insert(dirs, { w : 1}, fn);
}

Directory.prototype.hasParts = function(dir) {
  return (dir.lastIndexOf("/") > 0);
}

Directory.prototype.isAbsolute = function(dir) {
  return dir[0] == "/";
}