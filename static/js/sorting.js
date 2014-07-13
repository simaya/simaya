$(document).ready(function() {
  $(".sorting").css("cursor", "pointer");
  $(".sorting").click(function() {
    var loc = document.location + "";
    if (loc.indexOf("?") > 0) {
      // Split queries and path
      var query = loc.substring(loc.indexOf("?") + 1);
      var queries = query.split("&");
      // Split query contents
      var queryMap = {};
      // Produce a hash map
      for (var i = 0; i < queries.length; i ++) {
        var q = queries[i].split("=");
        if (q[0]) {
          queryMap[q[0]] = q[1]; 
        }
      }

      if (queryMap["sort[string]"]) {
        // If sort string is in the query, reverse direction
        if (typeof(queryMap["sort[dir]"]) !== "undefined") {
          queryMap["sort[dir]"] = "" + (parseInt(queryMap["sort[dir]"]) * -1);
        } else {
          queryMap["sort[dir]"] = "-1";
        }
      }
      // Put data-field to sort 
      queryMap["sort[string]"] = $(this).attr("data-field")

      // Rebuild query
      query = "";
      Object.keys(queryMap).forEach(function(e) {
        query += e + "=" + queryMap[e] + "&";
      })
      loc = loc.substring(0, loc.indexOf("?")) + "?" + query
    } else {
      // No queries, just append the query
      loc += "?sort[string]=" + $(this).attr("data-field")
    }
    document.location = loc; 
  });
});
