module.exports = function(app){
  var utils = require("../../utils.js")(app)
  , admin = require("../../admin.js")(app)

  /**
   * @api {get} /user/resolve Resolves user name to more depth organizational information
   * @apiName ResolveName
   * @apiGroup User
   *
   * @apiParam {String} id A single string contains a username or many usernames joined with commas.
   * @apiSuccess {Object[]} result The mapping of the usernames and their organizational information
   * @apiSuccess {String} result.name Full name
   * @apiSuccess {String} result.title Title
   * @apiSuccess {String} result.organization Organization
   * @apiSuccess {String} result.class Class
   */
  var resolveNames = function(req, res) {
    utils.getNames(req, res);
  }

  /**
   * @api {get} /user/list List users by specified substring. It always returns at most of 20 users. 
   * @apiName ListUsers
   * @apiGroup User
   *
   * @apiParam {String} id A substring of usernames or full names 
   * @apiSuccess {Object[]} result list of users object 
   * @apiSuccess {String} result.username username 
   * @apiSuccess {String} result.fullName fullName 
   */

  var list = function(req, res) {
    admin.userListJSON(req, res);
  }

  return {
    resolveNames: resolveNames,
    list: list
  }
}
