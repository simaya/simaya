module.exports = function(app) {
  var db = app.db("oauth2.authCode");
  var ObjectID = app.ObjectID;

  var set = function (data, callback) {
    // db.oauth2.authCode.ensureIndex({ created_at : 1}, { expireAfterSeconds : 5 * 60 }) // it will be expired after 5 minutes
    db.insert(data, callback);
  }

  var get = function (options, callback) {
    db.findOne(options, callback);
  }

  var del = function (options, callback) {
    db.remove(options, callback);
  }

  return {
    set : set,
    get : get,
    del : del
  }
}