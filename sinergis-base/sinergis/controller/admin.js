module.exports = function(app) {
  var utils = require('./utils.js')(app)
  , user = require('../models/user.js')(app)
  , role = require('../models/role.js')(app)
  , moment = require('moment')
  , org = require('../../../simaya/models/organization.js')(app)
  , auditTrail = require("../../../simaya/models/auditTrail.js")(app)
  , session = require('../models/session.js')(app)
  , letter = require('../../../simaya/models/letter.js')(app)
  , os = require('os')
  , df = require('node-diskfree')

  // Render user management
  var renderMain = function(req, res, vals) {
    utils.render(req, res, 'admin', vals, 'base-admin-authenticated');
  }

  var invalidAdmin = function(vals, req, res) {
    utils.render(req, res, 'invalid-admin', vals, 'base-admin-authenticated');
  }

  var index = function(req, res) {
    var vals = {
      title: 'Dasbor',
      requireAdmin: true
    }

    var search = search || {};
    
    search = {
      search: search
    };
    if (req.query.search) {
      search.search.username = { $regex: req.query.search };
    }

    var thisDate = new Date();
    thisDate = thisDate.getDate();

    vals.serverStatus = {
      domain: app.simaya.url,
      //ipAddress: os.networkInterfaces().eth0[0].address,
      uptime: utils.getDurations(os.uptime()),
      totalMemory: utils.bytesToSize(os.totalmem()),
      freeMemory: utils.bytesToSize(os.freemem())
    };

    df.drives(function(error, drives) {
      df.drivesDetail(drives, function (err, diskData) {
        vals.diskData = diskData[0];
        
        user.list(search, function(r) {
          for (var i = 0; i < r.length; i ++) {
            if (r[i].lastLogin) {
              r[i].formattedLastLogin = moment(r[i].lastLogin).format('dddd, DD MMMM YYYY HH:mm');
            }
          }
          vals.usersCount = r.length;

          org.list({}, function(o) {
            vals.orgsCount = o.length;

            session.list({}, function(s) {
              vals.sessionsCount = 0;
              s.forEach(function(se) {
                if (se.expireAt.getDate() == thisDate) {
                  vals.sessionsCount++;
                }              
              });

              console.log(vals);
              renderMain(req, res, vals);
            });
          });
        });

      });

    });
  }

  var roleList = function(req, res) {
    var vals = {
      title: 'Kewenangan',
      requireAdmin: true,
      isAdminMenu: true
    }
 
    role.list(function(l) {
      vals.roleList = l;
      utils.render(req, res, 'admin-role', vals, 'base-admin-authenticated');
    });
  }

  var editRole = function(req, res) {
    var vals = {
      title: 'Ubah Kewenangan',
      roleName: req.params.id || req.body.roleName,
      requireAdmin: true
    }
 
    if (Object.keys(req.body).length != 0) {
      role.edit(req.body.roleName, req.body.newRoleName, req.body.roleDescription, function(v) {
        if (Object.keys(v.errors).length > 0) {
          vals.unsuccessful = true;
          vals.form = true;
          vals.roleName = req.body.roleName;
          vals.newRoleName = req.body.newRoleName;
          if (typeof(v.errors['roleName']) !== "undefined") {
            var e = v.errors['roleName'];

            for (var i = 0; i < e.length; i ++) {
              if (e[i] == 'There is already a role with this name') {
                vals.duplicateRole = true;
              } else if (e[i] == 'Invalid role name') {
                vals.invalidRole = true;
              }
            }
          }
        } else {
          vals.successful = true;
        }
        auditTrail.record({
          collection: "user",
          changes: {
            renameRole: {
              from: req.body.roleName,
              to: req.body.newRoleName
            }
          },
          session: req.session.remoteData,
          result: vals.successful
        }, function(err, audit) {
          utils.render(req, res, 'admin-edit-role', vals, 'base-admin-authenticated');
        });

      });
    } else {
      role.list({roleName: req.params.id }, function(r) {
        vals.roleName = req.params.id;
        vals.newRoleName = req.params.id;
        if (r.length == 1) {
          vals.form = true;
          vals.roleDescription = r[0].roleDescription; 
        } else {
          vals.roleNotFound = true;
          vals.unsuccessful = true;
        }
        utils.render(req, res, 'admin-edit-role', vals, 'base-admin-authenticated');
      });
    }
  }

  var newRole = function(req, res) {
    var vals = {
      title: 'Tambah Kewenangan',
      requireAdmin: true
    }
 
    if (Object.keys(req.body).length != 0) {
      role.create(req.body.roleName, req.body.roleDescription, function(v) {
        if (Object.keys(v.errors).length > 0) {
          vals.unsuccessful = true;
          vals.form = true;
          vals.role = req.body.roleName;
          if (typeof(v.errors['roleName']) !== "undefined") {
            var e = v.errors['roleName'];

            for (var i = 0; i < e.length; i ++) {
              if (e[i] == 'There is already a role with this name') {
                vals.duplicateRole = true;
              } else if (e[i] == 'Invalid role name') {
                vals.invalidRole = true;
              }
            }
          }
          utils.render(req, res, 'admin-new-role', vals, 'base-admin-authenticated');
        } else {
          vals.successful = true;
          auditTrail.record({
            collection: "user",
            changes: {
              newRole: {
                name: req.body.roleName,
                description: req.body.roleDescription
              }
            },
            session: req.session.remoteData,
            result: vals.successful
          }, function(err, audit) {
            if (req.body.saveAndClose) {
              return res.redirect('/admin/role');
            } else {
              vals.form = true;
              return utils.render(req, res, 'admin-new-role', vals, 'base-admin-authenticated');
            }
          });
        }
      });
    } else {
      vals.form = true;
      utils.render(req, res, 'admin-new-role', vals, 'base-admin-authenticated');
    }
  }


  var userList = function(req, res) {
    return userListBase(req, res);
  }

  var userListBase = function(req, res, callback, vals, search) {
    var vals = vals || {
      title: 'Pengguna',
      requireAdmin: true
    }

    var search = search || {};

    user.list({
     search: search,
     page: 0
    }, function(r) {
      vals.userList = r;
      utils.render(req, res, 'admin-user', vals, 'base-admin-authenticated');
    });
  }

  var newUser = function(req, res) {
    return newUserBase(req, res);
  }

  var newUserBase = function(req, res, callback, vals) {
    var vals = vals || {
      title: 'Pengguna Baru',
      requireAdmin: true
    }
 
    if (Object.keys(req.body).length != 0) {
      vals.username = req.body.username;
      vals.profile = req.body.profile;

      if (req.body.password != req.body.password2) {
        vals.unsuccessful = true;
        vals.passwordUnconfirmed = true;
        vals.form = true;
        utils.render(req, res, 'admin-new-user', vals, 'base-admin-authenticated');
        return;
      }

      user.create(req.body.username, req.body.password, req.body.profile, function(v) {
        if (v.hasErrors() > 0) {
          vals.unsuccessful = true;
          vals.form = true;
          vals.user = req.body.username;
          vals.errors = v.errors;

          utils.render(req, res, 'admin-new-user', vals, 'base-admin-authenticated');
        } else {
          vals.successful = true;
          auditTrail.record({
            collection: "user",
            changes: {
              newUser: {
                name: req.body.username,
                profile: req.body.profile
              }
            },
            session: req.session.remoteData,
            result: vals.successful
          }, function(err, audit) {

            if (req.body.saveAndClose) {
              if (req.path.indexOf('/localadmin') != -1) {
                res.redirect('/localadmin/user');
              } else {
                res.redirect('/admin/user');
              }
            } else {
              vals.form = true;
              vals.username = "";
              vals.profile = {};
              utils.render(req, res, 'admin-new-user', vals, 'base-admin-authenticated');
            }
          });
        }
      });
    } else {
      vals.form = true;
    }
    utils.render(req, res, 'admin-new-user', vals, 'base-admin-authenticated');
  }

  var editUser = function(req, res) {
    return editUserBase(req,res);
  }

  var editUserBase = function(req, res, callback, vals) {
    
    var vals = vals || {
      title: 'Ubah Pengguna',
      requireAdmin: true
    }
 
    if (Object.keys(req.body).length != 0) {
      vals.username = req.body.username;
      vals.profile = req.body.profile;

      user.modifyProfile(req.body.username, req.body.profile, function(v) {
        if (v.hasErrors() > 0) {
          vals.unsuccessful = true;
          vals.form = true;
          vals.user = req.body.username;
          vals.errors = v.errors;

          utils.render(req, res, 'admin-edit-user', vals, 'base-admin-authenticated');
        } else {
          if (req.body.active) {
            user.setActive(req.body.username, function(r) {
              if (r == true) {
                vals.successful = true;
              } else {
                vals.unsuccessful = true;
                vals.unableToActivate = true;
              }
              utils.render(req, res, 'admin-edit-user', vals, 'base-admin-authenticated');
            });
          } else {
            vals.successful = true;
            utils.render(req, res, 'admin-edit-user', vals, 'base-admin-authenticated');
          }
        }
      });
    } else {
      vals.form = true;
      vals.username = req.params.id;
      user.list({ search: {username:req.params.id}}, function(r) {
        if (r.length == 0) {
          vals.unsuccessful = true;
          vals.noSuchUser = true;
        } else {
          vals.profile = r[0].profile;
          if (r[0].active) {
            vals.inactive = false;
            vals.active = true;
            vals.checked = 'checked';
          } else {
            vals.inactive = true;
            vals.active = false;
          }
        }
        utils.render(req, res, 'admin-edit-user', vals, 'base-admin-authenticated');
      });
    }
  }

  var changePassword = function(req, res) {
    return changePasswordBase(req, res);
  }

  var changePasswordBase = function(req, res, callback, vals) {
    
    var vals = vals || {
      title: 'Ubah Kata Sandi Pengguna',
      requireAdmin: true
    }
 
    if (Object.keys(req.body).length != 0) {
      if (req.body.password != req.body.password2) {
        vals.unsuccessful = true;
        vals.passwordUnconfirmed = true;
        vals.form = true;
        utils.render(req, res, 'admin-change-password', vals, 'base-admin-authenticated');
        return;
      }

      vals.username = req.body.username;

      user.changePassword(req.body.username, req.body.password, function(v) {
        if (v.hasErrors() > 0) {
          vals.unsuccessful = true;
          vals.form = true;
          vals.user = req.body.username;
          vals.errors = v.errors;

          utils.render(req, res, 'admin-change-password', vals, 'base-admin-authenticated');
        } else {
          vals.successful = true;
          auditTrail.record({
            collection: "user",
            changes: {
              username: req.body.username,
              passwordChanged: true 
            },
            session: req.session.remoteData,
            result: !vals.unsuccessfull
          }, function(err, audit) {
            utils.render(req, res, 'admin-change-password', vals, 'base-admin-authenticated');
          });
        }

      });
    } else {
      vals.form = true;
      vals.username = req.params.id;
      user.list({ search: {username:req.params.id}}, function(r) {
        if (r.length == 0) {
          vals.unsuccessful = true;
          vals.noSuchUser = true;
        } else {
          vals.form = true; 
        }
        utils.render(req, res, 'admin-change-password', vals, 'base-admin-authenticated');
      });
    }
  }

  var showEmailList = function(vals, username, req, res) {
    user.list({search: {username: username}}, function(r) {
      if (r.length == 0) {
        vals.unsuccessful = true;
        vals.noSuchUser = true;
        vals.form = false;
      } else {
        vals.emailList = r[0].emailList;
        vals.form = true;
        if (typeof(vals.emailList) !== "undefined" && vals.emailList.length > 0) {
          vals.hasEmailList = true;
        }
      }
      utils.render(req, res, 'admin-email-list', vals, 'base-admin-authenticated');
    });

  }
 
  var emailList = function(req, res) {
    return emailListBase(req, res);
  }

  var emailListBase = function(req, res, callback, vals) {
    var vals = vals || {
      title: 'Surel',
      username: req.params.id || req.body.username,
      requireAdmin: true
    }
 
    if (Object.keys(req.body).length != 0) {
      vals.email = req.body.email;
      if (req.body.remove) {
        if (req.body.marked) {
          var list = req.body.marked;
          if (typeof(req.body.marked) === "string") {
            list = [req.body.marked];
          }
          user.disassociateEmail(req.body.username, list, function(r) {
            auditTrail.record({
              collection: "user",
              changes: {
                username: req.body.username,
                removedEmail: list 
              },
              session: req.session.remoteData,
            }, function(err, audit) {
              showEmailList(vals, req.body.username, req, res);
            });
          });
        }

        return;
      }
      user.associateEmail(req.body.username, req.body.email, function(token) {
        if (typeof(token) === "undefined") {
          user.getUserFromEmail(req.body.email, function(u) {
            vals.unsuccessful = true;
            vals.notAdding = true;
            if (u != null) {
              vals.usedByUsername = u;
            }
            showEmailList(vals, req.body.username, req, res);
          });
        } else {

          user.activateEmailAssociation(token, req.body.email, function(r) {
            auditTrail.record({
              collection: "user",
              changes: {
                username: req.body.username,
                newEmail: req.body.email
              },
              session: req.session.remoteData,
            }, function(err, audit) {
              showEmailList(vals, req.body.username, req, res);
            });

          });
        }
      });
    } else {
      showEmailList(vals, req.params.id, req, res);
    }
  }
 
  var showRoleList = function(vals, username, req, res) {
    var localAdmin = false;
    if (req.path.indexOf('/localadmin') != -1) {
      localAdmin = true;
    }
    var rolesCopy = [];
    role.list(function(roles) {
      user.roleList(username, function(r) {
        for (var i = 0; i < roles.length; i ++ ) {

          if (localAdmin && roles[i].roleName == "admin") {
            continue;
          }
          if (r) {
              for (var j = 0; j < r.length; j ++) {
                if (r[j] == roles[i].roleName) {
                  roles[i].checked = "checked";
                }
              }
          }
          rolesCopy.push(roles[i]);
        }
        vals.roles = rolesCopy;
        utils.render(req, res, 'admin-associate-role', vals, 'base-admin-authenticated');
      });
    });

  }

  var associateRole = function(req, res) {
    return associateRoleBase(req, res);
  }

  var associateRoleBase = function(req, res, callback, vals) {
    var vals = vals || {
      title: 'Kewenangan',
      username: req.params.id || req.body.username,
      requireAdmin: true
    }
 
    if (Object.keys(req.body).length != 0) {
      var list = req.body.marked;
      if (typeof(list) === "string") {
        list = [req.body.marked];
      }
      user.setRoles(req.body.username, list, function(r) {
        if (r == true) {
          vals.successful = true;
        }
        auditTrail.record({
          collection: "user",
          changes: {
            username: req.body.username,
            setRoles: list 
          },
          session: req.session.remoteData,
        }, function(err, audit) {
          showRoleList(vals, req.body.username, req, res);
        });

      });
    } else {
      showRoleList(vals, req.params.id, req, res);
    }
  }

  var removeUsers = function(req, res) {
    if (req.body.removeUsers) {
      auditTrail.record({
        collection: "user",
        changes: {
          removedUsers: req.body.removeUsers 
        },
        session: req.session.remoteData,
      }, function(err, audit) {
        user.removeUsers(req.body.removeUsers);
      });

    }
    res.send("OK");
  }

  var showPhones = function(vals, username, req, res) {
    user.list({search: {username: username}}, function(r) {
      if (r.length == 0) {
        vals.unsuccessful = true;
        vals.noSuchUser = true;
        vals.form = false;
      } else {
        var phones = r[0].profile.phones || [];
        vals.phones = []

        for(var i = 0; i < phones.length; i++){
          vals.phones.push({ phone : phones[i], isValidated : true})
        }
        if (typeof(vals.phones) !== "undefined" && vals.phones.length > 0) {
          vals.hasPhones = true;
        }

        vals.form = true
      }
      utils.render(req, res, 'admin-phones', vals, 'base-admin-authenticated');
    });

  }

  var phones = function(req, res){
    return phonesBase(req, res);
  }

  var phonesBase = function(req, res, callback, vals){
    var vals = vals || {
      title: 'Telepon',
      username: req.params.id || req.body.username,
      requireAdmin: true
    }
    if(Object.keys(req.body).length > 0){

      var body = req.body

      if(body.remove){
        
        user.removePhones(body.username, body.marked, function(err, user){
          auditTrail.record({
            collection: "user",
            changes: {
              username: body.username,
              removedPhones: body.marked
            },
            session: req.session.remoteData,
          }, function(err, audit) {
            return showPhones(vals, body.username, req, res)  
          });
        })

      }else{

        user.addPhone(body.username, body.phone, function(err, u){
          if(err){
            vals.unsuccessful = true
            if(err.message == 'exists') vals.notAdding = true
            if(err.message == 'invalid') vals.invalidPhone = true
            if(u) vals.usedByUsername = u
          }
          auditTrail.record({
            collection: "user",
            changes: {
              username: body.username,
              addPhone: body.phone
            },
            session: req.session.remoteData,
            result: !vals.unsuccessfull
          }, function(err, audit) {
            return showPhones(vals, body.username, req, res)  
          });
        })
      }
    }
    else {
      showPhones(vals, req.params.id, req, res);  
    }
  }

  return {
    index: index
    , user: userList
    , userListBase: userListBase
    , role: roleList
    , newRole: newRole
    , editRole: editRole
    , newUser : newUser
    , newUserBase : newUserBase
    , editUser: editUser
    , editUserBase: editUserBase
    , removeUsers: removeUsers
    , changePassword: changePassword 
    , changePasswordBase: changePasswordBase 
    , emailList: emailList 
    , emailListBase: emailListBase 
    , associateRole : associateRole
    , associateRoleBase : associateRoleBase
    , invalidAdmin: invalidAdmin
    , phones: phones
    , phonesBase: phonesBase
  }
};
