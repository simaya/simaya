module.exports = function(app) {
  // Private 
  var db = app.db('user')
    , bcrypt = require('bcrypt')
    , crypto = require('crypto')
    , async = require('async')
    , organization = app.db('organization')
    , _ = require("lodash")
    , self = this

  function crypt(password){
    var salt = bcrypt.genSaltSync(10);  
    return bcrypt.hashSync(password, salt);
  }

  // Validation function
  db.validate = function(document, update, callback) {

    var validator = app.validator(document, update);

    async.waterfall([
      // 1. validate username
      function(callback){
        validator.validateRegex({ username : [/^[a-zA-Z0-9-:._]{3,100}$/, 'invalid']})

        if(!validator.hasErrors()){
          // 1.1 check if username already exists
          validator.validateQuery({ username : [db, {username : update.username}, false, 'exists;' + update.username]}, function(){
            return callback(null, validator.errors)
          })
        }else{
          return callback(null, validator.errors)  
        }
      },
      function(errors, callback){
        // 2. validate password
        validator.validateRegex({ password : [validator.regex.password, 'invalid']})

        if(!validator.hasErrors()){
          if(update.password != update.password2){
            validator.errors['password confirmation'] = validator.errors['password confirmation'] || []
            validator.errors['password confirmation'].push('invalid')
          } else {
            delete update.password2;
          }
        }

        callback(null, validator.errors)
      },
      function(errors, callback){
        if (update.profile && update.profile.hasOwnProperty('emailList')) {
          var emails = update.profile.emailList
          var root = self

          function valid(email, cb){
            if(!validator.regex.email.test(email)){
              validator.errors['email'] = validator.errors['email'] || []
              validator.errors['email'].push('invalid;' + email)
              return cb(null, validator.errors)
            }
            else{
              db.findOne({'emailList.email' : email}, function(err, user){
                if(user){
                  validator.errors['email'] = validator.errors['email'] || []
                  validator.errors['email'].push('exists;' + email)
                }else{
                  update.emailList = update.emailList || []
                  update.emailList.push({ email : email, isValidated : true, validationDate : new Date()})
                }

                return cb(null, validator.errors)
              })              
            }
          }

          // 3. validate emails
          async.map(emails, valid, function(err, results){
            callback(null, validator.errors)
          })

      }else{
        callback(null, errors)
      }
    },
    function(errors, callback){
      if (update.profile && update.profile.hasOwnProperty('phones')) {
        var phones = update.profile.phones
        var root = self

        function valid(phone, cb){
          var valid = phone.toString().trim().replace(/[^\d]/g,'')
          if(!valid || valid.length < 8) {
            validator.errors['phone'] = validator.errors['phone'] || []
            validator.errors['phone'].push('invalid;' + phone)
            return cb(null, validator.errors)
          }
          else{
            db.findOne({'profile.phones' : phone}, function(err, user){
              if(user){
                validator.errors['phone'] = validator.errors['phone'] || []
                validator.errors['phone'].push('exists;' + phone)
              }
              return cb(null, validator.errors)
            })              
          }
        }

        // 3. validate phones
        async.map(phones, valid, function(err, results){
          callback(null, validator.errors)
        })
      }else{
        callback(null, errors)
      }
    }
    
    ], function(err, results){
      callback(err, validator)
    })
  }

  // must be done before any insert
  // make sure the password is hashed
  db.beforeInsert = function(documents, callback) {
    documents.forEach(function (doc) {
      doc.modifiedDate = new Date();
      doc.password = crypt(doc.password); 
    });
    callback(null, documents);
  }

  // must be done before any update
  // make sure the password is hashed
  db.beforeUpdate = function(query, update, callback) {
    var isChangePassword = (update.$set.password != null);
    
    update.$set.modifiedDate = new Date();
    if (isChangePassword) {
      update.$set.password = crypt(update.$set.password);
      callback(null, query, update);
    } else {
      callback(null, query, update); 
    }
  }

  var emailList = function(user, callback) {
    db.findOne({username: user}, function(err, item) { 
      if (err == null && item != null) {
        if (typeof(item.emailList) === "undefined") {
          // no content yet
          callback([]);
        } else {
          callback(item.emailList);
        }
      } else {
        // Returns undefined
        callback();
      }
    });
  }
 
  var roleList = function(user, callback) {
    db.findOne({username: user}, function(err, item) { 
      if (err == null && item != null) {
        if (typeof(item.roleList) === "undefined") {
          // no content yet
          callback([]);
        } else {
          callback(item.roleList);
        }
      } else {
        // Returns undefined
        callback();
      }
    });
  }
 

  // Public API
  return {

    test : function(callback){
      callback(null, {hello : 'world'})
    },

    // Creates a user with password and profile
    // Returns a callback
    //    validator: The validator
    create: function (data, callback) {
      db.getCollection(function (error, collection) {
        data._id = collection.pkFactory.createPk();

        if (app.simaya.installationId) {
          data.username = "u" + app.simaya.installationId + ":" + data.username;
        }
        db.validateAndInsert(data, function (error, validator) {
          callback(validator);
        }); 
      });
    },

    // Modify profile 
    // Returns a callback
    //    validator: The validator
    modifyProfile: function(user, profile, callback) {
      var data = {
        profile: profile 
      };
      db.findOne({username: user}, function(err, item) { 
        if (err == null && item != null) {
          db.validateAndUpdate( {
            _id: item._id
          }, {
            '$set': data 
          }, function (error, validator) {
            callback(validator);
          }); 
       } else {
          var doc = { profile: profile };
          var validator = app.validator(doc, doc);
          validator.addError('username', 'Non-existant user');
          callback(validator);
       }
      });
    },
 
    // Changes password for the specified user
    // Returns a callback
    //    validator: The validator
    changePassword: function(user, password, callback) {
      var data = {
        username: user,
        password: password
      };
      db.findOne({username: user}, function(err, item) { 
        if (err == null && item != null) {
          db.validateAndUpdate( {
            _id: item._id
          }, {
            '$set': data 
          }, function (error, validator) {
            callback(validator);
          }); 
       } else {
          var doc = { username: user, password: password };
          var validator = app.validator(doc, doc);
          validator.addError('username', 'Non-existant user');
          callback(validator);
       }
      });
    },

    // Checks availability of specified user
    // Returns a callback:
    //    result: true if user is available
    checkAvailability: function(user, callback) {
      db.findOne({username:user}, function(err, item) { 
        if (err == null && item != null) {
          callback(true); 
          return;
        }
        callback(false); 
      });
    },

    // Checks activitity status of a specified user
    // Returns a callback:
    //    result: true if user is active
    isActive: function(username, callback) {
      db.findOne({username: username}, function(err, item) {
        var isActive = (err == null && item != null && item.active == true);
        if (isActive) {
          callback(true);
          return;
        }
        callback(false);
      });
    },

    // Set status of a specified user to be active
    // Returns a callback:
    setActive: function(user, callback) {
      db.findAndModify(
        {username: user},
        [],
        {$set: {
                 active: true,
                 modifiedDate: new Date()
               }},
        {new: true},
        function(err, result) {
          if (err == null) {
            callback(true);
            return;
          }
          callback(false);
        }
      );
    },
    
    // Set status of a specified user to be inactive
    // Returns a callback:
    setInActive: function(user, callback) {
      db.findAndModify(
        {username: user},
        [],
        {$set: {
                 active: false,
                 modifiedDate: new Date()
               }},
        {new: true},
        function(err, result) {
          if (err == null) {
            callback(true);
            return;
          }
          callback(false);
        }
      );
    },
 
    // Authenticate user 
    // Returns a callback:
    //    result: true if user is authenticated
    authenticate: function(user, password, callback) {
      if (user != "admin" && app.simaya.installationId && user.indexOf("u" + app.simaya.installationId + ":") == -1) {
        user = "u" + app.simaya.installationId + ":" + user;
      }
      db.findOne({username: user}, function(error, item) {
        var result = false;
        if (error == null && item != null) {
          result = bcrypt.compareSync(password, item.password);
        }
        callback(result);
      });
    },

    // Checks whether a specifieduser is expired 
    // Returns a callback:
    //    result: true if user is expired
    isExpired: function(user, date, callback) {
      db.findOne({username: user}, function(err, item) {
        var isExpired = (err == null && item != null && date > item.expireAt);
        if (isExpired) {
          callback(true);
          return;
        }
        callback(false);
      });
    },

    // Checks the expiry date of a user
    // Returns a callback:
    //    result: date object
    expiryDate: function(user, callback) {
      db.findOne({username: user}, function(err, item) {
        if (err == null && item != null) {
          callback(item.expireAt);
          return;
        }
        callback(new Date.parse("invalid-date"));
      });
    },

    // Sets the expiry date of a user
    // Returns a callback:
    setExpireDate: function(user, date, callback) {
      db.findAndModify(
        {username: user},
        [],
        {$set: {
                 expireAt: date,
                 modifiedDate: new Date()
               }},
        {new: true},
        function(err, result) {
          if (err == null) {
            callback(true);
            return;
          }
          callback(false);
        }
      );
    },

    // Removes a set of users
    removeUsers: function(users, callback) {
      db.remove({username: {$in: users}}, function(e) {
        if (callback) {
          if (err == null) {
            callback(true);
          } else {
            callback(false);
          }
        }
      });
    },

    // Lists user with optional search object of
    //    search: object query
    //    page: page index
    //    limit: number of records per page
    // Returns a callback:
    //    result: array of object of
    //      user: username
    //      createdDate: created date
    //      isActive: is active
    //      expireAt: expiry date
    list: function(search, callback) {
      if (typeof(search.search) === "undefined") {
        search.search = {};
      }
       
      var fields = search["fields"] || {};
      if (typeof(search.page) !== "undefined") {
        var offset = ((search.page - 1) * search.limit);
        var limit = search.limit;
        if (typeof(limit) === "undefined") {
          limit = 10; // default limit
        }

        db.find(search.search, fields, function(error, cursor) {
          cursor.sort(search.sort || {}).limit(limit).skip(offset).toArray(function (error, result) {
            callback(result);
          });
        });
      } else {
        db.find(search.search, fields, function(error, cursor) {
          cursor.sort(search.sort || {}).toArray(function (error, result) {
            callback(result);
          });
        });
      } 
    },

    // Associates user and an email address
    //    user: user to associate
    //    email:: the email address
    //  the email address is initially set to inactive, until the user
    //  confirm the validity of the address. The controller might need
    //  to send a probe email
    //  Returns a callback:
    //    token: the token which need to be validated
    //    undefined: when user or email is invalid
    associateEmail: function(user, email, callback) {
      if (typeof(email) === "string" && !email.match(/^\S+@\S+\.\S+$/)) {
        callback();
        return;
      }
      db.findOne({"emailList.email": email}, function(err, item) { 
        if (item == null) {
          emailList(user, function(result) {
            if (typeof(result) === "undefined") {
              callback();
            } else {
              var saveNewData = true; 
              var token = crypto.randomBytes(8).toString("hex");
              var expiryDate = new Date();
              expiryDate.setDate(expiryDate.getDate()+1);

              for (var i = 0; i < result.length; i ++) {
                if (result[i].email == email) {
                  saveNewData = false;
                  result[i].token = token;
                  result[i].validationExpiry = expiryDate;
                  break;
                }
              }
              if (saveNewData) {
                var data = {
                  email: email,
                  token: token,
                  validationExpiry: expiryDate,
                  isValidated: false
                }
                result.push(data);
              }

              db.update({username: user },
                {$set: 
                  { 
                    emailList: result,
                    modifiedDate: new Date()
                  }
                }, function(err) {
                callback(token);
              });
            }
          });

        } else {
          callback();
        }
      });

    },

    // Activate an email address according to the activation token
    //    token: the token from associateEmail function
    //    email: the email address
    //  Returns a callback:
    //    result: true if email is activated 
    activateEmailAssociation: function(token, email, callback) {
      db.findOne({"emailList.email": email,
                   "emailList.token": token}, function(e, item) {
        if (item == null) {
          callback(false);
          return;
        }
        var list = item.emailList;
        for (var i = 0; i < list.length; i ++) {
          if (list[i].email == email && list[i].token == token) {
            var data = {
              email: email,
              isValidated: true,
              validationDate: new Date()
            }
            list[i] = data;
            break;
          }
        }
        db.update({_id: item._id},
          {$set: 
              { 
                emailList: list,
                modifiedDate: new Date(),
              }
        }, function(err) {
          callback(true);
        });
 
      });
    },

    // Disassociates an email address from a user 
    //    user: the user
    //    email: the email address array
    //  Returns via a callback:
    //    result: true if email is activated 
    disassociateEmail: function(user, email, callback) {
      db.findOne({"emailList.email": {$in: email},
                   username: user}, function(e, item) {
        if (item == null) {
          callback(false);
          return;
        }
        var newList = [];
        var count = 0;
        var list = item.emailList;
        for (var i = 0; i < list.length; i ++) {
          var found = false;
          for (var j = 0; j < email.length; j ++) {
            if (list[i].email == email[j]) {
              found = true;
              break;
            }
          }
          if (!found) {
            newList[count++] = list[i];
          }
        }
        db.update({_id: item._id},
          {$set: 
              { emailList: newList,
                modifiedDate: new Date(),
              }
        }, function(err) {
          callback(true);
        });
 
      });
    },



    // Gets a list of email addresses associated with a user
    //    username: the user
    // Returns via a callback
    //    result: hash of objects of 
    //        email: email address
    //        isValidated: true if the email is validated
    //        validationDate: date and time when the email was validated
    //        token: 16 digits of token when email is being validated
    //        tokenExpiry: date when the token would be expired
    //    undefined: if user is not valid 
    emailList: emailList,

    // Gets a user from an email address
    //    email: the email to search
    // Returns via a callback
    //    result: the username, null if not found
    getUserFromEmail: function(email, callback) {
      db.findOne({"emailList.email":email}, function(e, item) {
        if (e != null || item == null) {
          callback(null);
          return;
        }

        callback(item.username);
      });
    },

    // Gets a user from a phone number
    //    phone: the phone number to search
    // Returns via a callback
    //    result: the username, null if not found
    getUserFromPhone: function(phone, callback) {
      db.findOne({"profile.phones" : phone}, function(e, item) {
        if (e != null || item == null) {
          callback(null);
          return;
        }
        callback(item.username);
      });
    },

    // Gets a role list which is associated with a user
    //    username: the user
    // Returns via a callback
    //    result: array of roles
    roleList: roleList,

    // Adds a role to a user
    //    username: the username
    // Returns via a callback
    //    result: true if succeed
    addRole: function(user, role, callback) {
      roleList(user, function(r) {
        if (typeof(r) === "undefined") {
          callback(false); 
          return;
        }

        var addData = true;
        for (var i = 0; i < r.length; i ++) {
          if (r[i] == role) {
            addData = false;
            break;
          }
        }
        if (addData) {
          r.push(role);
          db.update({username: user },
            {$set: 
              { 
                roleList: r,
                modifiedDate: new Date(),
              }
            }, function(err) {
              var result = true;
              if (err != null) {
                result = false;
              }
              callback(result);
          });

        } else {
          callback(true);
        }
      });
    },

    // Sets a set of roles to a user
    // and replaces the whole roles
    //    username: the username
    //    roles: role array
    // Returns via a callback
    //    result: true if succeed
    setRoles: function(user, roles, callback) {
      db.update({username: user },
        {$set: 
          { 
            roleList: roles, 
            modifiedDate: new Date(),
          }
        }, function(err) {
          var result = true;
          if (err != null) {
            result = false;
          }
          callback(result);
      });
    },



    // Removes a role from a user
    //    user: the user
    // Returns via a callback
    //    result: true if success
    removeRole: function(user, role, callback) {
       roleList(user, function(r) {
        if (typeof(r) === "undefined") {
          callback(false); 
          return;
        }

        var data = [];
        for (var i = 0; i < r.length; i ++) {
          if (r[i] != role) {
            data.push(r[i]);
          }
        }
        db.update({username: user },
          {$set: 
            { 
              roleList: data,
              modifiedDate: new Date(),
            }
          }, function(err) {
            var result = true;
            if (err != null) {
              result = false;
            }
            callback(result);
        });
      });   
    },

    // Checks if a user has a set of roles
    //    user: the user
    // Returns  via a callback
    //    result: true if the user has the specified roles
    hasRoles: function(user, roles, callback) {
      roleList(user, function(r) {
        if (typeof(r) === "undefined" || r == null) {
          callback(false); 
          return;
        }

        var d = {};
        for (var i = 0; i < r.length; i ++) {
          d[r[i]] = 1;
        }

        var count = 0;
        for (var i = 0; i < roles.length; i ++) {
          if (d[roles[i]] == 1) {
            count ++;
          }
        }
 
        callback(count == roles.length);
      });
    },

    addPhone : function(username, phone, callback){

      var valid = phone.toString().trim().replace(/[^\d]/g,'')
      if(!valid || valid.length < 8) {
        return callback(new Error('invalid'))
      }

      db.findOne({ username : username}, function(err, user){
        if(err || !user) return callback(new Error('notfound'))

        user.profile.phones = user.profile.phones || []
        if(user.profile.phones.indexOf(phone) > -1){
          return callback(new Error('exists'))
        }

        db.findOne({"profile.phones" : phone}, function(err, exists){
          if(exists){
            return callback(new Error('exists'), exists.username)
          }

          user.profile.phones.push(phone);
          user.modifiedDate = new Date();
          db.save(user, function(err){
            callback(err, user)
          })

        })
      })
    },

    removePhones : function(user, phones, callback){
      db.findOne({ username : user}, function(err, user){
        if(err) return callback(err)
        if (phones && phones.length) {
          for(var i = 0; i < phones.length; i++){
            var idx = user.profile.phones.indexOf(phones[i])  
            user.profile.phones.splice(idx, 1)
          }
        }
        
        user.modifiedDate = new Date();
        db.save(user, function(err){
          return callback(err, user)
        })
      })
    },

    search: function(search, callback) {
      var options = {
        limit: 20,
        skip: 0
      }; 
      if (search.limit) options.limit = search.limit;
      if (search.page) options.skip = (search.page - 1) * options.limit;
      if (search.sort) options.sort = search.sort;

      db.find(search.search, options, function(err, cursor) {
        if (err) return callback(err);
        cursor.count(false, function(err, count){
          if (err) return callback(err);
          cursor.toArray(function(err, data) {
            if (err) return callback(err);
            var obj = {
              type: "list",
              data: data,
              total: count
            }
            callback(null, obj);
          });
        });
      });
    },

    // Finds people within an organization 
    // Input: {String[]} exclude People to exclude
    //        {String} org Organization path
    people: function(exclude, org, cb) {
      var excludeMap = {};
      _.each(exclude, function(item) { excludeMap[item] = 1});
      var findPeople = function(orgs, cb) {
        var query = {};
        query["profile.organization"] = {
            $in: orgs
          }
        db.findArray(query, { username: 1, profile: 1}, cb);
      }

      var findOrg = function(org, cb) {
        var query = {
          path: {
            $regex : "^" + org + "$|" + org + ";.*" 
          }
        };

        organization.findArray(query, cb);
      }

      var heads = {};
      findOrg(org, function(err, r1) {
        if (err) return cb(err);
        var orgs = [];
        _.each(r1, function(item) {
          orgs.push(item.path);
          if (item.head) {
            heads[item.head] = item.path;
          }
        });
        findPeople(orgs, function(err, r2) {
          if (err) return cb(err);
          var result = [];
          var map = {};
          _.each(r2, function(item) {
            if (!excludeMap[item.username]) {
              var orgName = item.profile.organization;
              var orgMap = map[orgName];
              var sortOrder = item.profile.echelon;
              if (heads[item.username]) {
                sortOrder = -1;
              }
              if (!orgMap) {
                orgMap = { 
                  label: orgName,
                  children: []
                };
                map[orgName] = orgMap;
              }
              var data = {
                label: item.username,
                sortOrder: sortOrder
              }
              data = _.merge(data, item);
              orgMap.children.push(data);
            }
          });

          _.each(orgs, function(item) {
            if (map[item] && !map[item].processed) {
              var chop = item.lastIndexOf(";");
              if (chop > 0) {
                var orgChopped = item.substr(0, chop);
                var parent = map[orgChopped];

                map[item].children = _.sortBy(map[item].children, "sortOrder");
                if (parent) {
                  parent.children = parent.children || [];
                  parent.children.push(map[item]);
                  map[item].processed = 1;
                }
              }
            }
          });
          Object.keys(map).forEach(function(item) {
            if (!map[item].processed)
            result.push(map[item]);
          });

          cb(null, result);
        });
      });

      
    }


  }
}
