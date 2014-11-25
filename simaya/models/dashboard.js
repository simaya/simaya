/**
 * @param {Object} app root object of this express app 
 */
var Dashboard = function (app){
  if (!(this instanceof Dashboard)) return new Dashboard(app);
  if (!app) throw new TypeError("settings required");
  this.app = app;
  this.db = app.db;
  this.ObjectID = app.ObjectID;

}

Dashboard.prototype.letterStat = function(options, fn) {
  var Letter = this.db("letter");
  Letter.find(options.search, {}, function(err, cursor) {
    if (err) return fn(err);

    cursor.count(false, function(err, count) {
      if (err) return fn(err);
      fn(null, {
        type: "letter-stat",
        count: count
      });
    });
  });
}

module.exports = function (app){
  return Dashboard(app);
}
