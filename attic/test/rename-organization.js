var utils = require('./utils.js');
var Letter = utils.app.db('letter')
var Org = utils.app.db('organization')
var orgController = require('../simaya/controller/organization.js')(utils.app);
var User = utils.app.db('user')
var Deputy = utils.app.db('deputy')
var Template = utils.app.db('template')
var async = require('async')

var organizations = [
  {parent : 'Org1', name : 'Org1-child1'},
  {parent : 'Org1;Org1-child1', name : 'Org1-child2'},
  {parent : 'Org1;Org1-child1;Org1-child2', name : 'Org1-child3'},
  {parent : 'Org1;Org1-child1;Org1-child2', name : 'Org1-child3-ext'},
  {parent : 'Org1', name : 'Org1'}
]

var letters = [
  {
    title : 'letter1',
    senderOrganization : 'Org1',
    receivingOrganizations : {
      'Org1' : { status : 6}
    }
  },
  {
    title : 'letter2',
    senderOrganization : 'Org1;Org1-child1;Org1-child2',
    receivingOrganizations : {
      'Org1' : { status : 6}
    }
  },
  {
    title : 'letter3',
    senderOrganization : 'Org1;Org1-child1;Org1-child2',
    receivingOrganizations : {
      'Org1;Org1-child1;Org1-child2' : { status : 6},
      'Org1;Org1-child1;Org1-child2;Org1-child3' : { status : 6}
    }
  },
  {
    title : 'letter4',
    senderOrganization : 'Org1;Org1-child1;Org1-child2;Org1-child3',
    receivingOrganizations : {
      'Org1;Org1-child1;Org1-child2' : { status : 6},
      'Org1;Org1-child1;Org1-child2;Org1-child3' : { status : 6}
    }
  }
]

var deputies = [
  {
    assignee : "kabid.kominfo.org1", 
    assignor : "kadis.kominfo.org1",
    organization : "Org1;Org1-child1;Org1-child2"
  },
  {
    assignee : "kabid.ayampanggang.org1", 
    assignor : "kadis.ayampanggang.org1",
    organization : "Org1;Org1-child1;Org1-child2"
  },
  {
    assignee : "kabid.ayamgoreng.org1", 
    assignor : "kadis.ayamgoreng.org1",
    organization : "Org1;Org1-child1;Org1-child2;Org1-child3"
  }

]

var users = [
  {
    username : 'user1',
    password : 'password',
    profile : {
      organization : 'Org1;Org1-child1;Org1-child2'
    }
  },
  {
    username : 'user2',
    password : 'password',
    profile : {
      organization : 'Org1;Org1-child1;Org1-child2'
    }
  },
  {
    username : 'user3',
    password : 'password',
    profile : {
      organization : 'Org1;Org1-child1;Org1-child2;Org1-child3'
    }
  },
]

var templates = [
  { creator: 'user1', sharedTo: 'Org1;Org1-child1;Org1-child2'},
  { creator: 'user2', sharedTo: 'Org1;Org1-child1;Org1-child2'}
]

function createOrganization(org, cb){
  Org.save({name : org.name, path: org.parent + (org.name != org.parent ? (";" + org.name) : '') , created_at : new Date()}, function(err){
    if(err) return cb(err)
    cb(null, org.name)
  })
}

function createOrganizations(data, done){
  async.map(data, createOrganization, function(err, results){
    done(err, results)
  })
}

function renameOrganization(oldPath, newPath, done){

  var oldArr = oldPath.split(";")
  var newArr = newPath.split(";")

  var oldName  = oldArr[oldArr.length - 1]
  var newName  = newArr[newArr.length - 1]

  Org.findOne({ name : oldName}, function(err, res){

    if(err) return done(err)
    if(!res) return done(new Error('Not Found'))

    Org.findArray({$where : "this.path.indexOf('" + oldName + "') > -1"}, function(err, data){

      function repathAndSave(datum, cb){
        var path = datum.path.split(oldName).join(newName)
        var newOrg = datum
        newOrg.path = path
        newOrg.name = (newOrg.name == oldName) ? newName : newOrg.name

        Org.save(newOrg, function(err){
          cb(err, path)  
        })
      }

      async.map(data, repathAndSave, function(err, renames){
        done(err, renames)
      })
    })
  })
}

function createUser(user, cb){
  User.save(user, function(err){
    if(err) return cb(err)
    cb(null, user.username)
  })
}

function createDeputy(deputy, cb){
  Deputy.save(deputy, function(err){
    if(err) return cb(err)
    cb(null, deputy.assignor)
  })
}

function createTemplate(template, cb){
  Template.save(template, function(err){
    if (err) {
      return cb(err);
    }
    cb(null, template.sharedTo)
  })
}

function createUsers(data, done){
  async.map(data, createUser, function(err, results){
    done(err, results)
  })
}

function createDeputies(data, done){
  async.map(data, createDeputy, function(err, results){
    done(err, results)
  })
}

function createTemplates(data, done){
  async.map(data, createTemplate, function(err, results){
    done(err, results)
  })
}

function createLetter(letter, cb){
  Letter.save({
    title : letter.title,
    senderOrganization : letter.senderOrganization,
    receivingOrganizations : letter.receivingOrganizations
  }, function(err){
    if(err) return cb(err)
    cb(null, letter.title)
  })
}

function createLetters(data, done){
  async.map(data, createLetter, function(err, results){
    done(err, results)
  })
}

var from = 'Org1;Org1-child1;Org1-child2'
var to = 'Org1;Org1-child1;Org1-child2-rename'

testCases = {

  setUp: function(callback) {
    utils.db.open(function() {
      if(numberOfTestsRun == numberOfTests) {
        // Drop database in the first run 
        utils.db.dropDatabase(function(err, done) {
          callback();  
        });                
      } else {
        callback();        
      }    
    });
  },

  tearDown : function(callback){
    numberOfTestsRun = numberOfTestsRun - 1;

    utils.db.close();
    callback();
  },

  prepareOrganizations : function(test){
    createOrganizations(organizations, function(err, data){
      test.ok(data.length == organizations.length, "organizations creation failed")
      test.ok(data[1] == 'Org1-child2', "the second org should 'Org1-child2'")
      test.done()
    })
  },

  prepareUsers : function(test){
    createUsers(users, function(err, data){
      test.ok(data.length == users.length, "users creation failed")
      test.done()
    })
  },

  prepareDeputies : function(test){
    createDeputies(deputies, function(err, data){
      test.ok(data.length == deputies.length, "deputies creation failed")
      test.done()
    })
  },

  prepareLetters : function(test){
    createLetters(letters, function(err, data){
      test.ok(data.length == letters.length, "letters creation failed")
      test.done()
    })
  },

  prepareTemplates : function(test){
    createTemplates(templates, function(err, data){
      test.ok(data.length == templates.length, "templates creation failed")
      test.done()
    })
  },

  renameOrganizationThenSyncRelatedCollections : function(test){

    utils.db.dropDatabase(function(err, done) {
      async.series([
        function(callback){
          createOrganizations(organizations, callback)
        },
        function(callback){
          createLetters(letters, callback)
        },
        function(callback){
          createUsers(users, callback)
        },
        function(callback){
          createDeputies(deputies, callback)
        },
        function(callback){
          createTemplates(templates, callback)
        },
        function(callback){
          renameOrganization( from, to, callback)
        },
        function(callback){
          orgController.syncRelatedCollections(from, to, callback)
        }
        ], function(err, last){

          var t = last[last.length - 1]

          function flatten(a, r){
            if(!r){ r = []}
            for(var i=0; i<a.length; i++){
              if(a[i].constructor == Array || typeof a[i] == 'object'){
                flatten(a[i], r);
              }else{
                r.push(a[i]);
              }
            }
            return r;
          }

          test.ok(flatten(t).indexOf(false) == -1)

          async.series([

            // rename Org1-child3
            function(callback){
              Org.findOne({ name : 'Org1-child3'}, function(err, o){
                test.ok(o.path == 'Org1;Org1-child1;Org1-child2-rename;Org1-child3', 'Renaming Org1-child3 failed')
                callback(err, o)
              })

            },

            // letter2 has Org1-child2 in senderOrganization, the full-path has to be renamed to Org1;Org1-child1;Org1-child2-rename
            function(callback){
              Letter.findOne({ title : 'letter2'}, function(err, l){
                test.ok(l.senderOrganization == 'Org1;Org1-child1;Org1-child2-rename', 'Renaming org letter2 failed')
                callback(err, l)
              })

            },

            // letter3 has Org1-child2 in senderOrganization, the full-path has to be renamed to Org1;Org1-child1;Org1-child2-rename
            // letter3 has Org1-child2 in receivingOrganizations, the full-path should contains Org1-child2-rename
            function(callback){

              Letter.findOne({ title : 'letter3'}, function(err, l){
                test.ok(l.senderOrganization == 'Org1;Org1-child1;Org1-child2-rename', 'Renaming org letter3 failed')
                for(var k in l.receivingOrganizations){
                  test.ok(k.indexOf('Org1-child2-rename') > -1, 'Renaming org letter failed')
                }
                callback(err, l)
              })

            },
            function(callback){

              // user1's org is Org1;Org1-child1;Org1-child2 it has to be renamed to Org1;Org1-child1;Org1-child2
              User.findOne({ username : 'user1'}, function(err, u){
                test.ok(u.profile.organization == 'Org1;Org1-child1;Org1-child2-rename', 'Renaming org user1 failed')
                callback(err, u)
              })

            },

            // user3's org is Org1;Org1-child1;Org1-child2;Org1-child3 it has to be renamed to Org1;Org1-child1;Org1-child2-rename;Org1-child3
            function(callback){

              User.findOne({ username : 'user3'}, function(err, u){
                test.ok(u.profile.organization == "Org1;Org1-child1;Org1-child2-rename;Org1-child3", 'Renaming org user3 failed')
                callback(err, u)
              })

            },
            function(callback){

              // deputy.assignee kabid.kominfo.org1 has Org1;Org1-child1;Org1-child2, it should be renamed to Org1;Org1-child1;Org1-child2-rename
              Deputy.findOne({ assignee : 'kabid.kominfo.org1'}, function(err, u){
                test.ok(u.organization == 'Org1;Org1-child1;Org1-child2-rename', 'Renaming org deputy kabid.kominfo.org1 failed')
                callback(err, u)
              })

            },

            // deputy.assignee kabid.ayamgoreng.org1 has Org1;Org1-child1;Org1-child2;Org1-child3, it should be renamed to Org1;Org1-child1;Org1-child2-rename;Org1-child3
            function(callback){
              Deputy.findOne({ assignee : 'kabid.ayamgoreng.org1'}, function(err, u){
                test.ok(u.organization == 'Org1;Org1-child1;Org1-child2-rename;Org1-child3', 'Renaming org deputy kabid.ayamgoreng.org1 failed')
                callback(err, u)
              })
            },

            // template created by user1 previously sharedTo Org1;Org1-child1;Org1-child2, it should changed to Org1;Org1-child1;Org1-child2-rename
            function(callback){
              Template.findOne({ creator: 'user1'}, function(err, t){
                test.ok(t.sharedTo == 'Org1;Org1-child1;Org1-child2-rename', 'Renaming org template created by user1 failed')
                callback(err, t)
              })
            }

            ], function(err, results){
              test.done()
          })
      })
    })
  } 
}

var numberOfTests = Object.keys(testCases).length;
var numberOfTestsRun = numberOfTests; 
module.exports = testCases;

