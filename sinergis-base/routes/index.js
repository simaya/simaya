module.exports = function(app) {
  var session = require('../sinergis/controller/session.js')(app)
    , utils = require('../sinergis/controller/utils.js')(app)
    , forgotPassword = require('../sinergis/controller/forgot-password.js')(app)
    , captcha = require('../sinergis/controller/captcha.js')(app)
    , admin = require('../sinergis/controller/admin.js')(app)

  app.get('/', utils.requireLogin, session.index);
  app.get('/signout', session.logout);
  app.get('/login', session.login);
  app.post('/login', session.login);

  app.get('/forgot-password', forgotPassword.start);
  app.post('/forgot-password', forgotPassword.start);

  app.get('/captcha/:id', captcha.display);
  app.all('/restricted', utils.requireLogin, utils.restricted);

  app.all('/admin*', utils.requireAdmin);
  app.get('/admin', utils.requireLogin, admin.index);
  app.get('/admin/user', utils.requireLogin, admin.user);
  app.get('/admin/role', utils.requireLogin, admin.role);
  app.get('/admin/new-role', utils.requireLogin, admin.newRole);
  app.post('/admin/new-role', utils.requireLogin, admin.newRole);

  app.get('/admin/edit-role/:id', utils.requireLogin, admin.editRole);
  app.get('/admin/edit-role', utils.requireLogin, admin.role);
  app.post('/admin/edit-role', utils.requireLogin, admin.editRole);

  app.get('/admin/new-user', utils.requireLogin, admin.newUser);
  app.post('/admin/new-user', utils.requireLogin, admin.newUser);

  app.get('/admin/edit-user/:id', utils.requireLogin, admin.editUser);
  app.get('/admin/edit-user', utils.requireLogin, admin.user);
  app.post('/admin/edit-user', utils.requireLogin, admin.editUser);

  app.get('/admin/change-password/:id', utils.requireLogin, admin.changePassword);
  app.get('/admin/change-password', utils.requireLogin, admin.user);
  app.post('/admin/change-password', utils.requireLogin, admin.changePassword);

  app.get('/admin/email-list/:id', utils.requireLogin, admin.emailList);
  app.get('/admin/email-list', utils.requireLogin, admin.user);
  app.post('/admin/email-list', utils.requireLogin, admin.emailList);

  app.get('/admin/associate-role/:id', utils.requireLogin, admin.associateRole);
  app.get('/admin/associate-role', utils.requireLogin, admin.user);
  app.post('/admin/associate-role', utils.requireLogin, admin.associateRole);
}
