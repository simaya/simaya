module.exports = function(app) {
  var template = require('../models/template.js')(app)
    , utils = require('../../sinergis/controller/utils.js')(app)
    , session = require('../../sinergis/models/session.js')(app)
    , organization = require('../models/organization.js')(app)
    , sinergisVar = app.get('sinergisVar')
    , ObjectID = app.ObjectID;;
  
  var index = function(req, res) {
    var vals = {
      title: sinergisVar.appName,
    }
   
    utils.render(req, res, 'index', vals, 'base-authenticated');
  }
  
  var create = function(req, res) {
    var vals = {
      title: 'Buat template',  
    }

    var breadcrumb = [
      {text: 'Template', link: '/templates'},
      {text: 'Buat', isActive: true}
    ];
    vals.breadcrumb = breadcrumb;
    
    if (typeof(req.body.template) !== "undefined") {
      var letterhead;
      if (req.files.template.letterhead != null && typeof (req.files.template.letterhead) !== "undefined" && req.files.template.letterhead.name != '') {
        var fileObj = {
              path: req.files.template.letterhead.path,
              name: req.files.template.letterhead.name,
              type: req.files.template.letterhead.type
            }
        letterhead = fileObj;
      }
      
      session.getUser(req.session.authId, function(username) {
        var sharedTo = "none";
        if (req.body.template.sharedTo == "organization") {
          sharedTo = req.session.currentUserProfile.organization;
        }
        var data = {
          name: req.body.template.name,
          body: req.body.template.body,
          creator: username,
          sharedTo: sharedTo, 
          letterhead: letterhead
        }
        
        template.create(data, function(e, v) {
          if (v.hasErrors() == false) {
            vals.successful = true;
            utils.render(req, res, 'template-create', vals, 'base-authenticated');
          } else {
            vals.unsuccessful = true;
            
            if (v.errors.Data !== "undefined") {
              vals.error = v.errors.Data;  
            }
            
            utils.render(req, res, 'template-create', vals, 'base-authenticated');
          }
        });
      });
    } else {
      utils.render(req, res, 'template-create', vals, 'base-authenticated');
    }
  }
  
  var edit = function(req, res) {
    var vals = {};

    var breadcrumb = [
      {text: 'Template', link: '/templates'},
      {text: 'Ubah', isActive: true}
    ];
    vals.breadcrumb = breadcrumb;
    
    if (req.params.id != null && req.params.id.length == 24) {
      if (typeof(req.body.template) !== "undefined") {
        var letterhead;
        if (req.files.template.letterhead != null && typeof (req.files.template.letterhead) !== "undefined" && req.files.template.letterhead.name != '') {
          var fileObj = {
                path: req.files.template.letterhead.path,
                name: req.files.template.letterhead.name,
                type: req.files.template.letterhead.type
              }
          letterhead = fileObj;
        }
        
        session.getUser(req.session.authId, function(username) {
          var sharedTo = "none";
          if (req.body.template.sharedTo == "organization") {
            sharedTo = req.session.currentUserProfile.organization;
          }
          var data = {
            name: req.body.template.name,
            body: req.body.template.body,
            creator: username,
            sharedTo: sharedTo,
            letterhead: letterhead
          }
          
          template.edit(req.params.id, data, function(v) {
            var search = {
              search: {
                '_id': ObjectID(req.params.id)
              }
            }
            
            template.list(search, function(result) {
              vals.template = result[0];
              if (v.hasErrors() == false) {
                vals.successful = true;
                utils.render(req, res, 'template-edit', vals, 'base-authenticated');
              } else {
                vals.unsuccessful = true;
                
                if (v.errors.Data !== "undefined") {
                  vals.error = v.errors.Data;  
                }
                
                utils.render(req, res, 'template-edit', vals, 'base-authenticated');
              }
            });
          });
        });
      } else {
        viewBase("template-edit", req, res);
       }
    } else {
      res.redirect('/templates');
    }
  }
  
  var view = function(req, res) {
    viewBase("template-view", req,res);
  }

  var viewBase = function(templateName, req, res) {
    var vals = {};
    
    var breadcrumb = [
      {text: 'Templates', link: '/templates'},
      {text: 'Lihat', isActive: true}
    ];
    vals.breadcrumb = breadcrumb;

    if (req.params.id != null && req.params.id.length == 24) {
      var search = {
        search: {
          '_id': ObjectID(req.params.id)
        }
      }

      template.list(search, function(result) {
      if (result.length == 1) {
        vals.template = result[0];
        if (result[0].sharedTo == 'none') {
          vals.noneSelected = "selected";
        } else {
          vals.organizationSelected = "selected";
        }
        if (result[0].letterhead && result[0].letterhead.path != null) {
          vals.hasLogo = true;
        }

        if(req.accepted[0]) {
          if(req.accepted[0].subtype == 'json') {
            res.send(vals)
          } else {
            return utils.render(req, res, templateName, vals, 'base-authenticated');
          }
        }

        utils.render(req, res, templateName, vals, 'base-authenticated');
      }
      });
    } else {
      res.redirect('/templates');
    }
  }


  var remove = function(req, res) {
    var vals = {};
    
    if (req.params.id != null && req.params.id.length == 24) {
      template.remove(req.params.id, function(error) {
        if (error == null) {
          vals.message = "Deleting template successfully.";
          res.redirect('/templates');
        }
      });
    }
  }
  
  var list = function(req, res) {
    var vals = {};
    me = req.session.currentUser;

    var breadcrumb = [
      {text: 'Templates', isActive: true}
    ];
    vals.breadcrumb = breadcrumb;
    var organization = req.session.currentUserProfile.organization;
    
    session.getUser(req.session.authId, function(username) {
      var search = {
        search: {
          $or: [
            {'sharedTo': 'system'}, 
            {'creator': username},
            {'sharedTo': organization}
          ]
        }
      }

      // e.g. /templates?search=uji
      if (req.query.search) {
        var term = req.query.search

        // regex! like `term` ignore case
        var likeName = { name : { $regex : ".*" + term + ".*", $options : "-i"} };
        var likeCreator = { creator : { $regex : ".*" + term + ".*", $options : "-i"} };
        var likeSharedTo = { sharedTo : { $regex : ".*" + term + ".*", $options : "-i"} };

        // copies the previous filter
        var filter = search.search

        // builds the term filter
        var termFilter = {}
        termFilter['$or'] = []

        // searches template like `name`
        termFilter['$or'].push(likeName)

        // searches template like `creator`
        termFilter['$or'].push(likeCreator)

        // searches template like `sharedTo`
        termFilter['$or'].push(likeSharedTo)

        // combines the filter
        search.search = {}
        search.search['$and'] = []
        search.search['$and'].push(filter)
        search.search['$and'].push(termFilter)
      }
      
      template.list(search, function(result) {
        search.page = parseInt(req.query.page) || 1;
        search.limit = 10;
          
        // Count result for pagination
        var numberOfItems = result.length;
        var numberOfPages = Math.ceil(numberOfItems/search.limit);
        
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
        
        template.list(search, function(r) {
          vals.template = r;
          for (var i = 0; i < r.length; i ++) {
            if (r[i].sharedTo == "none") {
              r[i].sharedToNone = true;
            }
            if (r[i].creator == me) {
              r[i].owner = true;
            }
          }
          utils.render(req, res, 'template-list', vals, 'base-authenticated');
        });
      });
    });
  }
  
  var listModal = function(req, res) {
    var vals = {};
    
    var username = req.session.currentUser;;
    var organization = req.session.currentUserProfile.organization;
    var search = {
      search: {
        $or: [
        {'sharedTo': 'system'}, 
        {'creator': username},
        {'sharedTo': organization}]
      }
    }

    // e.g. /template/_modal?search=uji
    if (req.query.search) {
      var term = req.query.search

      if (term.length > 0) {

        // regex! like `term` ignore case
        var likeName = { name : { $regex : ".*" + term + ".*", $options : "-i"} };
        var likeCreator = { creator : { $regex : ".*" + term + ".*", $options : "-i"} };
        var likeSharedTo = { sharedTo : { $regex : ".*" + term + ".*", $options : "-i"} };

        // copies the previous filter
        var filter = search.search

        // builds the term filter
        var termFilter = {}
        termFilter['$or'] = []

        // searches template like `name`
        termFilter['$or'].push(likeName)

        // searches template like `creator`
        termFilter['$or'].push(likeCreator)

        // searches template like `sharedTo`
        termFilter['$or'].push(likeSharedTo)

        // combines the filter
        search.search = {}
        search.search['$and'] = []
        search.search['$and'].push(filter)
        search.search['$and'].push(termFilter)

      }
    }

    template.list(search, function(result) {

      vals.template = result;

      if(req.accepted[0]) {
        if(req.accepted[0].subtype == 'json') {

          var templates = vals.template
          var metaTemplates = []

          for(var i = 0; i < templates.length; i++) {
            var t = templates[i]
            var temp = {
              name : t.name || '',
              creator : t.creator || '',
              sharedTo : t.sharedTo || '',
              _id : t._id
            }
            metaTemplates.push(temp)
          }
          return res.send({ templates : metaTemplates })

        } else {
          return utils.render(req, res, 'template-list-modal', vals, 'base-empty-body');
        }
      }

      utils.render(req, res, 'template-list-modal', vals, 'base-empty-body');
    });
  }
  
  var viewLogo = function(req, res) {
    var vals = {};
    
    if (req.params.id) {
      template.viewLogo(req.params.id, res);
    }
  }
  
  return {
    create: create
    , edit: edit
    , view: view 
    , remove: remove
    , list: list
    , listModal: listModal
    , viewLogo: viewLogo
    , index: index
  }
}
