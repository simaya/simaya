var CollectionLock = function(app) {
  if (!(this instanceof CollectionLock)) return new CollectionLock(app);
  if (!app) throw new TypeError("settings required");
  this.app = app;
  this.db = app.db;
  this.ObjectID = app.ObjectID;

  this.model = this.db("collectionLock");
}

CollectionLock.prototype.start = function(options, fn) {
  var self = this;
  var key = new self.ObjectID();

  var data = {
    date: new Date,
    expire: options.expire, 
    username: options.username,
    name: options.name,
    module: options.module,
    key: key
  }

  self.model.ensureIndex({ name: 1 }, { unique: true, background: true }, function() {
    self.model.insert(data, function(err, result) {
      if (err) return fn(err);
      return fn(null, { key: key})
    });
  });
}

CollectionLock.prototype.finish = function(options, fn) {
  var self = this;

  self.model.remove({ name: options.name, username: options.username, key: self.ObjectID(options.key) }, {w:1}, function(err, result) {
    if (err) return fn(err);
    if (result == 0) return fn(new Error("lock not found"));
    return fn(null);
  });
}

CollectionLock.prototype.check = function(options, fn) {
  var self = this;

  self.model.findOne({ name: options.name }, function(err, result) {
    if (err) return fn(err);
    if (result) {
      return fn(null, {
        name: result.name,
        username: result.username,
        module: result.module,
        expire: result.expire
      });
    }
    return fn(new Error("lock not found"));
  });
}

module.exports = function(app){
  return CollectionLock(app);
}
