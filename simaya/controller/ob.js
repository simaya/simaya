
module.exports = function(app) {
  var ob = require("../../ob/file.js")(app);
  var simpleUpload = function(req, res) {
    var func = req.query.CKEditorFuncNum;
    ob.simplePublicUpload(req.files.upload, "/upload", function(e, r) {
      var image = "/ob/get/" + r._id;
      res.send("<script>window.parent.CKEDITOR.tools.callFunction(" + func + ", '" + image + "')</script>");
    });
  }
  
  var simpleDownload = function(req, res) {
    ob.download(req.params.id, 0, res, function() {
      res.end();
    });
  }

  return {
    simpleUpload: simpleUpload
  , simpleDownload: simpleDownload
  }
}
