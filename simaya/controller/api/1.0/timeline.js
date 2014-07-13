module.exports = function(app) {
  var timelineWeb = require("../../timeline.js")(app)
    , base64Stream = require("base64-stream")

  var ResWrapper = function(next, prev, callback) {
    var send = function(data) {
      callback({
        status: 0,
        data: data,
        next: next,
        prev: prev
      });
    };

    return {
      send: send
    }
  }
  var index = function(req, res) {
  };

  /**
   * @api {post} /timeline/post Posts an entry to the timeline
   * @apiName Post
   * @apiGroup Timeline
   *
   * @apiParam {String} text Comment text
   * @apiParam {String} attachment Object id of an attachment (optional)
   *
   * @apiSuccess {Object} status Status of the posting
   * @apiSuccess {String} status.id Object id of the posting
   * @apiSuccess {String} status.ok "true"
   * @apiError {Object} status Status of the result 
   * @apiError {String} status.ok "false"
   */
  var post = function(req, res) {
    timelineWeb.post(req, res);
  };

  /**
   * @api {post} /timeline/post-comment Posts a comment
   * @apiName PostComment
   * @apiGroup Timeline
   *
   * @apiParam {String} id Posting id
   * @apiParam {String} text Comment text
   *
   * @apiSuccess {Object} status Status of the posting
   * @apiSuccess {String} status.ok "true"
   * @apiError {Object} status Status of the result 
   * @apiError {String} status.ok "false"
   */
  var postComment = function(req, res) {
    timelineWeb.postComment(req, res);
  };

  /**
   * @api {post} /timeline/love Loves a posting 
   * @apiName Love
   * @apiGroup Timeline
   *
   * @apiParam {String} id Posting id
   *
   * @apiSuccess {Object} status Status of the posting
   * @apiSuccess {String} status.ok "true"
   * @apiError {Object} status Status of the result 
   * @apiError {String} status.ok "false"
   */
  var love = function(req, res) {
    timelineWeb.love(req, res);
  };

  /**
   * @api {post} /timeline/unlove Unloves a posting 
   * @apiName Unlove
   * @apiGroup Timeline
   *
   * @apiParam {String} id Posting id
   *
   * @apiSuccess {Object} status Status of the posting
   * @apiSuccess {String} status.ok "true"
   * @apiError {Object} status Status of the result 
   * @apiError {String} status.ok "false"
   */
  var unlove = function(req, res) {
    timelineWeb.unlove(req, res);
  };

  /**
   * @api {get} /timeline/list Gets entries of the timeline
   * @apiName ListTimeline
   * @apiGroup Timeline
   *
   * @apiSuccess {Object[]} list List of the entries
   * @apiSuccess {String} list.user Username who posted the entry
   * @apiSuccess {String} list.text Posting text
   * @apiSuccess {Date} list.date Posting date
   * @apiSuccess {Object[]} list.comments Comments of the posting
   * @apiSuccess {String} list.comments.user User who commented the posting
   * @apiSuccess {Date} list.comments.date Date of the comment being sent
   * @apiSuccess {String} list.comments.text Text of the comment
   */
  var list = function(req, res) {
    var r = ResWrapper(0, 0, function(data) {
      res.send(data);
    });
    timelineWeb.list(req, r);
  };

 /**
   * @api {post} /timeline/media Posts an attachment of an entry 
   * @apiName UploadMedia
   * @apiGroup Timeline
   *
   * @apiParam {File} upload File to be uploaded
   *
   * @apiSuccess {Object} status Status of the posting
   * @apiSuccess {String} status.path Path of the media in the system
   */
  var uploadMedia = function(req, res) {
    timelineWeb.uploadMedia(req, res);
  };

 /**
   * @api {get} /timeline/media Gets an attachment of an entry 
   * @apiName DownloadMedia
   * @apiGroup Timeline
   *
   * @apiParam {String} id Media to be downloaded 
   *
   * @apiSuccess {Stream} none Stream of the file 
   */
  var downloadMedia = function(req, res) {
    var r = base64Stream.encode();
    r.contentType =  function(x) {
      res.contentType(x);
    }
    r.on("data", function(data) {
      res.write(data);
    });
    r.on("end", function() {

      res.end();
    });
    timelineWeb.downloadMedia(req, r);
  };

  return {
    post: post, 
    postComment: postComment, 
    love: love, 
    unlove: unlove, 
    list: list,
    uploadMedia: uploadMedia,
    downloadMedia: downloadMedia
  }
};
