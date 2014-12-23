module.exports = function(app) {
  var utils = require('../../sinergis/controller/utils.js')(app)
  , user = require('../../sinergis/models/user.js')(app)
  , mUtils = require('../models/utils.js')(app)
  , contacts = require('../models/contacts.js')(app)
  , moment = require("moment")
  , ObjectID = app.ObjectID
  , base64Stream = require("base64-stream")
  , openUri = require("open-uri")
  var fs = require('fs');
  require("js-object-clone");

  // for copying socials in modifyProfile  
  require('../models/deepCopy.js');
 
  var changePassword = function(req, res) {
    
    var vals = {
      title: 'Ubah Kata Sandi Pengguna',
      requireAdmin: true
    }

    var breadcrumb = [
      {text: 'Profil', link: '/profile'},
      {text: 'Ubah Kata Sandi', isActive: true}
    ];
    vals.breadcrumb = breadcrumb;
 
    if (Object.keys(req.body).length != 0) {
      if (req.body.password != req.body.password2) {
        vals.unsuccessful = true;
        vals.passwordUnconfirmed = true;
        vals.form = true;
        utils.render(req, res, 'profile-change-password', vals, 'base-authenticated');
        return;
      }

      vals.username = req.body.username;

      user.changePassword(req.body.username, req.body.password, function(v) {
        if (v.hasErrors() > 0) {
          vals.unsuccessful = true;
          vals.form = true;
          vals.user = req.body.username;
          vals.errors = v.errors;

          utils.render(req, res, 'profile-change-password', vals, 'base-authenticated');
        } else {
          vals.successful = true;
          utils.render(req, res, 'profile-change-password', vals, 'base-authenticated');
        }
      });
    } else {
      vals.form = true;
      vals.username = req.session.currentUser;
      user.list({ search: {username: vals.username}}, function(r) {
        if (r.length == 0) {
          vals.unsuccessful = true;
          vals.noSuchUser = true;
        } else {
          vals.form = true; 
        }
        utils.render(req, res, 'profile-change-password', vals, 'base-authenticated');
      });
    }
  }

  var associateEmails = function(count, username, req, res, callback) {
    if (typeof(req.body["profile.emails"]) == "string") {
      req.body["profile.emails"] = [req.body["profile.emails"]];
    }
    if (count < req.body["profile.emails"].length) {
      user.associateEmail(username, req.body["profile.emails"][count], function(token, v) {
        user.activateEmailAssociation(token, req.body["profile.emails"][count], function(r) {
          associateEmails(count + 1, username, req, res, callback);
        })
      })
    } else {
      callback();
    }
  }

  var modifyProfile = function(req, res) {
    var vals = { 
      username: req.session.currentUser,
      requireAdmin: true
    }

    var breadcrumb = [
      {text: 'Profil', link: '/profile'},
      {text: 'Ubah', isActive: true}
    ];
    vals.breadcrumb = breadcrumb;

    vals.user = {
      profile: Object.clone(req.session.currentUserProfile, true)
    } 
    if (Object.keys(req.body).length > 0) {
      var oldProfile = req.session.currentUserProfile;
      if (req.body["profile.phones"]) {
        if (typeof(req.body["profile.phones"]) == "string") {
          req.body["profile.phones"] = [ req.body["profile.phones"] ];
        }
        oldProfile.phones = req.body["profile.phones"];
      }
      if (req.body["profile.address"]) {
        oldProfile.address = req.body["profile.address"];
      }
      if (req.body["profile.dates"]) {
        oldProfile.dates = req.body["profile.dates"];
      }
      if (req.body["profile.website"]) {
        oldProfile.website = req.body["profile.website"];
      }
      if (req.body["profile.npwp"]) {
        oldProfile.npwp = req.body["profile.npwp"];
      }
      if (req.body["profile.nik"]) {
        oldProfile.nik = req.body["profile.nik"];
      }
      vals.user.profile = Object.clone(oldProfile, true);
      if (req.body["profile.socials.type"]) {
        var socials = []
        vals.user.profile.socials = [];
        if (typeof(req.body["profile.socials.type"]) === "string") {
          if (req.body["profile.socials.value"]) {
            socials.push({
              type: req.body["profile.socials.type"],
              value: req.body["profile.socials.value"],
            })
            vals.user.profile.socials.push({
              type: req.body["profile.socials.type"],
              value: req.body["profile.socials.value"] 
            })
            vals.user.profile.socials[req.body["profile.socials.type"] + "Selected"] = "selected";
          }
        } else {
          for (var i = 0; i < req.body["profile.socials.type"].length; i ++) {
            if (req.body["profile.socials.value"][i]) {
              socials.push({
                type: req.body["profile.socials.type"][i],
                value: req.body["profile.socials.value"][i],
              })
              vals.user.profile.socials.push({
                type: req.body["profile.socials.type"][i], 
                value: req.body["profile.socials.value"][i] 
              })
              vals.user.profile.socials[i][req.body["profile.socials.type"][i] + "Selected"] = "selected";
            }
          }
        }
      }
      oldProfile.socials = Object.clone(socials, true);

      vals.dateBirthdayDijit = req.body["profile.dates"].birthday; 
      vals.dateSpecialDijit = req.body["profile.dates"].special; 

      var modifyProfile2ndStage = function() {
        user.modifyProfile(vals.username, oldProfile, function(v) {
          vals.user.profile.class = mUtils.convertClass(vals.user.profile.class);

          if (req.body["profile.emails"]) {
            if (typeof(req.body["profile.emails"]) == "string") {
              req.body["profile.emails"] = [ req.body["profile.emails"] ];
            }
            user.emailList(vals.username, function(list) {
              var deleted = [];
              var hash = {};
              for (var i = 0; i < req.body["profile.emails"].length; i++) {
                hash[req.body["profile.emails"][i]] = 1;
              }
              for (var i = 0; i < list.length; i ++) {
                if (hash[list[i].email] != 1) {
                  deleted.push(list[i].email);
                }
              }
              vals.user.profile.emails = [];
              Object.keys(hash).forEach(function(e) {
                vals.user.profile.emails.push(e);
              })
              associateEmails(0, vals.username, req, res, function() {
                if (deleted.length > 0) {
                  user.disassociateEmail(vals.username, deleted, function(r) {
                    utils.render(req, res, 'profile', vals, 'base-authenticated');
                  })
                } else {
                  utils.render(req, res, 'profile', vals, 'base-authenticated');
                }
              })
            })
          } else {
            utils.render(req, res, 'profile', vals, 'base-authenticated');
          }
        })
      }

      if (req.files["profile.avatar"] && typeof(req.files["profile.avatar"]) !== "undefined" && req.files["profile.avatar"].name != "") {
        var exec = require('child_process').exec;
        var child;
        child = exec("mogrify -resize 512 " + req.files["profile.avatar"].path, function() {
          var fileId = new ObjectID();
          var store = app.store(fileId, "w");
          var fd = fs.openSync(req.files["profile.avatar"].path, "r");
          store.open(function(error, gridStore) {
            gridStore.writeFile(fd, function(error, result) {
              fs.unlinkSync(req.files["profile.avatar"].path);
              oldProfile.avatar = result.fileId;
              modifyProfile2ndStage();
            })
          });
        })
      } else {
        modifyProfile2ndStage();
      }
    } else {
      user.list({ search: {username: vals.username}}, function(r) {
        vals.user = r[0];
        if (typeof(vals.user.profile.dates) === "undefined" || 
            (vals.user.profile.dates && typeof(vals.user.profile.dates.birthday) === "undefined")) {
          var d = new Date(1970, 1, 1);
          vals.dateBirthdayDijit = moment(d).format("YYYY-MM-DD");
        } else {
          vals.dateBirthdayDijit = vals.user.profile.dates.birthday;
        }
        if (typeof(vals.user.profile.dates) === "undefined" || 
            (vals.user.profile.dates && typeof(vals.user.profile.dates.special) === "undefined")) {
          var d = new Date();
          vals.dateSpecialDijit = moment(d).format("YYYY-MM-DD");
        } else {
          vals.dateSpecialDijit = vals.user.profile.dates.special;
        }
 
        if (vals.user.profile.socials) {
          for (var i = 0; i < vals.user.profile.socials.length; i ++) {
            vals.user.profile.socials[i][vals.user.profile.socials[i].type + "Selected"] = "selected";
          }
        }

        var hash = {}
        user.emailList(vals.username, function(list) {
          for (var i = 0; i < list.length; i ++) {
            hash[list[i].email] = 1;
          }
          vals.user.profile.emails = [];
          Object.keys(hash).forEach(function(e) {
            vals.user.profile.emails.push(e);
          })
          vals.user.profile.class = mUtils.convertClass(vals.user.profile.class);
          utils.render(req, res, 'profile', vals, 'base-authenticated');
        })
      });
    }
  }

  var getStatusJSON = function(req, res) {
    if (req.query && req.query.username) {
      contacts.listByUser(req.session.currentUser, {end2: req.query.username, established: true}, function(r) {
        if (r != null && r.length > 0) {
          user.list({ search: {username: req.query.username}}, function(r) {
            if (r != null && r.length == 1) {
              res.send(JSON.stringify(r[0].profile.presence))
            } else {
              res.send(JSON.stringify("ERROR no presence"))
            }
          })
        } else {
          res.send(JSON.stringify("ERROR not authorized"))
        }
      })
    } else {
      res.send(JSON.stringify("ERROR"))
    }
  }

  var updateStatusJSON = function(req, res) {
    user.list({ search: {username: req.query.username}}, function(r) {
      if (r != null && r.length == 1 && typeof(req.query.statusText) !== "undefined") {
        var presence = {
          statusText: req.query.statusText,
          statusDate: new Date()
        }
        var profile = r[0].profile;
        profile.presence = presence;
        user.modifyProfile(req.query.username, profile, function(v) {
          res.send(JSON.stringify("OK"))
        })
      } else {
        res.send(JSON.stringify("ERROR"))
      }
    })
  }

  var viewProfile = function(req, res) {
    var vals = {
      requireAdmin: true
    }

    var breadcrumb = [
      {text: 'Profil', link: '/profile'},
      {text: 'Lihat', isActive: true}
    ];
    vals.breadcrumb = breadcrumb;

    if ((req.query && req.query.username)||req.body.username) {
      vals.username = req.body.username || req.query.username;
      user.list({ search: {username: vals.username}}, function(r) {
        vals.user = r[0];
        vals.user.profile.emails = [];
        vals.user.profile.class = mUtils.convertClass(vals.user.profile.class);
        if (vals.user.emailList) {
          console.log(vals.user.emailList);
          for (var i = 0; i < vals.user.emailList.length; i++) {
            vals.user.profile.emails.push(vals.user.emailList[i]["email"])
          }
        }
        if (vals.user.profile.socials) {
          for (var i = 0; i < vals.user.profile.socials.length; i++) {
            vals.user.profile.socials[i][vals.user.profile.socials[i]["type"] + "Selected"] = true;
          }
        }
        if (vals.user.profile.dates) {
          if (vals.user.profile.dates.birthday) {
            vals.dateBirthday = moment(vals.user.profile.dates.birthday).format("DD MMMM YYYY");
          }
          if (vals.user.profile.dates.special) {
            vals.dateSpecial = moment(vals.user.profile.dates.special).format("DD MMMM YYYY");
          }
        }
        var me = req.session.currentUser;
        if (req.body.notes) {
          contacts.setNotes(me, req.body.username, req.body.notes, function() {
            contacts.getNotes(me, req.body.username, function(notes) {  
              vals.notes = notes;
              utils.render(req, res, "profile-view", vals, "base-authenticated");
            });
          });
        } else {
          contacts.getNotes(me, vals.username, function(notes) {  
            vals.notes = notes;
            utils.render(req, res, "profile-view", vals, "base-authenticated");
          });

        }
      }); 
    } else {
      res.redirect("/");
    }
  }

  var getGender = function(id) {
    if (id && id.length == 18) {
      if (id.charAt(14) == 1) {
        return "male";
      } else {
        return "female";
      }
    } else {
      return "male";
    }
  }

  var renderDefaultAvatar = function(base64, gender, req, res) {
    if (typeof(gender) === "undefined") {
      gender = "male";
    }
    var defaultAvatar = "/img/default-avatar-" + gender + ".png";
    if (base64) {
      var e = new base64Stream.encode();
      e.pipe(res);
      // Always gets from localhost
      openUri("http://127.0.0.1:" + app.get("port") + defaultAvatar, e);
    } else {
      openUri("http://127.0.0.1:" + app.get("port") + defaultAvatar, res);
    }
  }

  // req.query.username is expected to exists
  var downloadAvatar = function(base64, req, res) {
    user.list({search: {username: req.query.username}}, function(item) {
      if (item != null && item.length == 1) {
        if (item[0].profile.avatar) {
          var store = app.store(ObjectID(item[0].profile.avatar + ""), "r");
          store.open(function(error, gridStore) {
            if (gridStore) {
            var gridStream = gridStore.stream(true);
              if (base64) {
                gridStream.pipe(base64Stream.encode()).pipe(res);
              } else {
                gridStream.pipe(res);
              }
            } else {
              res.end();
            }
          });
        } else {
          renderDefaultAvatar(base64, getGender(item[0].profile.id), req, res);
        }
      } else {
        renderDefaultAvatar(base64, "male", req, res);
      }
    })
  }

  var getAvatarStreamBase = function(base64, req, res) {
    if (req.query && req.query.username) {
      downloadAvatar(base64, req, res);
    } else {
      renderDefaultAvatar(base64, "male", req, res);
    }
  }
  
  var getAvatarStream = function(req, res) {
    getAvatarStreamBase(false, req, res);
  }

  var getAvatarBase64Stream = function(req, res) {
    getAvatarStreamBase(true, req, res);
  }

  return {
    changePassword: changePassword
    , modifyProfile: modifyProfile
    , viewProfile: viewProfile
    , updateStatusJSON: updateStatusJSON
    , getStatusJSON: getStatusJSON
    , getAvatarStream: getAvatarStream
    , getAvatarBase64Stream: getAvatarBase64Stream
  }
}
