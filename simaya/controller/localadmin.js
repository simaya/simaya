module.exports = function(app) {
  var utils = require('./utils.js')(app)
  , admin = require('../../sinergis/controller/admin.js')(app)
  , user = require('../../sinergis/models/user.js')(app)
  , sinergisUtils = require('../../sinergis/controller/utils.js')(app)
  , adminSimaya = require('./admin.js')(app)
  , jobTitle = require('../models/jobTitle.js')(app)
  , org = require('../models/organization.js')(app)
  , moment = require('moment')
  , stat = require('./localadminstats')(app)
  , auditTrail = require("../models/auditTrail.js")(app)


  var isValidOrganization = function(vals, req, res, callback) {

    username = req.params.id || req.body.username;

    user.list({search: {username: username}}, function(r) {
      if (r.length == 1) {
        if (r[0].profile &&
            r[0].profile.organization &&
            r[0].profile.organization.indexOf(req.session.currentUserProfile.organization) == 0) {
            callback();
        } else {
          admin.invalidAdmin(vals, req, res);
        }
      } else {
        admin.invalidAdmin(vals, req, res);
      }
    });
  }

  var userList = function(req, res, callback) {
    var vals = {
	  title: 'Pengguna',
      localAdmin: true,
      username: req.session.currentUser
    };
    search = {
      'profile.organization': { $regex: '^' + req.session.currentUserProfile.organization }
    };

    adminSimaya.userBase(req, res, callback, vals, search);
  }
  
  var adminList = function(req, res, callback) {
    var vals = {
      title: 'Pengguna Admin',
      localAdmin: true,
      isAdmin: true
    };
    search = {
      $or: [
        { 'profile.organization': { $regex: '^' + req.session.currentUserProfile.organization  + '$'}}
        , {'profile.organization': { $regex: '^' + req.session.currentUserProfile.organization  + ';'}}
      ]
    };
    if (req.query.search) {
      search.username = { $regex: req.query.search };
    }

    adminSimaya.adminBase(req, res, callback, vals, search);
  }


  var newUser = function(req, res) {
    var vals = {
      localAdmin: true,
      title: 'Buat pengguna baru',
      'profile.organization': req.session.currentUserProfile.organization, 
      myOrganization: req.session.currentUserProfile.organization, 
    };
    adminSimaya.newUserBase(req, res, {}, vals);
  }

  var editUser = function(req, res) {
    var vals = {
      localAdmin: true,
      title: 'Ubah Pengguna',
      myOrganization: req.session.currentUserProfile.organization, 
    };

    isValidOrganization(vals, req, res, function() {
      adminSimaya.editUserBase(req, res, {}, vals);
    });
  }

  var changePassword = function(req, res, callback) {
    var vals = {
      localAdmin: true,
      title: 'Ubah Kata Sandi',
      username: req.params.id || req.body.username
    };

    isValidOrganization(vals, req, res, function() {
      admin.changePasswordBase(req, res, callback, vals);
    });
  }

  var emailList = function(req, res, callback) {
    var vals = {
      localAdmin: true,
      username: req.params.id || req.body.username
    };

    admin.emailListBase(req, res, callback, vals);
  }

  var listTitle = function(req, res) {
    var vals = {
      title: 'Nama Jabatan', 
      localAdmin: true
    }
    var myOrganization = req.query.organization || req.session.currentUserProfile.organization;
      
    jobTitle.list({search: { organization: myOrganization }}, function(r) {
      vals.titleList = r;
      vals.organization = myOrganization;
      sinergisUtils.render(req, res, 'admin-job-title', vals, 'base-admin-authenticated');
    });
  }

  var removeTitle = function(req, res) {
    var myOrganization = req.body.organization || req.session.currentUserProfile.organization;
    if (req.body.path) {
      jobTitle.removeTitle(req.body.path, myOrganization, function(r) {
        auditTrail.record({
          collection: "jobTitle",
          changes: {
            removed: req.body.path,
            organization: myOrganization
          },
          session: req.session.remoteData,
        }, function(err, audit) {
          res.send(JSON.stringify(r));
        });
      });
    } else {
      res.send("ERROR");
    }

  }

  var editTitle = function(req, res) {
    var myOrganization = req.body.organization || req.session.currentUserProfile.organization;
    if (req.body.oldPath && req.body.path && req.body.name) {
      var data = {
        newTitle: req.body.name,
        organization: myOrganization,
        oldPath: req.body.oldPath,
        path: req.body.path
      }
      jobTitle.editTitle(data, function(r) {
        auditTrail.record({
          collection: "jobTitle",
          changes: {
            edit: true,
            data: data,
            organization: myOrganization
          },
          session: req.session.remoteData,
        }, function(err, audit) {
          res.send(JSON.stringify(r));
        });
      });
    } else {
      res.send("ERROR");
    }
  }

  var newTitle = function(req, res) {
    var myOrganization = req.body.organization || req.session.currentUserProfile.organization;
    if (req.body.name) {
      var path = req.body.name;
      if (req.body.path) {
        path = req.body.path + ';' + path;
      }
      var data = {
        title: req.body.name,
        organization: myOrganization,
        path: path, 
      }
      jobTitle.create(data, function(r) {
        auditTrail.record({
          collection: "jobTitle",
          changes: {
            edit: false,
            data: data,
            organization: myOrganization
          },
          session: req.session.remoteData,
        }, function(err, audit) {
          res.send(JSON.stringify(r));
        });
      });
    } else {
      res.send("ERROR");
    }
  }


  var associateRole = function(req, res) {
    var vals = {
      title: 'Kewenangan',
      username: req.params.id || req.body.username,
      localAdmin: true,
    }

    admin.associateRoleBase(req, res, null, vals);
  }

  var renderDashboard = function(req, res, vals) {
    sinergisUtils.render(req, res, 'localadmin-stat', vals, 'base-admin-authenticated');
  }

  var stats = function(req, res){
    stat.currentStat(req, res);
  }

  var index = function(req, res){
    var vals = {
      title: 'Dasbor',
      requireAdmin: true,
      localadmin: true,
      dashboardType : 'local',
      mainStat : [
        { id: "stat-users", title : "Pengguna", val : "...", color : "red", icon : "user"},
        { id: "stat-users-online", title : "Online", val : "...", color : "green", icon : "user"},
        { id: "stat-organizations", title : "Instansi", val : "...", color : "lightblue", icon : "group"},
        { id: "stat-letters", title : "Surat", val : "...", color : "blue", icon : "envelope-alt"},
        { id: "stat-letters-today", title : "Hari Ini", val : "...", color : "blue", icon : "envelope"}
      ]
    }
    renderDashboard(req, res, vals)
  }

  var phones = function(req, res, callback) {
    var vals = {
      localAdmin: true,
      username: req.params.id || req.body.username
    };
    
    admin.phonesBase(req, res, callback, vals);
  }

  return {
    user: userList
    , admin: adminList
    , newUser: newUser
    , editUser: editUser
    , emailList: emailList 
    , changePassword: changePassword 
    , listTitle: listTitle
    , removeTitle: removeTitle
    , editTitle: editTitle
    , newTitle: newTitle
    , associateRole : associateRole
    , index : index
    , stats : stats
    , phones: phones
  }
};
