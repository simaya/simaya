module.exports = function(app) {
  var utils = require('./utils.js')(app)
    , forgotPassword = require('../models/forgot-password.js')(app)
    , user= require('../models/user.js')(app)
    , sinergisVar = app.get('sinergisVar')
    , nodemailer = require("nodemailer")

  var start = function(req, res) {
    var vals = {
      title: 'Forgot password',
    }
    vals.form = true;
    if (typeof(req.body.user) !== "undefined") {
      user.getUserFromEmail(req.body.user.email, function(username) {
        if (req.body.user.user == username) {
          forgotPassword.create(req.body.user.user, req.body.user.email, function(token, code, validator) {
            if (typeof(token) !== "undefined"
              && typeof(code) !== "undefined") {
              vals.successful = true;
              vals.form = false;

              var mailOptions = {
                from: app.simaya.administratorEmail,
                to: req.body.user.email,
                subject: 'Aktivasi sandi baru',
                text: 'Silakan aktivasi sandi baru Anda di alamat ' + app.simaya.url + '/forgot-password/activate\n\nIsikan dengan informasi berikut:\nKode token: ' + token + '\nKode verifikasi: ' + code + '\n' 

              }
              var smtp = nodemailer.createTransport ( 'SMTP', app.simaya.smtp );
              smtp.sendMail(mailOptions, function(e, response) {
                utils.render(req, res, 'forgot-password', vals, 'base-not-authenticated');
                smtp.close();
              });
            } else {
              utils.render(req, res, 'forgot-password', vals, 'base-not-authenticated');
            }
          });
        } else {
          vals.wrongCombination = true;
          vals.username = req.body.user.user;
          vals.email = req.body.user.email;
          utils.render(req, res, 'forgot-password', vals, 'base-not-authenticated');
        }
      });
    } else {
      utils.render(req, res, 'forgot-password', vals, 'base-not-authenticated');
    }
  };

  var activate = function(req, res) {
    var vals = {
      title: 'Forgot password',
    }
    
    vals.token = req.params.token || req.body.token;
    vals.code = req.params.code || req.body.code;

    if (vals.token && vals.code) {
      forgotPassword.activate(vals.token, vals.code, function(result) {
        if (req.body.password1 != req.body.password2) {
          vals.form = true;
          vals.mismatch = true;
        } else {
          if (result.result == true) {
            user.changePassword(result.username, req.body.password1, function(v) {
              if (v.hasError()) {
                vals.systemError = true;
              } else {
                vals.successful = true;
              }
              utils.render(req, res, 'forgot-password-activate', vals, 'base-not-authenticated');
            });
          } else {
            vals.unsuccessful = true;
            vals.form = true;
          }
        }
        utils.render(req, res, 'forgot-password-activate', vals, 'base-not-authenticated');
      });
    } else {
      vals.form = true;
      utils.render(req, res, 'forgot-password-activate', vals, 'base-not-authenticated');
    }
  }

  return {
    start: start
    , activate: activate

  }
};
