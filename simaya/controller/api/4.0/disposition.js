module.exports = function(app){

  var moment = require("moment");

  var dispositionWeb = require("../../disposition.js")(app)
  var disposition = require("../../../models/disposition.js")(app)
  var letterUtils = require("../../../models/utils.js")(app)

  function isValidObjectID(str) {
    str = str + '';
    var len = str.length, valid = false;
    if (len == 12 || len == 24) {
      valid = /^[0-9a-fA-F]+$/.test(str);
    }
    return valid;
  }

  /**
   * @api {get} /dispositions/outgoings Outgoing Dispositions
   * @apiVersion 4.0
   * @apiName GetOutgoingDispositions
   * @apiGroup Dispositions
   * @apiPermission token
   *
   * @apiDescription Get outgoing dispositions
   * 
   * @apiParam {String} access_token The access token
   * @apiParam {String} page The <code>page-th</code> of result group
   * @apiParam {String} limit The maximum number of letters per page
   *
   * @apiExample URL Structure:
   * // DEVELOPMENT
   * http://ayam.vps1.kodekreatif.co.id/api/2/dispositions/outgoings
   * 
   * @apiExample Example usage:
   * curl http://ayam.vps1.kodekreatif.co.id/api/2/dispositions/outgoings?access_token=f3fyGRRoKZ...
   */
  var outgoings = function(req, res) {
    var me = req.session.currentUser;
    var search = {
      search: {
        sender: me, 
      },
      limit: 20,
      page: (req.query["page"] || 1) 
    }
    listBase(search, req, res);
  }

  /**
   * @api {get} /dispositions/incomings Incoming Dispositions
   * @apiVersion 4.0
   * @apiName GetIncomingDispositions
   * @apiGroup Dispositions
   * @apiPermission token
   *
   * @apiDescription Get incoming dispositions
   * 
   * @apiParam {String} access_token The access token
   * @apiParam {String} page The <code>page-th</code> of result group
   * @apiParam {String} limit The maximum number of letters per page
   *
   * @apiExample URL Structure:
   * // DEVELOPMENT
   * http://ayam.vps1.kodekreatif.co.id/api/2/dispositions/incomings
   * 
   * @apiExample Example usage:
   * curl http://ayam.vps1.kodekreatif.co.id/api/2/dispositions/incomings?access_token=f3fyGRRoKZ...
   */
  var incomings = function(req, res) {
    var me = req.session.currentUser;
    var search = {
      search: {
        "recipients.recipient": me, 
      },
      limit: 20,
      page: (req.query["page"] || 1) 
    }
    listBase(search, req, res);
  }

  var listBase = function(search, req, res) {
    var me = req.session.currentUser;
    if (req.query.search && req.query.search.string) {
      search.search["$or"] = dispositionWeb.populateSearch(req.query.search.string);
    }
    disposition.list(search, function(r) {
      var recipientHash = {};
      r.forEach(function(e, i) {
        var d = moment(e.letterDate);
        if (d) {
          r[i].formattedDate = d.format('DD/MM/YYYY');
        }
        recipientHash[r[i].sender] = 1;
        if (r[i].letterDate) {
          r[i].letterDate = moment(r[i].letterDate).format("DD/MM/YYYY");
        }
        for (var j = 0; j < r[i].recipients.length; j++) {
          recipientHash[r[i].recipients[j].recipient] = 1;
          r[i].recipients[j]['priority' + r[i].recipients[j].priority] = true;
          r[i].recipients[j]['security' + r[i].recipients[j].security] = true;

          // For incoming
          if (r[i].recipients[j].recipient == me) {
            r[i].completionDate = moment(r[i].recipients[j].date).format("DD/MM/YYYY");
            r[i].priority = r[i].recipients[j].priority;
            r[i].security = r[i].recipients[j].security;
            if (r[i].recipients[j].readDate) {
              r[i].readDate = true;
            }
            if (r[i].recipients[j].followedUpDate) {
              r[i].followedUpDate = true;
            }
            if (r[i].recipients[j].declinedDate) {
              r[i].declinedDate = true;
            }
          }
        }
      });

      letterUtils.resolveUsers(Object.keys(recipientHash), function(resolved) {
        var resolvedHash = {};
        resolved.forEach(function(e, i) {
          var key = resolved[i].username;
          resolvedHash[key] = resolved[i];
        });

        r.forEach(function(e, i) {
          for (var j = 0; j < r[i].recipients.length; j++) {
            var resolvedRecipient = resolvedHash[r[i].recipients[j].recipient]; 
            r[i].recipients[j].recipientResolved = resolvedRecipient.name;
          }
        });

        var obj = {
          meta : { code : 200 },
        }

        var data = r;

        var paginations = {
          current : { 
            count : data.length,
            limit : search.limit,  
            page : parseInt(search.page),
          }
        }

        if (search.page != 1) {
          paginations.previous = { page : search.page - 1};
        }

        obj.data = data;
        obj.paginations = paginations;

        if (data.length > 0) {
          if (data.length == search.limit) {
            search.page++;

            disposition.list(search, function(nextResult) {

              if (nextResult && nextResult.length > 0) {
                paginations.next = {
                  count : nextResult.length,
                  page : search.page
                }
              }

              obj.data = data;
              obj.paginations = paginations;
              return res.send(obj);
            });

          } else {
            return res.send(obj);
          }
        }
        else {
          res.send(obj);  
        }

      });
    });
  }

  /**
   * @api {get} /dispositions/:id Read a disposition
   * @apiVersion 4.0
   * @apiName GetReadADisposition
   * @apiGroup Dispositions
   * @apiPermission token
   *
   * @apiDescription Read a disposition
   * 
   * @apiParam {String} access_token The access token
   * @apiParam {String} id The disposition id
   *
   * @apiExample URL Structure:
   * // DEVELOPMENT
   * http://ayam.vps1.kodekreatif.co.id/api/2/dispositions/:id
   * 
   * @apiExample Example usage:
   * curl http://ayam.vps1.kodekreatif.co.id/api/2/dispositions/52ff37bc2b744cf14eacd2ab?access_token=f3fyGRRoKZ...
   *
   * @apiError DispositionNotFound 
   */
  var read = function (req, res) {

    var id = req.params.id;

    if(!isValidObjectID(id)) {

      var obj = {
        meta : { code : 400, errorMessage : "Invalid Parameters"}
      }

      return res.send(obj.meta.code, obj);
    }

    disposition.list({ search: {_id: app.ObjectID(id) } }, function(result) {

      var obj = {
        meta : { code : 200 } 
      }

      if (!result || result.length == 0) {
        
        obj.meta.code = 404;
        obj.meta.errorMessage = "Disposition Not Found";

        return res.send(obj.meta.code, obj);
      }

      obj.data = result[0];

      res.send(obj);

    });
  }

  return {
    incomings : incomings,
    outgoings : outgoings,
    read : read
  }
}
