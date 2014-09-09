module.exports = function(app) {
	var boxC = require("../../box.js")(app);
	var utils = require("../../../../sinergis/controller/utils.js")(app);
	var notification = require("../../../models/notification.js")(app);
	var user = require("../../../../sinergis/models/user.js")(app);
	var own = require("../../../models/box")(app);
	var moment = require("moment");
	var async = require("async");
	var path = require("path");
	var url = require("url");
	var fs = require("fs");

	var contentTypes = {
	    OWNBOX_DIR : "application/directory.ownbox"
	};

	function isSharedDir (dirname, currentUser) {
	    return dirname.indexOf("/" + currentUser + "/shared") == 0;
  	}

  /**
   * @api {get} /box/users Find Users
   *
   * @apiVersion 0.1.0
   *
   * @apiName GetUsers
   * @apiGroup Box
   * @apiPermission token
   *
   * @apiDescription Get Users
   * 
   * @apiParam {String} access_token The access token
   * 
   * @apiExample Example usage:
   * curl "http://simaya.cloudapp.net/api/2/box/users?access_token=f3fyGRRoKZ...
   */

	var readDir = function (req, res) {
	    // console.log(req.path);
	    var currentPath = req.session.currentUser;
	    // console.log(currentPath);
	    currentPath = "/" + currentPath;

	    var shared = isSharedDir(currentPath, req.session.currentUser);

	    // if(req.accepted && req.accepted.length > 0 && req.accepted[0].value != "application/json") {
	    //   // console.log("test req.accepted");
	    //   return renderIndex(req, res, { isPersonal : !shared, currentPath : currentPath });
	    // }

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
	        res.send(200, { items : items, currentPath : currentPath });
	      });
	    } else {
		    box.directory(currentPath).items(function(err, result){
		        if (err) {
		          return res.send(404, {});
		        } else {
		          var items = packedItems(result);
		          // console.log(items);
		          res.send(200, { items : items, currentPath : currentPath });
		        }
		    });  
	    }
	}

  /**
   * @api {get} /box/file/* Read Files
   *
   * @apiVersion 0.1.0
   *
   * @apiName Get File Names
   * @apiGroup Box
   * @apiPermission token
   *
   * @apiDescription Get name files
   * 
   * @apiParam {String} access_token The access token
   *
   */

	var readFile = function (req, res) {
	    var u = url.parse(req.url);
	    var item = u.pathname.substr("/api/2/box/file".length, u.pathname.length);
	    item = decodeURI(item);
	    var box = own.box(req.session);
	    var filename = path.basename(item);
	    console.log(u, item, box, filename);
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

  /**
   * @api {post} /box/file Write File
   *
   * @apiVersion 0.1.0
   *
   * @apiName PostWriteFile
   * @apiGroup Box
   * @apiPermission token
   *
   * @apiDescription Post File to Database
   * 
   * @apiParam {String} access_token The access token
   *
   * 
   * @apiExample Example usage:
   * curl "http://simaya.cloudapp.net/api/2/box/file?access_token=f3fyGRRoKZ..." -F "files=@C:/lokasi/file/yang/dituju" -F "dirname=berkas"
   */

  	var writeFile = function (req, res) {
	    var uploaded = req.files.files;
	    var dirname = req.body.dirname;
	    var box = own.box(req.session);

	    // console.log("uploaded", dirname);

	    var source = fs.createReadStream(uploaded.path);

	    process.nextTick(function(){

	      box.directory(dirname).stream(uploaded.originalFilename, {_stream : source}).write(function(err, result){
	        fs.unlink(uploaded.path, function(){
	          res.send({ item : result});
	        });
	      });

	    });
  	}

  /**
   * @api {get} /box/users/org Get user organization
   *
   * @apiVersion 0.1.0
   *
   * @apiName GetUsersOrg
   * @apiGroup Box
   * @apiPermission token
   *
   * @apiDescription Get User Organization
   * 
   * @apiParam {String} access_token The access token
   *
   */

  /**
   * @api {get} /box/dir Get Directory Name
   * @api {get} /box/dir/* Get Directory Name
   *
   * @apiVersion 0.1.0
   *
   * @apiName Get Directory Name
   * @apiGroup Box
   * @apiPermission token
   *
   * @apiDescription Get Directory Name
   * 
   * @apiParam {String} access_token The access token
   *
   * @apiExample URL Structure:
   * // DEVELOPMENT
   * http://simaya.cloudapp.net/api/2/box/dir
   * http://simaya.cloudapp.net/api/2/box/dir/*
   * 
   */

	return {
		readDir : readDir,
		readFile : readFile,
		writeFile : writeFile
	}
}