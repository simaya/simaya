module.exports = function(app) {
  var ObjectID = app.ObjectID
    , timeline = require("../models/timeline.js")(app)
    , user = require("../../sinergis/models/user.js")(app)
    , moment = require("moment")
    , utils = require("../../sinergis/controller/utils.js")(app)
    , contacts = require("../models/contacts.js")(app)
    , ob = require("../../ob/file.js")(app);

  var index = function(req, res)
  {
    var vals = {};
    utils.render(req, res, "timeline", vals, "base-authenticated"); 
  }

  var post = function(req, res) 
  {
    if (req.body.text) {
      var data = {
        date: new Date(),
        text: req.body.text,
        user: req.session.currentUser,
      }
      if (req.body.attachment) {
        data.attachment = req.body.attachment;
      }
      console.log("data", data);
      timeline.insert(data, function(err, id) {
        app.io.updateTimeline({
          me: req.session.currentUser,
          id: id,
        }); 
        res.send({
          ok: true,
          id: id
        });
      });
    } else {
      res.send({ok: false});
    }
  }

  var love = function(req, res) 
  {
    if (req.body.id) {
      var data = {
        date: new Date(),
        id: req.body.id,
        user: req.session.currentUser,
      }
      timeline.love(data, function(result) {
        if (result) {
          app.io.updateTimeline({
            me: req.session.currentUser,
            id: req.body.id,
          }); 

          res.send({ok: true});
        } else {
          res.send({ok: false});
        }
      });
    } else {
      res.send({ok: false});
    }
  }

  var unlove = function(req, res) 
  {
    if (req.body.id) {
      var data = {
        date: new Date(),
        id: req.body.id,
        user: req.session.currentUser,
      }
      timeline.unlove(data, function(result) {
        if (result) {
          app.io.updateTimeline({
            me: req.session.currentUser,
            id: req.body.id,
          }); 

          res.send({ok: true});
        } else {
          res.send({ok: false});
        }
      });
    } else {
      res.send({ok: false});
    }
  }

  var postComment = function(req, res) 
  {
    if (req.body.id && req.body.text) {
      var data = {
        date: new Date(),
        id: req.body.id,
        user: req.session.currentUser,
        text: req.body.text,
      }
      timeline.comment(data, function(result) {
        if (result) {
          app.io.updateTimeline({
            me: req.session.currentUser,
            id: req.body.id,
          }); 

          res.send({ok: true});
        } else {
          res.send({ok: false});
        }
      });
    } else {
      res.send({ok: false});
    }
  }


  var list = function(req, res) {
    if (req.session && req.session.currentUser) {
      var me = req.session.currentUser;

      var search = {
        search: {
          end1: me,
          established: true
        }
      }

      contacts.listByUser(me, search, function(r) {
        var friends = [];
        friends.push(me);
        if (r && r.length > 0) {
          for (var i = 0; i < r.length; i ++) {
            var user = r[i].end2;
            friends.push(user);
          }
        }

        var data = {
          search: {
            user: {$in: friends}
          },
          limit: 30,
          page: 1,
          sort: {date:1, updated_at: 1}
        }
        // Gets specific id
        if (req.query.id) {
          data.search["_id"] = ObjectID(req.query.id + "");
        }
        timeline.list(data, function(result) {
          res.send(result);
        });
      });
    } else {
      res.send([]);
    }
  }

  var uploadMedia = function(req, res) {
    ob.simplePublicUpload(req.files.upload, "/timeline/status", function(e, r) {
      var image = "/ob/get/" + r._id;
      console.log({path : image});
      res.send({path: image})
    });
  }
  
  var downloadMedia = function(req, res) {
    var id = req.params.id || req.query.id;
    ob.download(id, 0, res, function() {
      res.end();
    });
  }

  return {
    index: index, 
    post: post, 
    postComment: postComment, 
    love: love, 
    unlove: unlove, 
    list: list,
    uploadMedia: uploadMedia,
    downloadMedia: downloadMedia,
  }
};
