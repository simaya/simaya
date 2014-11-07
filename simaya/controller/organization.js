module.exports = function(app) {
  var gearmanode = require("gearmanode");
  var org = require('../models/organization.js')(app)
    , jobTitle = require('../models/jobTitle.js')(app)
    , utils = require('../../sinergis/controller/utils.js')(app)
    , user = require('../../sinergis/models/user.js')(app)
    , async = require('async')
    , letterDb = app.db('letter')
    , deputyDb = app.db('deputy')
    , templateDb = app.db('template')
    , sinergisVar = app.get('sinergisVar')
    , auditTrail = require("../models/auditTrail.js")(app)
    , ObjectID = app.ObjectID;

  var auditTrail = require("../models/auditTrail.js")(app);

  // Find all letters containing organization path, it checks receivingOrganizations and senderOrganization
  // Returns via callback
  //    error: The error
  //    idValueArray: [{ _id, value : ''}], 
  //      array of _id and value (the 'value' possible values: 'receivingOrganizations', 'senderOrganization', 'senderOrganization,receivingOrganizations')
  //      these possible values indicating the letter has been labeled containing organization path (full, or partial) 
  //      whether in 'receivingOrganizations', 'senderOrganization' or both
  //      e.g [{ _id : 3672836817693236, value: 'senderOrganization'}, 
  //           { _id : 2h31iu321gwuysd, value: 'senderOrganization,receivingOrganizations'}, 
  //            ...
  //          ]
  var lettersIn = function(organization, done){
    function map(){
      if(this.receivingOrganizations != null){

        for(var k in this.receivingOrganizations) {
          if(k.indexOf(organization) > -1) {
            emit( this._id, 'receivingOrganizations')
          }
        }
      }

      if (this.senderOrganization && this.senderOrganization.indexOf(organization) > -1)
      {
        emit( this._id, 'senderOrganization')
      }
    }

    function reduce(key, values){

      function unique(data){
        var u = {}; var a = [];
        for(var i = 0; i < data.length; i++){
          if(u[data[i]]){ continue; }
          a.push(data[i])
          u[ data[i] ] = 1
        }
        return a
      }

      return unique(values).join(',')
    }

    var options = {
      out : { inline : 1},
      scope : { organization : organization}
    }

    letterDb.findArray(function(err, test){
      if (test.length > 0) {
        letterDb.mapReduce(map, reduce, options, function(err, res){
          done(err, res)
        })
      }else {
        done(null, [])
      }
    })
  }

  // Proxy to org.exists to return callback in standard way (error in the first arg)
  var orgExists = function(name, cb){
    org.exists(name, function(exists){
      cb(null, exists)
    })
  }

  // Proxy to user.list to return callback in standard way (error in the first arg)
  var userSearch = function(orgName, cb){
    user.list({search : { "profile.organization" : {$regex : ".*" + orgName + ".*"} }}, function(r){
      cb(null, r)
    })
  }

  // search deputy inside the organization
  var deputySearch = function(orgName, cb){
    deputyDb.findArray({ organization : {$regex : ".*" + orgName + ".*" } }, cb)
  }

  // search template sharedTo an organization
  var templateSearch = function(orgName, cb){
    templateDb.findArray({ sharedTo : {$regex : ".*" + orgName + ".*" }  }, cb);
  }

  // Update users in paralel given old organization path, and replace it with new organization path (full path)
  var updateUsers = function(oldOrg, newOrg, callback){

    function modifyProfile(u, cb){
      var profile = u.profile
      profile.organization = profile.organization.split(oldOrg).join(newOrg)
      user.modifyProfile(u.username, profile, function(validator) {
        if(validator.hasErrors()) {
          return cb(new Error('Error modify profile ' + u))
        }
        else{
          cb(null, true)
        }
      })
    }

    userSearch(oldOrg, function(err, users){
      if(err) return callback(err)
      async.map(users, modifyProfile, function(err, result){
        if(result.indexOf(false) > -1 || err){
          return callback(new Error('Failed to update for some users'))
        }
        callback(null, true)
      })
    })
  }

  // Update deputies in paralel given old organization path, and replace it with new organization path (full path)
  var updateDeputies = function(oldOrg, newOrg, callback){

    function modifyOrg(dep, cb){
      dep.organization = dep.organization.split(oldOrg).join(newOrg)
      deputyDb.save(dep, function(err){
        if(err){
          return cb(new Error('Error modify profile ' + dep))
        }else{
          cb(null, true)
        }
      })
    }

    deputySearch(oldOrg, function(err, deputies){
      if(err) return callback(err)
      async.map(deputies, modifyOrg, function(err, result){
        if(result.indexOf(false) > -1 || err){
          return callback(new Error('Failed to update for some deputies'))
        }
        callback(null, true)
      })
    })
  }

  // Update letters in parallel, given old organization path, and replace it with new organization path (full path)
  // this function uses lettersIn to search all related letters
  var updateLetters = function(oldPath, newPath, callback){

    function repathLetter(lett, cb){
      var arrTypes = lett.value.split(',')

      letterDb.findOne({ _id : lett._id}, function(err, l){

        if(err) return cb(err)

        var i;
        for(i = 0; i < arrTypes.length; i++){
          var type = arrTypes[i]

          if (type == 'senderOrganization'){
            if (l.senderOrganization.indexOf(oldPath) > -1) {
              l.senderOrganization = newPath
            }
          }

          if(type == 'receivingOrganizations'){

            var temp = {}
            var orgs = {}
            temp = l.receivingOrganizations

            for(var k in temp){
              var p = k.split(oldPath).join(newPath)
              orgs[p] = temp[k]
            }
            l['receivingOrganizations'] = orgs
          }
        }
        letterDb.save(l, function(err){
          cb(err, true)
        })
      })
    }

    lettersIn(oldPath, function(err, data){
      if (data) {
        async.map(data, repathLetter, function(err, results){
          callback(err, results)
        })
      }else {
        callback(err, [])
      }

    })
  }

  // update templates in parallel given old organization path, and replace it with new organization path (full path) 
  var updateTemplates = function(oldOrg, newOrg, callback){

    function modifyOrg(template, cb){

      template.sharedTo = template.sharedTo.split(oldOrg).join(newOrg);

      templateDb.save(template, function(err){
        if (err) {
          return cb(new Error('Error modify profile ' + template));
        }else{
          cb(null, true);
        }
      })
    }

    templateSearch(oldOrg, function(err, templates){
      if (err) {
        return callback (err);
      }

      var templatesArr = templates || [];
      async.map(templatesArr, modifyOrg, function(err, result){
        if (result.indexOf(false) > -1 || err) {
          return callback(new Error('Failed to update for some templates'));
        }
        callback (null, true);
      })
    })
  }

  // Sync users, letters, deputies and templates given old organization path and replace it with new organization path (full path)
  var syncRelatedCollections = function(oldPath, newPath, cb){

    if (!oldPath) {
      // new organization
      return cb(null)
    }

    if (oldPath && !newPath) {
      // new path is required
      return cb(new Error("New path is required"))
    }

    if(oldPath && newPath) {
      // new path is required
      if (newPath.length == 0) {
        return cb(new Error("New path is required"))
      }
    }

    async.parallel([
      function(callback){
        updateUsers(oldPath, newPath, callback)
      },
      function(callback){
        updateLetters(oldPath, newPath, callback)
      },
      function(callback){
        updateDeputies(oldPath, newPath, callback)
      },
      function(callback){
        updateTemplates(oldPath, newPath, callback)
      }
    ], cb)
  }

  var list = function(req, res) {
    var myOrganization = req.session.currentUserProfile.organization;
    var onlyFirstLevel = {path: {$regex: "^[^;]*$"}}
    var search = undefined;

    if (req.query.exclude) {
      search = {path: {$ne: myOrganization}};
    } else if (req.query.prefix) {
      search = {path: {$regex: "^" + req.query.prefix}};
    } else if (req.query.onlyFirstLevel) {
      search = onlyFirstLevel;
    }

    org.list(search, function(r) {
      res.send(JSON.stringify(r));
    });
  }

  var viewWeb = function(req, res) {
    view({}, false, "organization-view", req, res);
  }

  var viewJson = function(req, res) {
    view({}, true, "", req, res);
  }

  var view = function(vals, json, template, req, res) {
    vals.title = sinergisVar.appName;
    vals.isAdminMenu = true;

    var path = req.query.path;
    var roles = req.session.currentUserRoles;
    if (roles && roles.length > 0) {
      roles.forEach(function(item) {
        if (item == "localadmin") {
          var myOrganization = req.session.currentUserProfile.organization;
          if (path == null || typeof(path) === "undefined") {
            path = myOrganization;
          }
          if (myOrganization == "" || typeof(myOrganization) === "undefined") {
            // this local admin is not tied to any organization,
            // this will prevent her to see the organization structure
            path = "No organization set";
          }
          vals.localAdmin = true;
        }
      });
    }
    if (path != null && path != "") {
      vals.path = path;
      var pos = path.lastIndexOf(';');
      if (pos > 0) {
        vals.parent = path.substr(0, pos);
        vals.name = path.substr(pos + 1);
        pos = vals.parent.lastIndexOf(';');
        if (pos > 0) {
          vals.parentName = vals.parent.substr(pos + 1);
        } else {
          vals.parentName = vals.parent;
        }
      } else {
        delete vals.parent;
        vals.name = path;
      }
    } else {
      delete vals.parent;
      path = null;
    }

    org.exists(path, function(exists) {
      if (exists == false && path != null) {
        if (json) {
          res.send([]);
          return;
        }
      }

      if (req.query.includeParent) {
        var query = { $or: [] };

        if (req.query.includeChildren) {
          query["$or"].push({ path: {$regex: '^' + path + '$' }});
          query["$or"].push({ path: {$regex: '^' + path + ';' }});
        } else {
          query["$or"].push({ path: {$regex: '^' + path+ ';([^;]+)$'}});
        }
        query["$or"].push({ path: path });
        path = query;
      }

      org.list(path, function(r) {
        if (json) {
          res.send(JSON.stringify(r));
        } else {
          vals.organizations = r;
          org.findAll(path, function(err, results){
            var arr = [];
            for(var i = 0; i < results.length; i++){
              arr.push({path : results[i].path, id : results[i]._id,_id:results[i]._id})
            }
            vals.paths = JSON.stringify(arr);
            utils.render(req, res, template, vals, 'base-admin-authenticated');
          })
        }
      });
    });
  }

  var createOrEdit = function(vals, template, createFunction, req, res) {

    var param = null;
    var path = req.params.path || req.body.parent;
    var roles = req.session.currentUserRoles;
    if (roles && roles.length > 0) {
      roles.forEach(function(item) {
        if (item == "localadmin") {
          var myOrganization = req.session.currentUserProfile.organization;
          if (typeof(path) === "undefined" || path == null || (path != null && path.indexOf(myOrganization) != 0)) {
            path = myOrganization;
          }
          vals.localAdmin = true;
        }
      });
    }

    if (vals.edit == true || req.body.edit == "true") {
      if (req.body.oldPath && req.body.oldPath.length > 0) {
        vals.oldPath = req.body.oldPath;
        path = req.body.oldPath;
      }
      if (path != null && path != "") {
        vals.path = path;
        var pos = path.lastIndexOf(';');
        if (pos > 0) {
          vals.parent = path.substr(0, pos);
          vals.name = path.substr(pos + 1);
          pos = vals.parent.lastIndexOf(';');
          if (pos > 0) {
            vals.parentName = vals.parent.substr(pos + 1);
          } else {
            vals.parentName = vals.parent;
          }
        } else {
          delete vals.parent;
          vals.name = path;
        }
        if (req.body.parent != "") {
          param = req.body.parent + ";" + req.body.name;
        } else {
          param = req.body.name;
        }
        vals.param = param;
      } else {
        res.redirect("/organization/view");
        return;
      }
    } else {
      vals.path = path;
      if (path != null && path != "") {
        vals.parent = path;
        var pos = path.lastIndexOf(';');
        if (pos > 0) {
          vals.parentName = path.substr(pos + 1);
        } else {
          vals.parentName = path;
        }
      } else {
        delete vals.parentName;
        path = null;
      }
      param = { name: req.body.name };
    }

   if (typeof(req.body.name) !== "undefined") {

        syncRelatedCollections(vals.oldPath, vals.param, function(err, result){

          if (err) {
            vals.unsuccessful = true;
            vals.form = true;
            vals.errorMessages = vals.errorMessages || []
            vals.errorMessages.push('error:syncUsersDeputiesAndLetters');

            if(req.accepted.length > 0){
              if(req.accepted[0].subtype == 'json'){
                // send as json
                return res.send(vals)
              } else {
                return utils.render(req, res, template, vals, 'base-admin-authenticated');
              }
            }

            return utils.render(req, res, template, vals, 'base-admin-authenticated');

          } else {

            createFunction(path, param, function(v){
              auditTrail.record({
                collection: "organization",
                changes: {
                  edit: vals.edit || req.body.edit,
                  path: path,
                  data: param
                },
                session: req.session.remoteData,
                result: !vals.unsuccessful
              }, function(err, audit) {
                if(req.accepted.length > 0){
                  if(req.accepted[0].subtype == 'json'){
                    // send as json
                    return res.send(vals);
                  } else {
                    return utils.render(req, res, template, vals, 'base-admin-authenticated');
                  }
                }

                return utils.render(req, res, template, vals, 'base-admin-authenticated');

              });
            })
          }
      })

    } else {
      vals.form = true;
      if (vals.edit == true) {
        vals.oldPath = path;
      }
      utils.render(req, res, template, vals, 'base-admin-authenticated');
    }
  }

  var create = function(req, res) {
    var vals = {
      title: sinergisVar.appName,
    }

    createOrEdit(vals, "organization-new", org.create, req, res);
  }

  var move = function(req, res) {
    var client = gearmanode.client({servers: app.simaya.gearmanServer});
    var options = {
      source: req.body.source,
      destination: req.body.destination
    }

    auditTrail.record({
      collection: "organization",
      changes: options,
      session: req.session.remoteData
    }, function(err, audit) {
      var job = client.submitJob("moveOrganization", JSON.stringify(options));
    });
 
    res.send(200);
  }

  var edit = function(req, res) {
    var vals = {
      title: sinergisVar.appName,
      edit: true
    }

    if (req.body.operation == "move") {
      return move(req, res);
    }
    createOrEdit(vals, "organization-edit", org.edit, req, res);
  }

  var remove = function(req, res) {
    var vals = {
      title: sinergisVar.appName,
      organization: req.session.currentUserProfile.organization,
      profile:req.session.currentUserProfile
    }

    var path = req.params.path || req.body.path;
    if (path != null && path != "" && path !== vals.organization) {
      vals.path = path;
      var pos = path.lastIndexOf(';');
      if (pos > 0) {
        vals.parent = path.substr(0, pos);
        vals.name = path.substr(pos + 1);
        pos = vals.parent.lastIndexOf(';');
        if (pos > 0) {
          vals.parentName = vals.parent.substr(pos + 1);
        } else {
          vals.parentName = vals.parent;
        }
      } else {
        delete vals.parent;
        vals.name = path;
      }
    } else {
      if(req.query.json){
        res.send({
          success:false
        });
      }else{
        res.redirect("/organization/view");
      }
      return;
    }

   if (typeof(req.body.path) !== "undefined") {
      org.remove(path, function(v) {
        auditTrail.record({
          collection: "organization",
          changes: {
            removedPath: path,
          },
          session: req.session.remoteData,
        }, function(err, audit) {
          if(req.query.json){
            res.send({
              success:true
            });
          }else{
            vals.successful = true;
            utils.render(req, res, "organization-remove", vals, 'base-admin-authenticated');
          }
        });
      });
    } else {
     if(req.query.json){
       res.send({
         success:false
       });
     }else{
       vals.form = true;
       utils.render(req, res, "organization-remove", vals, 'base-admin-authenticated');
     }
    }

  }

  var findLeaf = function(req, res) {
    if (req.params.id) {
      if (req.query.exclude) {
        org.findLeafFull(req.params.id, req.query.exclude, function(r) {
          res.send(JSON.stringify(r));
        });
      } else {
        org.findLeaf(req.params.id, function(r) {
          res.send(JSON.stringify(r));
        });
      }
    } else {
      res.send('[]');
    }
  }

  var listTitles = function(req, res) {
    if (req.params.path) {
      jobTitle.list({ search: { organization: req.params.path}}, function(r) {
        res.send(JSON.stringify(r));
      });
    } else {
      res.send('[]');
    }
  }

  var listMyTitles = function(req, res) {
    var myOrganization = req.query.organization || req.session.currentUserProfile.organization;
    jobTitle.list({ search: { organization: myOrganization}}, function(r) {
      res.send(JSON.stringify(r));
    });
  }

  return {
    create: create
    , edit: edit
    , view: viewWeb
    , viewBase: view
    , jview: viewJson
    , remove: remove
    , findLeaf: findLeaf
    , list: list
    , listTitles: listTitles
    , listMyTitles: listMyTitles
    , syncRelatedCollections : syncRelatedCollections
    , userSearch : userSearch
  }
};
