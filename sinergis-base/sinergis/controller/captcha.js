module.exports = function(app) {
  var utils = require('./utils.js')(app)
    , captcha = require('../models/captcha.js')(app)
    , sinergisVar = app.get('sinergisVar');

  var display = function(req, res) {
    var vals = {
    }
    if (req.params.id) {
      res.contentType('image/png');
      captcha.render(req.params.id, res);
    }
  };

  return {
    display: display
  }
};
