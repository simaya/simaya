var fs = require("fs");
var _  = require("lodash");
var async = require("async");

/**
 * Expose node functions
 */
module.exports = register;

/**
 * AuditTrail manager
 * @param {Object} app root object of this express app 
 */
function AuditTrail(app){
  if (!(this instanceof AuditTrail)) return new AuditTrail(app);
  if (!app) throw new TypeError("settings required");
  this.app = app;
  this.db = app.db;
  this.ObjectID = app.ObjectID;

  this.auditTrail = this.db("auditTrail");
}

AuditTrail.prototype.record = function(options, fn) {
  var self = this;

  var data = {
    date: new Date,
    collection: options.collection,
    who: options.session.user,
    changes: options.changes,
    session: options.session,
    result: options.result
  }
  self.auditTrail.insert(data, fn);
}

AuditTrail.prototype.list = function(options, fn) {
  var self = this;

  var date = options.date;
  var startDate = new Date(date);
  startDate.setHours(0);
  startDate.setMinutes(0);
  startDate.setSeconds(0);
  var endDate = new Date(date);
  endDate.setHours(23);
  endDate.setMinutes(59);
  endDate.setSeconds(59);
  var query = {
    date: {$gte: startDate, $lt: endDate } 
  }

  var limit = options.limit || 10;
  var page = (options.page - 1) || 0;
  if (page < 0) page = 0;
  var skip = (page * limit) || 0;

  self.auditTrail.find(query, {sort: {date: -1}, skip: skip, limit: limit}, function(err, result) {
    if (err) return fn(err);
    if (!result) return fn(new Error("no result"));
    
    result.count(false, function(err, total) {
      if (err) return fn(err);
      result.toArray(function(err, data) {
        if (err) return fn(err);
        var obj = {
          type: "list",
          total: total,
          data: data
        }
        fn(null, obj);
      });
    });
  });
}

AuditTrail.prototype.detail = function(options, fn) {
  var self = this;

  var query = {
    _id: self.ObjectID(options.id + "")
  }

  self.auditTrail.findOne(query, fn);
}


function register (app){
  return AuditTrail(app);
}
