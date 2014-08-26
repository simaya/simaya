module.exports = function(app) {
  var utils = require('../simaya/controller/utils.js')(app)
    , sinergisUtils = require('../sinergis/controller/utils.js')(app)
    , admin = require('../simaya/controller/localadmin.js')(app)
    , adminSimaya = require('../simaya/controller/admin.js')(app)

  app.all('/localadmin*', utils.requireLocalAdmin);
  app.get('/localadmin', sinergisUtils.requireLogin, admin.index);
  app.get('/localadmin/user', sinergisUtils.requireLogin, admin.user);
  app.get('/localadmin/admin', sinergisUtils.requireLogin, admin.admin);
  app.get('/localadmin/admin-structure', sinergisUtils.requireLogin, adminSimaya.adminStructure);

  app.get('/localadmin/new-user', sinergisUtils.requireLogin, admin.newUser);
  app.post('/localadmin/new-user', sinergisUtils.requireLogin, admin.newUser);

  app.get('/localadmin/edit-user/:id', sinergisUtils.requireLogin, admin.editUser);
  app.post('/localadmin/edit-user', sinergisUtils.requireLogin, admin.editUser);

  app.get('/localadmin/user-in-org', sinergisUtils.requireLogin, adminSimaya.userListInOrgJSON);
  app.post('/localadmin/head-in-org', sinergisUtils.requireLogin, adminSimaya.headInOrgJSON);
  app.del('/localadmin/head-in-org', sinergisUtils.requireLogin, adminSimaya.removeHeadInOrg);
  app.all('/localadmin/job-title', sinergisUtils.requireLogin, admin.listTitle);
  app.post('/localadmin/remove-title', sinergisUtils.requireLogin, admin.removeTitle);
  app.post('/localadmin/edit-title', sinergisUtils.requireLogin, admin.editTitle);
  app.post('/localadmin/new-title', sinergisUtils.requireLogin, admin.newTitle);

  app.all('/localadmin/new-user', sinergisUtils.requireLogin, adminSimaya.newUser);
  app.all('/localadmin/remove-users', sinergisUtils.requireLogin, adminSimaya.removeUsers);

  app.get('/localadmin/change-password/:id', sinergisUtils.requireLogin, admin.changePassword);
  app.get('/localadmin/change-password', sinergisUtils.requireLogin, admin.user);
  app.post('/localadmin/change-password', sinergisUtils.requireLogin, admin.changePassword);
  app.get('/localadmin/email-list/:id', sinergisUtils.requireLogin, admin.emailList);
  app.get('/localadmin/email-list', sinergisUtils.requireLogin, admin.user);
  app.post('/localadmin/email-list', sinergisUtils.requireLogin, admin.emailList);

  app.get('/localadmin/associate-role/:id', sinergisUtils.requireLogin, admin.associateRole);
  app.get('/localadmin/associate-role', sinergisUtils.requireLogin, admin.user);
  app.post('/localadmin/associate-role', sinergisUtils.requireLogin, admin.associateRole);

  app.get('/localadmin/stats', sinergisUtils.requireLogin, admin.stats);

  app.get('/localadmin/phones/:id', admin.phones);
  app.post('/localadmin/phones/:id', admin.phones);

  app.get('/localadmin/node', sinergisUtils.requireLogin, admin.getNode);
  app.post('/localadmin/node', sinergisUtils.requireLogin, admin.putNode);
}
