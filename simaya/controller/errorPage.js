module.exports = function(app) {
  var utils = require('../../sinergis/controller/utils.js')(app)
  var err404 = function(req, res) {
    var vals = {};
    if (req.path) {
      if (req.path.indexOf('/localadmin') > -1) {
        utils.render(req, res, '404', vals, 'base-admin-authenticated');
      } else if (req.path.indexOf('/admin') > -1) {
        utils.render(req, res, '404', vals, 'base-admin-authenticated');
      } else {
        utils.render(req, res, '404', vals, 'base-authenticated');
      }
    }
  }
  return {
    err404:err404
  }

}
