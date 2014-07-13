/**
 * Module dependencies.
 */
var Grid = require("gridfs-stream");
var Directory = require("./directory");
var pkg = require("../package");
var debug = require("debug")("box");

/**
 * Constants
 */
var OWNBOX_ROOT = "ownbox";

/**
 * Expose `Box`.
 * 
 * Public APIs:
 *
 * [new] Box()
 *
 * .setup()
 * .directory()
 *
 */

exports = module.exports = OwnBox;

/**
 * Initialize a new box with the given options:
 *
 *    var options = {
 *      owner : {
 *        user : "username",
 *        profile : {
 *          fullname : "User Fullname",
 *          email : "user@email.com",
 *          avatar : "http://avatar.com/user.jpg"
 *           ...
 *         }
 *       }
 *     }
 *     
 *     var box = OwnBox(options);
 *     
 *     // if no mongo and db in options
 *     box.setup(db,mongo);
 *
 *  - `owner` an object describing box owner, owner at least has `user` and `profile`
 *  - `db` a valid and opened mongo.Db connection. This is optional at this stage. 
 *  - `mongo` the driver we are using. This is optional at this stage. 
 *
 * @param {Object} options
 * @api public
 */

function OwnBox(options) {
  if (!(this instanceof OwnBox)) return new OwnBox(options);
  if (!options) throw new TypeError("box settings required");
  if (!options.owner) throw new TypeError("box owner required");
  if (!options.owner.user) throw new TypeError("box owner user required");
  this.version = pkg.version;

  this.owner = options.owner;
  this.root = options.root || OWNBOX_ROOT;

  // only when `option.db` is open
  if (options.db && options.mongo) {
    this.setup(options.db, options.mongo);
  }
}

/**
 * Setup a new box to have connection to `db` (which instanceof `mongo`). 
 * We have to be sure that db is open.
 * 
 * The arguments:
 *  - `db` a valid and open mongo.Db connection
 *  - `mongo` the driver we are using
 * 
 * @param {Object} options
 * @api public
 */
OwnBox.prototype.setup = function(db, mongo) {
  if (!(db instanceof mongo.Db)) throw new TypeError("db as instanceof mongo.Db required");
  if (!db.serverConfig.isConnected()) throw new OwnBoxError({ message : "db is not connected", name : "OwnBox.setup" });
  this.gfs = Grid(db, mongo);
  this.gfs._col = this.gfs.collection(this.root);
  debug("current box root: %s", this.root);
}

/**
 * Get `directory`.
 */
OwnBox.prototype.directory = function(options) {
  options = options || {};

  if ("string" == typeof options) {
    options = { id : options };
  }

  options.id = options.id || "/" + this.owner.user;
  options.id = options.id == "/" ? "/" + this.owner.user : options.id;
  options.id = options.id == "." ? "/" + this.owner.user : options.id;
  options.box = this;
  return new Directory(options);
}

OwnBox.prototype.shared = function(fn) {
  var self = this;
  var gfs = self.gfs;
  var ownedAndShared = { $and : [ { "metadata.owner.user" : self.owner.user }, { "metadata.sharedTo" : { $exists : true} } ]};
  var sharedWithMe = { "metadata.sharedTo.user" : self.owner.user };
  var sharedItems = { $or : [ ownedAndShared, sharedWithMe]};

  gfs.files.find(sharedItems).toArray(function(err, result){
    var dir = self.directory("shared");
    dir.arrange(err, result, fn);
  });
}

console.log("ownbox: " + pkg.version);
