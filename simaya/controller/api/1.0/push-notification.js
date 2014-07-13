module.exports = function(app) {
  var notification = require('../../../models/push-notification.js')(app)
    
  var register = function(req, res) {
    if (req.body.uuid && req.body.token && req.body.type) {
      var me = req.session.currentUser;
      notification.set(me, req.body.type, req.body.uuid, req.body.token, function(r) {
        res.send({result: "OK"})
      });
    } else {
      res.send({result: "ERROR"})
    }
  }
   
  return {
    register: register,
  }
};
