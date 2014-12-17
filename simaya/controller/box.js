// box controller
module.exports = function(app) {

  /*
   * Dependencies
   *
   */
  var utils = require("../../sinergis/controller/utils.js")(app);
  var notification = require("../models/notification.js")(app);
  var user = require("../../sinergis/models/user.js")(app);
  var own = require("../models/box")(app);
  var moment = require("moment");
  var async = require("async");
  var path = require("path");
  var url = require("url");
  var fs = require("fs");

  // define content types for comparison
  var contentTypes = {
    OWNBOX_DIR : "application/directory.ownbox"
  };

  /*
   * Render the "host", to load the app which loads data using ajax
   *
   */
  function renderIndex(req, res, options) {

    // override the options
    options = options || {}

    // js additions
    var jsAdditions = [
      { src : "/upload/js/vendor/jquery.ui.widget.js"},
      { src : "/upload/js/vendor/tmpl.min.js"},
      { src : "/upload/js/jquery.fileupload.js"},
      { src : "/upload/js/jquery.fileupload-ui.js"},
      { src : "/upload/js/jquery.fileupload-process.js"},
      { src : "/lib/jquery.resize.min.js"},
      { src : "/select2/select2.min.js"},
      { src : "/select2/select2_locale_id.js"},
      { src : "/lib/ee.min.js"},
      { src : "/js/box.js"},
    ];

    // css additions
    var cssAdditions = [
      { src : "/upload/css/jquery.fileupload.css"},
      { src : "/upload/css/jquery.fileupload-ui.css"},
      { src : "/select2/select2-bootstrap.css"},
      { src : "/select2/select2.css"},
      { src : "/css/box.css"}
    ]
    
    var usernameByPath = req.path.substr("/box/dir/".length, req.path.length).split("/")[0];
    if (usernameByPath != req.session.currentUser) {
      utils.render(req, res, "box-denied", options, "base-authenticated"); 
    } else {
      options.title = options.title || "Berkas";
      options.cssAdditions = cssAdditions;
      options.jsAdditions = jsAdditions;
      options.username = req.session.currentUser;
      utils.render(req, res, "box", options, "base-authenticated"); 
    }

  }

  function isSharedDir (dirname, currentUser) {
    return dirname.indexOf("/" + currentUser + "/shared") == 0;
  }

  var readDir = function (req, res) {

    var currentPath = req.path.substr("/box/dir/".length, req.path.length) || req.session.currentUser;
    currentPath = "/" + currentPath;

    var shared = isSharedDir(currentPath, req.session.currentUser);

    if(req.accepted && req.accepted.length > 0 && req.accepted[0].value != "application/json") {
      return renderIndex(req, res, { isPersonal : !shared, currentPath : currentPath });
    }

    var box = own.box(req.session);

    function packedItems(result){
      var items = []

      for (var item in result) {
        
        result[item].name = item;

        var revisions = result[item].revisions;

        if (revisions && revisions.length > 0) {
          
          var revision = revisions[ revisions.length - 1];
          var metadata = revision.metadata || {};

          result[item].type = revision.contentType;
          result[item].isDir = revision.contentType == contentTypes.OWNBOX_DIR;
          result[item].name = revision.metadata.basename;
          result[item].dirname = revision.metadata.dirname;
          result[item].date = moment(revision.uploadDate).fromNow();
          result[item].revisions = revisions.length;
          result[item].owner = revision.metadata.owner;
          result[item].sharedTo = revision.metadata.sharedTo || [];
          // result[item].latest = revision;
        }

        items.unshift(result[item]);
      } 

      return items;
    }

    if (shared) {
      
      box.shared(function(err, result){
        var items = packedItems(result);

        res.send({ items : items, currentPath : currentPath });

      });

    } else {

      box.directory(currentPath).items(function(err, result){
        if (err) {
          return res.send(404, {});
        } else {
          var items = packedItems(result);
          res.send({ items : items, currentPath : currentPath });
        }
      });
    }
  }

  var createDir = function (req, res) {
    
    var dirname = req.body.path;

    if (isSharedDir(dirname, req.session.currentUser)) {
      return res.send(404, {error : { message : "shared is reserved"}});
    }

    var box = own.box(req.session);

    box.directory(dirname).create(function(err, result){
      if (err) {
        return res.send(404, {});
      } 
      res.send({ path : dirname, created : true });
    });
  }

  var shareDir = function (req, res) {
    
    var body = req.body;
    var box = own.box(req.session);
    var users = body.users.split(",");

    function getUserProfile(usr, cb){
      // list user
      user.list({ search : { "username" : usr } }, function(result){
        if (result && result.length > 0) {
          cb(null, {
            user : result[0].username,
            profile : result[0].profile
          });
        } else {
          return cb(null, { user : usr, profile : {} });
        }
      });
    }

    // 
    async.map(users, getUserProfile, function(err, result) {

      // 
      if (err) return res.send(404, { error : err} );

      // get all items inside dirs
      box.directory(body.currentPath + "/" + body.item).share({to : result}, function(err, updated){
        if (err) return res.send(404, { error : err });
        res.send(updated);
      })
    });
  }
  
  // Write the file into the box
  var writeFile = function (req, res) {
    var uploaded = req.files.files[0];
    var dirname = req.body.dirname;
    var box = own.box(req.session);

    var source = fs.createReadStream(uploaded.path);

    process.nextTick(function(){

      box.directory(dirname).stream(uploaded.originalFilename, {_stream : source}).write(function(err, result){
        fs.unlink(uploaded.path, function(){
          res.send({ item : result});
        });
      });

    });
  }

  // Stream to read a file using content disposition
  var readFile = function (req, res) {
    var u = url.parse(req.url);
    var item = u.pathname.substr("/box/file".length, u.pathname.length);
    item = decodeURI(item);
    var box = own.box(req.session);
    var filename = path.basename(item);
    res.setHeader("Content-Disposition", 'attachment;filename="' + filename + '"');

    var dirname = path.dirname(item);
    var parts = dirname.split("/");
    if (parts.length > 1) {
      var ownerUser = parts[1];

      // if the owner of the file is different
      if (ownerUser != box.owner.user) {
        // the profile is not important for reading
        box = own.box({ currentUser : ownerUser, currentUserProfile : {}});
      }
    } 

    // download from the right path
    box.directory(path.dirname(item)).file(filename).read({ to : res }, function(err){
      if (err) {
        res.redirect("/box/dir/" + path.dirname(item));
      }
    });
  }

  var revisions = function (req, res) {
    var u = url.parse(req.url);
    var item = u.pathname.substr("/box/file".length, u.pathname.length);
    var box = own.box(req.session);

    box.directory(path.dirname(item)).file(filename).revisions(function(err, result){
      if (err) {
        res.redirect("/box/dir/" + path.dirname(item));
      } else {
        res.send({ revisions : result});
      }
    });
  }

  var shareFile = function (req, res) {

    var body = req.body;
    var box = own.box(req.session);
    var names = body.users.split(",");

    function getUserProfile(usr, cb){
      // list user
      user.list({ search : { "username" : usr } }, function(result){
        if (result && result.length > 0) {
          cb(null, {
            user : result[0].username,
            profile : result[0].profile
          });
        } else {
          return cb(null, { user : usr, profile : {} });
        }
      });
    }

    // get user objects [{ user : user, profile : profile}]
    async.map(names, getUserProfile, function(err, users){

      if (err) return res.send(404, {error : err});

      box.directory(body.currentPath).file(body.item).share({ to : users }, function(err, updated){
          
          if (err) {
            res.send(404, { error : err });
          }

          if (updated && updated.length > 0) {
            var sender = req.session.currentUserProfile ? (req.session.currentUserProfile.fullName || req.session.currentUser) : req.session.currentUser;
            var message =  "Telah membagikan " + body.item;
            message += body.message ? (" Pesan: " + body.message) : "";
            
            for (var i = 0; i < users.length; i++) {
              notification.set(sender, users[i].user, message, "/box/dir/" + users[i].user + "/shared");
            }
          }

          res.send(updated);

        });  
    });
  }
  
  // proxy to users
  var findUser = function (req, res) {
    var phrase = req.query.q;
    var expr = new RegExp(phrase);
    var query = phrase ? { $or : [ { "profile.fullName" : expr}, { "username" : expr } ] } : {};
    user.list({ search : query}, function(users){
      var ret = [];
      for (var i = 0; i < users.length; i++) {
        if (users[i].username == req.session.currentUser) continue;
        var u = {
          id : users[i].username,
          name : users[i].profile.fullName,
          org : users[i].profile.organization
        }
        ret.push(u)
      }
      res.send(ret);
    });
  }

  var findUserOrg = function (req, res) {
    var organization = req.session.currentUserProfile.organization;
    if (!organization) {
      return res.send([]);
    } else {
      user.list({ search : {"profile.organization" : organization } }, function(users){
        var ret = [];
        for (var i = 0; i < users.length; i++) {
          var u = {
            id : users[i].username,
            name : users[i].profile.fullName,
            org : users[i].profile.organization
          }
          ret.push(u)
        }
        res.send(ret);
      });
    }
  }

  var deleteFile = function (req, res) {
    var body = req.body;
    var box = own.box(req.session);
    box.directory(body.currentPath).file(body.item).destroy(function(err) {
      if (err) return res.send(404, { error : err});
      res.send({ item : body.item, deleted : true });
    });
  }

  var deleteDir = function (req, res) {
    var body = req.body;
    var box = own.box(req.session);
    box.directory(body.currentPath + "/" + body.item).destroy(function(err){
      if (err) return res.send(404, { error : err});
      res.send({ item : body.item, deleted : true });
    });
  }

  return {

    // public APIs
    readDir : readDir,
    createDir : createDir,
    shareDir : shareDir,
    writeFile : writeFile,
    readFile : readFile,
    shareFile : shareFile,
    findUserOrg : findUserOrg,
    findUser : findUser,
    revisions : revisions,
    deleteFile : deleteFile,
    deleteDir : deleteDir
  }
}
