module.exports = register;

var PrintControl = function(app) {
  if (!(this instanceof PrintControl)) return new PrintControl(app);
  if (!app) throw new TypeError("settings required");
  this.app = app;
  this.db = app.db;
  this.ObjectID = app.ObjectID;

  this.printControl = this.db("printControl");
}

PrintControl.prototype.insert = function(options, fn) {
  var self = this;

  var data = {
    date: new Date,
    username: options.username,
    type: options.type,
    id: options.id,
    extra: options.extra,
    _id: options._id
  }
  self.printControl.insert(data, fn);
}

PrintControl.prototype.view = function(options, fn) {
  var self = this;

  self.printControl.findOne({_id: self.ObjectID(options.id)}, fn);
}

function register (app){
  return PrintControl(app);
}
