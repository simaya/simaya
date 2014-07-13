module.exports = function(app) {
  var letter = require('../models/letter.js')(app)
    , disposition = require('../models/disposition.js')(app)
    , utils = require('../../sinergis/controller/utils.js')(app)
    , sinergisVar = app.get('sinergisVar')
    , ObjectID = app.ObjectID;
    
  var simple = function(req, res) {
    var vals = {};

    var breadcrumb = [
      {text: 'Pencarian', isActive: true}
    ];
    vals.breadcrumb = breadcrumb;
      
    if (typeof(req.body.search) !== "undefined") {
      
      if (req.body.search.strings != null) {
        var searchStrings = req.body.search.strings.replace(new RegExp(" ", "g"), "|");
      }
      console.log(req.body.search);
      var op = "$eq"
      if (req.body.search.op == "lt") {
        op = "$lt"
      } else if (req.body.search.op == "gt") {
        op = "$gt"
      } else if (req.body.search.op == "lte") {
        op = "$lte"
      } else if (req.body.search.op == "gte") {
        op = "$gte"
      }
      if (req.body.search.type == "letter") {
        var search = {
          search: {
            $or : [
              {
                'title': { $regex : searchStrings }
              }
              , {
                'body': { $regex : searchStrings }
              }
              , {
                'mailId': { $regex : searchStrings }
              }
              , {
                'outgoingAgenda': { $regex : searchStrings }
              }
              , {
                'incomingAgenda': { $regex : searchStrings }
              }
            ],
            status: {}
          },
        }
        
        if (op == "$eq") {
          search.search["status"] = parseInt(req.body.search.status)
        } else {
          search.search["status"][op] = parseInt(req.body.search.status)
        }
        console.log(search)
        letter.list(search, function(result){
          result.forEach(function(e, i) {
            if (e.receivedDate == null) {
              result[i].receivedDate = e.creationDate;
            }
          });
          vals.letters = result;
          utils.render(req, res, 'search-simple', vals, 'base-authenticated');
        });
      } else if (req.body.search.type == "disposition") {
        var search = {
          search: {
            'message': { $in: searchStrings }
          }
        }
        
        disposition.list(search, function(result) {
          vals.dispositions = result;
          console.log(vals);
          utils.render(req, res, 'search-simple', vals, 'base-authenticated');
        });
      }
    }
  }
  
  var advanced = function(req, res) {
    var vals = {};
    var search = {};
    search.search = {};

    var breadcrumb = [
      {text: 'Pencarian', link: '/search'},
      {text: 'Advanced', isActive: true}
    ];
    vals.breadcrumb = breadcrumb;
      
    if (typeof(req.body.letter) !== "undefined") {
      if (req.body.letter.sender != "") {
        search.search.sender = req.body.letter.sender;
      }
      
      if (req.body.letter.recipient != "") {
        search.search.recipients = {$in: [req.body.letter.recipient]};
      }
      
      if (req.body.letter.title != "") {
        var searchStrings = req.body.letter.title.replace(new RegExp(" ", "g"), "|");
        search.search.title = {$regex : searchStrings};
      }
      
      if (req.body.letter.fromDate != "" && req.body.letter.toDate != "") {
        var fromDate = new Date(req.body.letter.fromDate);
        var toDate = new Date(req.body.letter.toDate);
        search.search.$and = [
                                {creationDate: {$gt : fromDate}},
                                {creationDate: {$lt : toDate}},
                              ];
      } else if (req.body.letter.fromDate != "" && req.body.letter.toDate == "") {
        var fromDate = new Date(req.body.letter.fromDate);
        search.search.creationDate = {$gt : fromDate};
      } else if (req.body.letter.fromDate == "" && req.body.letter.toDate != "") {
        var toDate = new Date(req.body.letter.toDate);
        search.search.creationDate = {$lt : toDate};
      }
      
      if (req.body.letter.body != "") {
        var searchStrings = req.body.letter.body.split(" ");
        search.search.body = {$in: searchStrings};
      }
      
      console.log(search);
      letter.list(search, function(result){
        if (result != null) {
          result.forEach(function(e, i) {
            if (e.receivedDate == null) {
              result[i].receivedDate = e.creationDate;
            }
          });
          vals.letters = result;
          console.log(vals);
        }
        utils.render(req, res, 'search-advanced', vals, 'base-authenticated');
      });
      
    } else if (typeof(req.body.disposition) !== "undefined") {
      if (req.body.disposition.sender != "") {
        search.search.sender = req.body.disposition.sender;
      }
      
      if (req.body.disposition.recipient != "") {
        search.search.recipients = {$in: [req.body.disposition.recipient]};
      }
      
      if (req.body.disposition.title != "") {
        var searchStrings = req.body.disposition.message.split(" ");
        search.search.message = {$in: searchStrings};
      }
      
      if (req.body.disposition.fromDate != "" && req.body.disposition.toDate != "") {
        var fromDate = new Date(req.body.disposition.fromDate);
        var toDate = new Date(req.body.disposition.toDate);
        search.search.$and = [
                                {creationDate: {$gt : fromDate}},
                                {creationDate: {$lt : toDate}},
                              ];
      } else if (req.body.disposition.fromDate != "" && req.body.disposition.toDate == "") {
        var fromDate = new Date(req.body.disposition.fromDate);
        search.search.creationDate = {$gt : fromDate};
      } else if (req.body.disposition.fromDate == "" && req.body.disposition.toDate != "") {
        var toDate = new Date(req.body.disposition.toDate);
        search.search.creationDate = {$lt : toDate};
      }
      
      console.log(search);
      disposition.list(search, function(result) {
        if (result != null) {
          vals.dispositions = result;
          console.log(vals);
        }
        utils.render(req, res, 'search-advanced', vals, 'base-authenticated');
      });
      
    } else {
      vals.title = 'Pencarian Lanjutan';
      vals.searchForm = true;
      utils.render(req, res, 'search-advanced', vals, 'base-authenticated');
    }
  }
  
  var index = function(req, res) {
    var vals = {
      title: sinergisVar.appName,
    }
      
    utils.render(req, res, 'index', vals, 'base-authenticated');
  }
  
  return {
    simple: simple,
    advanced: advanced,
    index: index
  }
}
