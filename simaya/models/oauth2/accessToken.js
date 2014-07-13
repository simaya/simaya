module.exports = function(app) {
  var db = app.db("oauth2.accesToken");
  var ObjectID = app.ObjectID;

  var MONTH = 30;

  var set = function (data, callback) {
    // db.oauth2.accesToken.ensureIndex({ expire_at : 1}, { expireAfterSeconds : 0 }) // set the expiry date
    var date = new Date();
    date.setDate(date.getDate() + MONTH);
    data.expire_at = data.expire_at || date;
    db.insert(data, callback);
  }

  var get = function (options, callback) {
    db.findOne(options, callback);
  }

  var del = function (options, callback) {
    db.remove(options, {w : 1} ,callback);
  }

  return {
    set : set,
    get : get,
    del : del
  }
}