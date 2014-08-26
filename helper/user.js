var async = require ("async");
var chance = require("chance").Chance(9);
var noop = function(){};

/**
 * Expose node functions
 */
module.exports = register;

function User(app){

  if (!(this instanceof User)) return new User(app);
  if (!app) throw new TypeError('settings required');

  this.app = app;
  this.db = app.db;

  this.users = require(__dirname + "/../sinergis/models/user")(app);
  this.roles = require(__dirname + "/../sinergis/models/role")(app);
  this.orgs = require (__dirname + "/../simaya/models/organization")(app);
}

User.prototype.clear = function(fn){
  fn = fn || noop;
  var self = this;
  self.db("role").remove({}, {j:false}, function(err){
    if (err) return fn (err);
    self.db("organization").remove({}, {j:false}, function(err){
      if (err) return fn (err);
      self.db("user").remove({}, {j:false}, function(err){
        fn(err);
      });
    });
  });
};

User.prototype.createUser = function (options, fn){
  var ctx = options.context || this;
  var user = {};
  for (var key in options){
    if (key != "context" && key != "role"){
      user[key] = options[key];
    }
  }
  ctx.users.create(user, function(v) {
    if (v.hasErrors()){
      return fn(new Error("failed to create user"));
    }
    ctx.users.addRole(options.username, options.role, function(added) {
      if (!added) return new Error("failed to add role");
      ctx.users.setActive(options.username, function(activated) {
        if (!activated) return new Error("failed to activate user");
        return fn(null, user);
      });
    });
  });
}

User.prototype.createOrganization = function(options, fn){
  var ctx = options.context || this;
  ctx.orgs.create(options.parent, { name : options.name }, function(v){
    if (v.hasErrors()){
      return fn (new Error("failed to create organization"));
    } 
    var org = {parent : options.parent, name : options.name};
    org.path = !org.parent ? org.name : [org.parent, org.name].join(";");
    fn(null, org);
  });
}

User.prototype.createOrganizations = function (fn){
  fn = fn || noop;
  var self = this;
  var root = {
    name : "siMAYA"
  }
  var orgs = [];
  // todo: take out this param to generate options
  for (var i = 0; i < 20; i++){
    orgs.push({
      parent : root.name,
      name : chance.word({length : 5}) + " " + chance.word({length : 8}),
      context : self
    });
  }

  self.createOrganization(root, function(err, savedRoot){
    if (err) return fn(err);    
    async.map(orgs, self.createOrganization, fn);
  });
}

User.prototype.generate = function(options, fn){
  fn = fn || noop;
  var self = this;
  self.clear(function(err){
    if (err) return fn(err);
    self.generateUsers(options, fn);
  })
}

User.prototype.generateUsers = function(options, fn){

  if (typeof options == "function"){
    fn = options;
    options = {};
  }

  var self = this;
  var localAdmin = {
    roleName : "localadmin" || options.roleName,
    roleDescription : "Local administrator" || options.roleDescription
  };

  self.roles.create(localAdmin.roleName, localAdmin.roleDescription, function(v){
    
    if (v.hasErrors()) {
      return fn(new Error("failed to create role"));
    }

    self.createOrganizations(function(err, organizations){

      var users = [];

      for (var i = 0; i < organizations.length; i++){

        var user = {
          context : self,
          username : chance.word({syllables: 3}), 
          password : "password12345" || options.password, 
          password2 : "password12345" || options.password, 
          role : "localadmin" || options.roleName,
          profile : {
            fullName : chance.word({syllables : 2}) + " " + chance.word({syllables : 5}),
            organization : organizations[i].path
          }
        }
        users.push(user);
      }
      async.map(users, self.createUser, function(err, created){
        if (err) return fn(err);
        self.generated = created;
        fn(null, created);
      });
    });
  });
}

function register (app){
  return User(app);
}