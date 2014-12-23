module.exports = function (app) {
  var utils = require('../../sinergis/controller/utils.js')(app)
    , user = require('../../sinergis/models/user.js')(app)
    , adminSinergis = require('../../sinergis/controller/admin.js')(app)
    , org = require('../models/organization.js')(app)
    , cOrg = require('./organization.js')(app)
    , role = require('../../sinergis/models/role.js')(app)
    , auditTrail = require("../models/auditTrail.js")(app)
    , moment = require('moment')
    , df = require('node-diskfree')
    , _ = require("lodash")
    , Node = require('../models/node.js')(app)
    , Hawk = require('hawk')
    , gearmanode = require("gearmanode")
    , category = require('../models/userCategory.js')(app);

  Array.prototype.unique = function () {
    var o = {}, i, l = this.length, r = []
    for (i = 0; i < l; i += 1) o[this[i]] = this[i]
    for (i in o) r.push(o[i]);
    return r
  }

  var newUserReal = function (req, res, vals) {
    var profile = req.body.profile;
    req.body.username = req.body.username.toLowerCase();

    profile.phones = profile.phones || []
    profile.phones = (typeof profile.phones == 'string') ? [profile.phones] : profile.phones.unique()

    profile.emailList = profile.emailList || []
    profile.emailList = (typeof profile.emailList == 'string') ? [profile.emailList] : profile.emailList.unique()

    var data = {
        username: req.body.username,
        password: req.body.password,
        password2: req.body.password2,
        profile: profile,
        active: false
      };

    if (req.body.roles) {
      data.roleList = req.body.roles.split(",");
    }

    if (req.body.active) {
      data.active = true;
    }

    user.create(
      data,
      function (v) {
        org.list(undefined, function (r) {
          vals.orgs = r;
          if (v.hasErrors()) {
            vals.unsuccessful = true;
            vals.form = true;
            vals.user = req.body.username;
            vals.errors = v.errors;
            if (v.errors.username && v.errors.username.length > 0) {
              if (v.errors.username.indexOf('exists') > -1) {
                var lastDigit = -1;
                for (var i = req.body.username.length - 1; i >= 0; i--) {
                  var c = req.body.username.charAt(i);
                  if (c >= '0' && c <= '9') {
                    lastDigit = i;
                  } else {
                    break;
                  }
                }
                if (lastDigit >= 0) {
                  var front = vals.user.substr(0, lastDigit);
                  var num = vals.user.substr(lastDigit);
                  vals.username = front + (parseInt(num) + 1);
                } else {
                  vals.username = vals.user + '01';
                }
              }
            }

            vals.messages = []

            var invalid = {
              username: '; "username" harus tanpa spasi, dengan panjang 3-20 karakter'
            }

            var exists = {
              username: ''
            }

            function errMsg(k, code) {
              var dict = {
                'invalid': 'tidak sesuai' + (invalid[k] || ''),
                'exists': (exists[k] || '') + 'sudah ada'
              }
              return dict[code]
            }

            for (var k in v.errors) {

              var arr = v.errors[k]
              for (var j = 0; j < arr.length; j++) {
                var m = arr[j]
                var marr = m.split(';')
                var attr = ''
                var code = m
                if (marr.length == 2) {
                  attr = marr[1]
                  code = marr[0]
                }
                vals.messages.push({ message: k + ' ' + (attr ? ('"' + attr + '"') : '') + ' ' + errMsg(k, code)})
              }
            }

            vals.emails = [
              { email: ''}
            ]
            if (profile['emailList'].length > 0) {
              vals.emails = []
              for (var i = 0; i < profile['emailList'].length; i++) {
                vals.emails.push({ email: profile['emailList'][i]})
              }
            }

            vals.phones = [
              { phone: ''}
            ]
            if (profile['phones'].length > 0) {
              vals.phones = []
              for (var i = 0; i < profile['phones'].length; i++) {
                vals.phones.push({ email: profile['phones'][i]})
              }
            }
            category.list(function(categoryList) {
              vals.userCategory = categoryList;
              utils.render(req, res, 'admin-new-user', vals, 'base-admin-authenticated');
            });

          } else {
            vals.successful = true;
            auditTrail.record({
              collection: "user",
              changes: {
                newUser: {
                  name: req.body.username,
                  profiled: profile
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
                category.list(function(categoryList) {
                  vals.userCategory = categoryList;
                  utils.render(req, res, 'admin-new-user', vals, 'base-admin-authenticated');
                });
              }
            });
          }
        });
      });
  }

  // Wrapper
  var newUser = function (req, res) {
    return newUserBase(req, res);
  }

  var newUserBase = function (req, res, calback, vals) {
    var vals = vals || {
      title: 'Pengguna Baru',
      requireAdmin: true
    }

    vals.phones = [
      { phone: ''}
    ]
    vals.emails = [
      { email: ''}
    ]

    var isLocalAdmin = false;

    if (req.path) {
      if (req.path.indexOf('/localadmin') > -1) {
        isLocalAdmin = true;
      } else if (req.path.indexOf('/admin') > -1) {
        isLocalAdmin = false
      } else {
        res.redirect("/")
      }
    }
    role.list(function(roleList) {
      vals.roleList = roleList;
      if (typeof(req.body) === "object" && Object.keys(req.body).length != 0) {
        vals.username = req.body.username;
        vals.profile = req.body.profile;

        if (parseInt(req.body.profile.echelon) != 0) {
          if (req.body.profile.category && req.body.profile.id) {
            // validate idLength
            category.list({categoryName:req.body.profile.category},function(cat) {
              if (isLocalAdmin && req.body.profile.id.length != cat[0].idLength) {
                vals.unsuccessful = true;
                vals.form = true;
                vals.messages = vals.messages || []
                vals.messages.push({message: cat[0].categoryId+' "' + req.body.profile.id + '" tidak sesuai. '+cat[0].categoryId+' harus '+cat[0].idLength+' angka.'})
                category.list(function(categoryList) {
                  vals.userCategory = categoryList;
                  return utils.render(req, res, 'admin-new-user', vals, 'base-admin-authenticated');
                });
              // validate idLength must exist
              } else if (isLocalAdmin && req.body.profile.category && !req.body.profile.id.length) {
                vals.unsuccessful = true;
                vals.form = true;
                vals.messages = vals.messages || []
                vals.messages.push({message: 'Nomor identitas harus diisi.'})
                category.list(function(categoryList) {
                  vals.userCategory = categoryList;
                  return utils.render(req, res, 'admin-new-user', vals, 'base-admin-authenticated');
                });
              } else {
                user.list({ search: {'profile.id': req.body.profile.id, 'profile.category':req.body.profile.category}}, function (r) {
                  if (isLocalAdmin && r[0] != null && parseInt(req.body.profile.echelon) != 0) {
                    if (r[0].profile.id == req.body.profile.id && r[0].username != req.body.username) {
                      vals.unsuccessful = true;
                      vals.existNip = true;
                      vals.form = true;
                      vals.messages = vals.messages || []
                      vals.messages.push({message: ' Nomor identitas "' + req.body.profile.id + '" sudah ada'})
                      category.list(function(categoryList) {
                        vals.userCategory = categoryList;
                        return utils.render(req, res, 'admin-new-user', vals, 'base-admin-authenticated');
                      });
                    } else {
                      newUserReal(req, res, vals);
                    }
                  } else {
                    newUserReal(req, res, vals);
                  }
                });
              }
            });
          }
        }

      } else {
        vals.form = true;
        org.list(undefined, function (r) {
          vals.orgs = r;
          category.list(function(categoryList) {
            vals.userCategory = categoryList;
            utils.render(req, res, 'admin-new-user', vals, 'base-admin-authenticated');
          });
        });
      }
    });
  }

  // The real edit user
  var edit = function (req, res, vals) {
    var profile = req.body.profile;
    if (req.body['serialized-phones']) {
      profile.phones = req.body['serialized-phones'].split(',')
    }

    var modify = function(cb) {
      user.modifyProfile(req.body.username, profile, function (v) {
        if (v.hasErrors()) {
          vals.unsuccessful = true;
          vals.form = true;
          vals.user = req.body.username;
          vals.errors = v.errors;
          utils.render(req, res, 'admin-edit-user', vals, 'base-admin-authenticated');
          cb(false);
        } else {
          if (req.body.active) {
            user.setActive(req.body.username, function (r) {
              if (r == true) {
                vals.successful = true;
              } else {
                vals.unsuccessful = true;
                vals.unableToActivate = true;
              }
              utils.render(req, res, 'admin-edit-user', vals, 'base-admin-authenticated');
              cb(r);
            });
          } else {
            user.setInActive(req.body.username, function (r) {
              if (r == true) {
                vals.successful = true;
              } else {
                vals.unsuccessful = true;
                vals.unableToActivate = true;
              }
              utils.render(req, res, 'admin-edit-user', vals, 'base-admin-authenticated');
              cb(r);
            });
          }
        }
      });
    }

    modify(function(success) {
      auditTrail.record({
        collection: "user",
        changes: profile,
        session: req.session.remoteData,
        result: success
      }, function(err, audit) {
      });
    });
  }

  // Wrapper
  var editUser = function (req, res) {
    return editUserBase(req, res);
  }

  var editUserBase = function (req, res, callback, vals) {

    var vals = vals || {
      title: 'Ubah Pengguna',
      requireAdmin: true
    }

    var isLocalAdmin = false;
    if (req.path.indexOf('/localadmin') >= 0) {
      isLocalAdmin = true;
    }
    if (Object.keys(req.body).length != 0) {
      vals.username = req.body.username;
      vals.profile = req.body.profile;
      if (req.session.currentUser == vals.username) {
        // user can't deactivate him/herself
        req.body.active = true;
        vals.myself = true;
      }

      Object.keys(req.body).forEach(function (item) {
        vals[item] = req.body[item];
      });


      if (isLocalAdmin && parseInt(req.body.profile.echelon) != 0) {
        category.list({categoryName:req.body.profile.category},function(cat) {
          if (req.body.profile && req.body.profile.id && req.body.profile.id.length != parseInt(cat[0].idLength)) {
            vals.unsuccessful = true;
            vals.invalidId = true;
            utils.render(req, res, 'admin-edit-user', vals, 'base-admin-authenticated');
            return;
          } else {
            user.list({ search: {'profile.id': req.body.profile.id, 'profile.category': req.body.profile.category}}, function (r) {
              if (isLocalAdmin && r[0] != null && parseInt(req.body.profile.echelon) != 0) {
                if (r[0].profile.id == req.body.profile.id && r[0].username != req.body.username) {
                  vals.unsuccessful = true;
                  vals.existNip = true;
                  utils.render(req, res, 'admin-edit-user', vals, 'base-admin-authenticated');
                } else {
                  edit(req, res, vals);
                }
              } else {
                edit(req, res, vals);
              }
            });
          }
        });
      }

    } else {
      vals.form = true;
      vals.username = req.params.id;
      if (req.session.currentUser == vals.username) {
        vals.myself = true;
      }

      user.list({ search: {username: req.params.id}}, function (r) {
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
          if (vals.profile) {
            echelonSelected = 'isEchelon' + vals.profile.echelon;
            vals[vals.profile.class] = true;
            vals[echelonSelected] = 'selected';
          }
        }
        category.list(function(cat) {
          vals.userCategory = cat;
          utils.render(req, res, 'admin-edit-user', vals, 'base-admin-authenticated');
        });
      });
    }
  }

  var removeUsers = function (req, res) {
    adminSinergis.removeUsers(req, res);
  }


  var userListJSON = function (req, res) {
    var search;
    var id = req.params.id || req.query.id;

    if (id) {
      search = {
        search: {
          $or: [
            { "username": { $regex: id }},
            { "profile.fullName": { $regex: id }},
          ]
        },
        limit: 20,
        page: 1
      }
    } else {
      search = {
        search: {},
        limit: 20,
        page: 1
      }
    }
    user.list(search, function (r) {
      var result = [];
      for (var i = 0; i < r.length; i++) {
        result.push({
          username: r[i].username,
          fullName: r[i].profile["fullName"]
        });
      }
      res.send(result);
    });
  }

  var userList = function (req, res) {
    return userListBase(req, res);
  }

  var userListBase = function (req, res, callback, vals, search) {
    var vals = vals || {
      title: 'Pengguna',
      requireAdmin: true,
      isAdminMenu: true
    }

    var search = search || {};

    search = {
      search: search
    };
    if (req.query.search) {
      search.search["$or"] = [
        { "username": { $regex: req.query.search }},
        { "profile.fullName": { $regex: req.query.search }},
        { "profile.id": { $regex: req.query.search }},
        { "profile.title": { $regex: req.query.search, $options: "i" } },
      ];
    }
    search.search.roleList = { $nin: [ 'admin', 'localadmin' ] }
    if (req.query.sort && req.query.sort.string) {
      search.sort = {};
      search.sort[req.query.sort.string] = parseInt(req.query.sort.dir) || 1;
    }

    search.page = parseInt(req.query.page) || 1;
    user.search(search, function (err, result) {
      vals.total = result.total;
      vals.userList = result.data;
      vals.page = search.page;
      utils.render(req, res, 'admin-user', vals, 'base-admin-authenticated');
    });
  }


  var adminList = function (req, res) {
    return adminListBase(req, res);
  }

  var adminListBase = function (req, res, callback, vals, search) {
    var vals = vals || {
      title: 'Pengguna Admin',
      isAdmin: true,
      requireAdmin: true,
      isAdminMenu: true
    }

    var search = search || {};

    search = {
      search: search
    };
    if (req.query.search) {
      search.search.username = { $regex: req.query.search };
    }
    search.search.roleList = { $in: [ 'admin', 'localadmin' ] }

    if (req.query.sort && req.query.sort.string) {
      search.sort = {};
      search.sort[req.query.sort.string] = parseInt(req.query.sort.dir) || 1;
    }

    user.list(search, function (result) {
      search.page = parseInt(req.query.page) || 1;
      search.limit = 10;

      // Count result for pagination
      var numberOfItems = result.length;
      var numberOfPages = Math.ceil(numberOfItems / search.limit);

      // Set previous and next page
      vals.pages = {};
      if (search.page > 1) {
        vals.pages.prev = {
          active: true,
          page: search.page - 1
        };
      }

      if (search.page < numberOfPages) {
        vals.pages.next = {
          active: true,
          page: search.page + 1
        }
      }

      // Set 2 pages before and after active page
      vals.pages.numbers = [];
      if (search.page > 1) {
        if ((search.page - 2) != 0) {
          var page = {
            page: search.page - 2
          }
          vals.pages.numbers.push(page);
          var page = {
            page: search.page - 1
          }
          vals.pages.numbers.push(page);
        } else {
          var page = {
            page: 1
          }
          vals.pages.numbers.push(page);
        }
      }

      var page = {
        page: search.page,
        active: true
      }
      vals.pages.numbers.push(page);

      if (search.page < numberOfPages) {
        var page = {
          page: search.page + 1
        }
        vals.pages.numbers.push(page);
        var page = {
          page: search.page + 2
        }
        vals.pages.numbers.push(page);
      }

      user.list(search, function (r) {
        for (var i = 0; i < r.length; i++) {
          if (r[i].lastLogin) {
            r[i].formattedLastLogin = moment(r[i].lastLogin).format('dddd, DD MMMM YYYY HH:mm');
          }
        }
        vals.userList = r;
        utils.render(req, res, 'admin-user', vals, 'base-admin-authenticated');
      });
    });
  }

  var diskStatus = function (req, res) {

    var getValue = function (data) {
      var values = data.split(" ");
      values[0] = parseInt(values[0]);
      if (values[1] == "KB") {
        values[0] *= 1024;
      }
      else if (values[1] == "MB") {
        values[0] *= (1024 * 1024);
      }
      else if (values[1] == "GB") {
        values[0] *= (1024 * 1024 * 1024);
      }
      else if (values[1] == "TB") {
        values[0] *= (1024 * 1024 * 1024 * 1024);
      }
      return values[0];
    }

    var getLabel = function (value) {
      var tb = 1024 * 1024 * 1024 * 1024;
      var gb = 1024 * 1024 * 1024;
      var mb = 1024 * 1024;
      if (value > tb) {
        return Math.floor(value / tb) + "TB";
      }
      else if (value > gb) {
        return Math.floor(value / gb) + "GB";
      }
      else if (value > mb) {
        return Math.floor(value / mb) + "MB";
      }
      return value;
    }

    df.drives(function (error, drives) {
      df.drivesDetail(drives, function (err, diskData) {
        var diskStatus = [];
        var availableValue = 0, usedValue = 0;
        for (var i = 0; i < diskData.length; i++) {
          if (diskData[i].drive != "tmpfs") {
            availableValue += getValue(diskData[i].available);
            usedValue += getValue(diskData[i].used);
          }
        }
        var available = {
          data: availableValue,
          label: getLabel(availableValue) + ' Available'
        }
        var used = {
          data: usedValue,
          label: getLabel(usedValue) + ' Used'
        }
        diskStatus.push(available);
        diskStatus.push(used);
        res.send(diskStatus);
      });
    });
  }

  var adminStructure = function (req, res) {
    var vals = {
      title: 'Struktur Pengguna',
      isAdmin: true,
      isLocalAdmin: false,
      requireAdmin: true,
      isAdminMenu: true,
      organization: req.session.currentUserProfile.organization
    };

    var roles = req.session.currentUserRoles;
    var userSearch = {};
    var orgSearch = {};
    if (roles && roles.length > 0) {
      roles.every(function (item) {
        if (item == "localadmin") {
          var myOrganization = req.session.currentUserProfile.organization;

          if (myOrganization == "" || typeof(myOrganization) === "undefined") {

            // this local admin is not tied to any organization,
            // this will prevent her to see the organization structure

            utils.render(req, res, "admin-structure", vals, 'base-admin-authenticated');

          } else {
            orgSearch = {  $or: [
              { 'path': {$regex: '^' + myOrganization + '$' }},
              { 'path': {$regex: '^' + myOrganization + ';' }}
            ]
            };
            userSearch = {
              search: { $or: [
                { 'profile.organization': {$regex: '^' + myOrganization + '$' }},
                { 'profile.organization': {$regex: '^' + myOrganization + ';' }}
              ]}
            };

            vals.isAdmin = false;
            vals.isLocalAdmin = true;
          }
          return true;
        } else if (item === "admin") {
          var org = req.query.org;

          if (org == "" || typeof(org) === "undefined") {

            return false;

          } else {
            orgSearch = {  $or: [
              { 'path': {$regex: '^' + org + '$' }},
              { 'path': {$regex: '^' + org + ';' }}
            ]
            };
            userSearch = {
              search: { $or: [
                { 'profile.organization': {$regex: '^' + org + '$' }},
                { 'profile.organization': {$regex: '^' + org + ';' }}
              ]}
            };

            vals.isAdmin = true;
            vals.isLocalAdmin = false;
          }
          return true;
        }
      });
    }

    var nodes = [];

    user.list(userSearch, function (r) {
      r.forEach(function (u) {
        nodes.push({
          id: u._id,
          type: 'user',
          username: u.username,
          active: u.active,
          roleList: u.roleList ? u.roleList : "",
          name: ((u.profile && u.profile.fullName) ? u.profile.fullName : u.username),
          title: ((u.profile && u.profile.title) ? u.profile.title : ""),
          path: ((u.profile && u.profile.organization) ? u.profile.organization : "")
        });
      });
      org.list(orgSearch, function (rx) {
        rx.forEach(function (o) {
          nodes.push({
            id: o._id,
            type: 'organization',
            name: o.name,
            path: o.path
          });
        });
        if (req.query.hasOwnProperty("json") && req.query.json) {
          vals.nodes = JSON.stringify(nodes);
          res.send(vals);
        } else {
          vals.nodes = JSON.stringify(nodes);
          utils.render(req, res, "admin-structure", vals, 'base-admin-authenticated');
        }
      });
    });

  };

  var adminListInOrgJSON = function (req, res) {
    var search;
    search = {
      search: {
        "roleList": { $in: ["admin", "localadmin"]}
      }
    };

    if (typeof(req.query.org) === "undefined" || !req.query.org) {
      search.search["$or"] = [
        {"profile.organization": ""},
        {"profile.organization": {
          "$exists": false
        }
        }
      ];
    } else {
      search.search["profile.organization"] = req.query.org;
    }

    user.list(search, function (r) {
      var result = [];
      for (var i = 0; i < r.length; i++) {
        var isAdmin = false, isLocalAdmin = false;
        for (var j = 0; j < r[i].roleList.length; j++) {
          if (r[i].roleList[j] == "admin") {
            isAdmin = true;
          }
          if (r[i].roleList[j] == "localadmin") {
            isLocalAdmin = true;
          }
        }
        result.push({
          username: r[i].username,
          fullName: r[i].profile["fullName"],
          admin: isAdmin,
          localAdmin: isLocalAdmin
        });
      }
      res.send(result);
    });
  };

  var userListInOrgJSON = function (req, res) {
    var search;
    search = {
      search: { }
    };

    if (!req.query.org) {
      return res.send({});
    }

    org.list({
      path: req.query.org
    }, function (orgs) {
      if (orgs && orgs.length == 1) {
        var org = orgs[0];
        search.search["profile.organization"] = req.query.org;

        user.list(search, function (r) {
          var result = [];
          for (var i = 0; i < r.length; i++) {
            result.push({
              username: r[i].username,
              fullName: r[i].profile["fullName"],
              echelon: r[i].profile["echelon"],
              title: r[i].profile["title"],
            });
          }
          res.send({
            head: org.head,
            users: result
          });
        });
      } else {
        res.send({});
      }
    });

  };

  var removeHeadInOrg = function (req, res) {
    org.edit(req.body.path, {
      path: req.body.path,
      removeHead: true
    }, function(v) {
      if (v.hasErrors()) {
        res.send({status: "error", error: v.errors})
      } else {
        auditTrail.record({
          collection: "organization",
          changes: {
            path: req.body.path,
            head: "removed"
          },
          session: req.session.remoteData
        }, function(err, audit) {
          res.send({status: "ok"});
        });
      }
    });
  }

  var headInOrgJSON = function (req, res) {
    org.edit(req.body.path, {
      path: req.body.path,
      head: req.body.head
    }, function(v) {
      if (v && v.hasErrors()) {
        res.send({status: "error", error: v.errors})
      } else {
        auditTrail.record({
          collection: "organization",
          changes: {
            path: req.body.path,
            head: req.body.head
          },
          session: req.session.remoteData
        }, function(err, audit) {
          res.send({status: "ok"});
        });
      }
    });
  };

  var auditList = function(req, res) {
    var date = new Date(req.query.date);
    if (isNaN(date.valueOf())) {
      date = new Date();
    }
    var vals = {
      date: date
    };
    var options = { date: date, limit: 10, page: 1 };

    if (req.query.page) options.page = req.query.page;

    auditTrail.list(options, function(err, result) {
      _.each(result.data, function(item) {
        item.changes = JSON.stringify(item.changes, null, "  ");
        item.session = JSON.stringify(item.session, null, "  ");
        console.log(item);
      });
      vals.total = result.total;
      vals.list = result.data;
      vals.page = options.page;
      utils.render(req, res, 'admin-audit-list', vals, 'base-admin-authenticated');
    });
  }

  var auditDetail = function(req, res) {
    var id = req.param.is
    auditTrail.detail({ id: id}, function(err, result) {
      res.send(result || {});
    });
  }

  var getNodes = function(req, res){
    
    var simaya = app.simaya;

    Node.nodes(function(err, nodes){
      var message;
      
      if (err){
        message = err.message;
      }

      for (var i = 0; i < nodes.length; i++){
        nodes[i].isActive == nodes[i].state == "connected";
        nodes[i].date = moment(nodes[i].date).fromNow();
      }

      Node.group(nodes, function(err, grouped){
        if (err) {
          message = err.message;   
        }

        utils.render(req, res, 
        "admin-nodes", 
        {
          message : message,
          nodes : nodes,
          simaya : simaya,
          grouped : grouped,
          groupedBase64 : (new Buffer(JSON.stringify(grouped)).toString("base64"))
        }, 
        "base-admin-authenticated");
      });     
    });
  }

  var putNodeRequests = function(req, res){

    var options = req.body;
    var file = req.files.file.path;
    options.file = file;

    Node.request(options, function(err, reply){
      var message;
      if (err) {
        message = err.message;
      }
      res.redirect("/admin/node/requests" + (message ? ("?error=" + message) : ""));
    });
  }
  
  var getNodeRequests = function(req, res){
    var options = {};

    function nodes(type, template){
      Node[type](options, function(err, nodes){
        var message;
        if (err) message = err.message;

        nodes = nodes || [];
        for (var i = 0; i < nodes.length; i++){
          nodes[i].isActive = nodes[i].state == "connected";
          nodes[i].date = nodes[i].requestDate || nodes[i].date;
        }

        if (app.simaya.installation != "local"){
          Node.group(nodes, function(err, grouped){
            if (err){
              message = err.message;
            }

            utils.render(req, res, 
            template || "admin-local-node-requests", 
            {
              installationId : app.simaya.installationId,
              message : message,
              nodes : nodes,
              grouped : grouped,
              simaya : app.simaya,
              groupedBase64 : (new Buffer(JSON.stringify(grouped)).toString("base64"))
            }, 
            "base-admin-authenticated");

            return;

          });
        } else {

          utils.render(req, res, 
          template || "admin-local-node-requests", 
          {
            installationId : app.simaya.installationId,
            message : message,
            nodes : nodes,
            simaya : app.simaya,
          }, 
          "base-admin-authenticated");

        }
      });
    }

    if (app.simaya.installation == "local"){
      options.installationId = app.simaya.installationId;
      return nodes("localNodes");
    }
    return nodes("nodeRequests", "admin-node-requests");
  }

  var downloadCert = function(req, res){
    var id = req.params.id;
    Node.loadFile({ fileId: id, stream : res}, function(err) {
      if (err){
        // todo: handle this error
        console.log (err);
      }
    });
  }

  /**
   * Update a node info
   * @param  {[type]} req [description]
   * @param  {[type]} res [description]
   */
  var putNodeJSON = function(req, res){
    var id = req.params.id;
    var options = req.body;

    if (options.action){
      options._id = id;
      Node[options.action](options, function(err, updated){
        
        console.log (err);

        if (err){
          return res.send(404, err);
        }
        res.send({ success : true, _id : id, action : options.action});
      });
    }
  }

  /**
   * Remove a node async
   * @param  {[type]} req [description]
   * @param  {[type]} res [description]
   */
  var removeNodeJSON = function(req, res){
    var id = req.params.id;
    var col = req.query.col || "node";
    Node.remove({_id : id, collection : col}, function(err){ 
      console.log (err);
      if (err) {
        return res.send(404, err);
      }
      res.send({ success : true, _id : id});
    });
  }

  /**
   * Download a node's public certificate
   * @param  {[type]} req [description]
   * @param  {[type]} res [description]
   */
  var getNodeCert = function (req, res){
    var id = req.params.id;
    Node.nodes({_id : id}, function(err, node){
      if(err){
        return res.send(404, err);
      }
      var payload = node.publicCert;
      var filename = node.name + "_" + node.administrator;
      filename = filename.toLowerCase();
      filename = filename.split(".").join("_");
      filename = filename.split(" ").join("_");
      res.header("Content-Disposition", "attachment; filename='" + filename + ".pub'");
      res.send(payload);
    });
  }

  /**
   * Create a node
   * @param  {[type]} req [description]
   * @param  {[type]} res [description]
   */
  var createNode = function(req, res){

    function credentialsFn(key, cb){
      Node.getRequestKey({ key : key}, function(err, info){
        if (err) return cb(err);
        if (!info) return cb(new Error("not found"));

        console.log (info);

        var credentials = {
          id : info.key,
          key : info.secret,
          algorithm: "sha256",
          user : info.administrator
        }
        cb(null, credentials);

      });
    }

    // authenticate the request
    Hawk.server.authenticate(req, credentialsFn, {}, function (err, credentials, artifacts) {
      if (err){
        // on credentialsFn error
        if (!err.output){
          return res.send(404);
        } 

        // ignore timestamp validation for now, since it will be difficult to sync the client and server time
        if (err.output.payload.message != "Stale timestamp"){

          // other than stale timestamp, send the error
          return res.send(err.output.payload.statusCode, err);
        }
      } 

      Node.processRequest({ credentials : credentials, artifacts : artifacts, payload : req.body}, function(err){
        if (err) {
          console.log(err);
          res.send(401, err);
        }

        Node.fillUser({ username : credentials.user}, function(err, user){
          if (err) res.send(401, err);

          var profile = {
            username : user.username,
            profile : user.profile
          }

          res.send({ success : true, administrator : profile });
        });
      });
    });
  }

  var checkLocalNode = function(req, res) {
    var installationId = req.params.id;

    var options = {
      installationId: installationId,
    }

    Node.localCheckNode(options, function(err, result) {
      if (err) return res.send(500, err.message);
      res.send(result);
    });
  }
  
  var checkSync = function(req, res) {
    var installationId = req.params.id;

    var options = {
      installationId: installationId,
      local: true
    }

    Node.checkSync(options, function(err, result) {
      if (err) return res.send(500, err.message);
      res.send(result);
    });
  }

  var syncLocalNode = function(req, res) {
    var installationId = req.params.id;

    var options = {
      installationId: installationId,
    }

    var client = gearmanode.client({servers: app.simaya.gearmanServer});
    var job = client.submitJob("sync", JSON.stringify(options));

    job.on("complete", function() {
      client.close();
      res.send(JSON.parse(job.response));
    }); 

  }

  var userCategory = function(req, res){
    category.list(function(categoryList) {
      var vals = [];
      vals.categoryList = categoryList;
      if (req.successful) {
        vals.successful = req.successful;
      }
      if (req.removed) {
        vals.removed = req.removed;
      }
      return utils.render(req, res, 'admin-user-category', vals, 'base-admin-authenticated');
    });
  }
  var newUserCategory = function (req, res) {
    var vals = {};
    if (req.path) {
      if (req.path.indexOf('/admin') > -1) {
        if (typeof(req.body) === "object" && Object.keys(req.body).length != 0) {
          vals.categoryName = req.body.categoryName;
          vals.categoryDesc = req.body.categoryDesc;
          vals.categoryId = req.body.categoryId;
          vals.idLength = req.body.idLength;
          category.insert(vals, function(err){
            if (err) {
              if (err.categoryName) {
                vals.duplicateCategory = req.body.categoryName;
                vals.categoryName = "";
              }
              if (err.idLength) {
                vals.invalidIdLength = true;
                vals.idLength = "";
              }
              vals.unsuccessful = true;
              vals.form = true;
              utils.render(req, res, 'admin-user-category-form', vals, 'base-admin-authenticated');
            } else {
              req.successful = req.body.categoryName;
              userCategory(req,res);
            }
          });      
        
        } else {
          vals.form = true;
          utils.render(req, res, 'admin-user-category-form', vals, 'base-admin-authenticated');
        }
      } else {
        res.redirect("/")
      }
    }
  }
  var editUserCategory = function(req, res) {
    var vals = {
      editMode: true,
      requireAdmin: true,
      categoryName: req.body.categoryName,
      categoryDesc: req.body.categoryDesc,
      categoryId: req.body.categoryId,
      idLength: req.body.idLength,
    }
    var data = {
      categoryName : req.body.categoryName,
      categoryDesc : req.body.categoryDesc,
      categoryId : req.body.categoryId,
      idLength : req.body.idLength,
    }
 
    if (Object.keys(req.body).length != 0) {
      if (req.body.remove) {
        category.remove(req.body.oldCategoryName, function(){
          req.removed = req.body.oldCategoryName;
          userCategory(req, res);
        }); 
      } else {
          category.edit(req.body.oldCategoryName, data, function(err) {
          if (err) {
            if (err.idLength) {
              vals.invalidIdLength = true;
              vals.idLength = "";
            }
            vals.unsuccessful = true;
            vals.form = true;
            utils.render(req, res, 'admin-user-category-form', vals, 'base-admin-authenticated');
          } else {
            req.successful = true;
          }
          auditTrail.record({
            collection: "userCategory",
            changes: {
              renameUserCategory: {
                from: req.body.oldCategoryName,
                to: req.body.categoryName
              }
            },
            session: req.session.remoteData,
            result: vals.successful
          }, function(err, audit) {
            userCategory(req,res);
          });
  
        });
        }
    } else {
      category.list({categoryName: req.params.id }, function(r) {
        vals.categoryName = req.params.id;
        if (r.length == 1) {
          vals.form = true;
          vals.categoryName = r[0].categoryName; 
          vals.categoryDesc = r[0].categoryDesc; 
          vals.categoryId = r[0].categoryId; 
          vals.idLength = r[0].idLength; 
        } else {
          vals.categoryNotFound = true;
          vals.unsuccessful = true;
        }
        utils.render(req, res, 'admin-user-category-form', vals, 'base-admin-authenticated');
      });
    }
  }

  return {
    newUser: newUser,
    newUserBase: newUserBase,
    editUser: editUser,
    editUserBase: editUserBase,
    removeUsers: removeUsers,
    user: userList,
    userBase: userListBase,
    userListJSON: userListJSON,
    admin: adminList,
    adminBase: adminListBase,
    diskStatus: diskStatus,
    adminStructure: adminStructure,
    adminListInOrgJSON: adminListInOrgJSON,
    userListInOrgJSON: userListInOrgJSON,
    headInOrgJSON: headInOrgJSON,
    removeHeadInOrg: removeHeadInOrg,
    auditList: auditList,
    auditDetail: auditDetail,
    createNode : createNode,
    getNodes : getNodes,
    getNodeCert : getNodeCert,

    getNodeRequests : getNodeRequests,
    putNodeRequests : putNodeRequests,

    putNodeJSON : putNodeJSON,
    removeNodeJSON : removeNodeJSON,
    downloadCert : downloadCert,

    checkLocalNode: checkLocalNode,
    checkSync: checkSync,
    syncLocalNode: syncLocalNode,
    userCategory: userCategory,
    newUserCategory: newUserCategory,
    editUserCategory: editUserCategory,
  }
};
