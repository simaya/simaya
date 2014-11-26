$(document).ready(function () {

  function extractQuery(loc) {
    var query = loc.substring(loc.indexOf("?") + 1);
    var queries = query.split("&");
    // Split query contents
    var queryMap = {};
    // Produce a hash map
    for (var i = 0; i < queries.length; i++) {
      var q = queries[i].split("=");
      if (q[0]) {
        queryMap[q[0]] = q[1];
      }
    }

    return queryMap;
  }

  function rebuildQuery(queryMap) {
    var query = "";
    Object.keys(queryMap).forEach(function (e) {
      query += e + "=" + queryMap[e] + "&";
    });
    return query;
  }

  $(".letter-sorting").css("cursor", "pointer");
  $(".letter-sorting").click(function () {
    var loc = document.location + "";
    if (loc.indexOf("?") > 0) {
      // Split query contents
      var queryMap = extractQuery(loc);

      if (queryMap["sort[string]"]) {
        // If sort string is in the query, reverse direction
        if (typeof(queryMap["sort[dir]"]) !== "undefined") {
          queryMap["sort[dir]"] = "" + (parseInt(queryMap["sort[dir]"]) * -1);
        } else {
          queryMap["sort[dir]"] = "-1";
        }
      }
      // Put data-field to sort
      queryMap["sort[string]"] = $(this).attr("data-field");

      loc = loc.substring(0, loc.indexOf("?")) + "?" + rebuildQuery(queryMap);
    } else {
      // No queries, just append the query
      loc += "?sort[string]=" + $(this).attr("data-field")+"&sort[dir]=1";
    }
    document.location = loc;
  });

  $(".letter-filter").click(function () {
    var loc = document.location + "";
    if (loc.indexOf("?") > 0) {
      // Split query contents
      var queryMap = extractQuery(loc);

      // Put data-field to sort
      queryMap["filter"] = $(this).attr("data-field");

      loc = loc.substring(0, loc.indexOf("?")) + "?" + rebuildQuery(queryMap);
    } else {
      // No queries, just append the query
      loc += "?filter=" + $(this).attr("data-field");
    }
    document.location = loc;
  });


  $("a[data-action=paging-link]").click(function (e) {
    var self = $(this);
    var dataPage = self.attr("data-page");
    var dataSearchString = self.attr("data-search-string");
    var dataLetterType = self.attr("data-letter-type");
    var loc = document.location + "";
    if (loc.indexOf("?") > 0) {
      var queryMap = extractQuery(loc);

      queryMap["page"] = dataPage;
      queryMap["search[string]"] = dataSearchString;
      queryMap["search[letterType]"] = dataLetterType;

      loc = loc.substring(0, loc.indexOf("?")) + "?" + rebuildQuery(queryMap);

    } else {
      loc += "?page=" + dataPage + "&search[string]=" + dataSearchString + "&search[letterType]=" + dataLetterType;
    }
    document.location = loc;
    e.preventDefault();
  });
});
