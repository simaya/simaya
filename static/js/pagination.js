var Pagination = function(e, clickFunction) {
  if (!(this instanceof Pagination)) return new Pagination(e, clickFunction);
  this.$e = $(e);
  this.init();
  this.clickFunction = clickFunction;
}

Pagination.prototype.init = function() {
  var runQuery = function(page) {
    var queryString = window.location.search.replace("?", ""); 
    var queries = queryString.split("&");

    var maps = {};

    for (var i = 0; i < queries.length; i ++) {
      var q = queries[i];
      if (q) {
        if (q.indexOf("=") > 0) {
          var q_s = q.split("=");
          if (q_s[0] == "page") {
            maps["page"] = page;
          } else {
            maps[q_s[0]] = q_s[1];
          }
        } else {
          maps[q] = undefined;
        }
      }
    }
    if (!maps["page"]) maps["page"] = page;
    var qs = "?";
    Object.keys(maps).forEach(function(item) {
      if (!maps[item]) {
        qs += item + "&";
      } else {
        qs += item + "=" + maps[item] + "&";
      }
    });
    window.location.search = qs;
  }


  var self = this;
  var $e = self.$e;

  var ul = $("<ul>");
  var prev = $("<li>");
  var next = $("<li>");
  var li = $("<li>");

  var pages = 10;
  var page = $e.attr("data-page") || 1;
  var total = $e.attr("data-total");
  var labelTotal = $e.attr("data-label-total");
  var label = $("<span style='display:block'>").text(labelTotal.replace("%TOTAL%", total));

  var startPage = parseInt(page/10)*10 + 1 - (page%10 == 0 ? 10 : 0);
  var maxPage = Math.floor(total/10);
  var endPage = startPage + pages;
  if (endPage > maxPage) endPage = maxPage;

  $e.append(label);
  $e.append(ul);
  ul.append(prev);
  prev.append($("<span>").addClass("icon-chevron-left"));
  prev.attr("data-page", parseInt(page) - 1);
  next.attr("data-page", parseInt(page) + 1);
  if (startPage > 1) {
    prev.click(function(e) {
      var page = $(this).attr("data-page");
      if (self.clickFunction) {
        self.clickFunction(page, e);
      }else {
        runQuery(page);
      }
    });
    prev.addClass("clickable");
  } else {
    prev.addClass("disabled");
  }

  if (endPage < maxPage) {
    next.click(function(e) {
      var page = $(this).attr("data-page");
      if (self.clickFunction) {
        self.clickFunction(page, e);
      }else {
        runQuery(page);
      }
    });
    next.addClass("clickable");
  } else {
    next.addClass("disabled");
  }

  for (var i = startPage; i < endPage; i ++) {
    var active;
    if (page == i) active = "active clickable"; else active = "clickable";
    ul.append(li.clone().attr("class", active).append($("<a>").attr("data-page", i).click(function(e) {
      var page = $(this).attr("data-page");
      if (self.clickFunction) {
        self.clickFunction(page, e);
      }else {
        runQuery(page);
      }
    }).text(i)));
  }

  ul.append(next);
  next.append($("<span>").addClass("icon-chevron-right"))
}

jQuery.fn.pagination = function(clickFunction) {
  var items = $(this);
  for (var i = 0; i < items.length; i ++) {
    Pagination(items[i], clickFunction);
  }
}
