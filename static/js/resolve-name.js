var resolvedNames = {};

jQuery.fn.resolveUserNames = function() {
  var render = function(item, text, data) {
    if ($(item).attr("data-type") == "full") {
      $(item).text("");
      var name = $("<span>").addClass("name").text(data.name);
      var title = $("<span>").addClass("title").text(data.title);
      var chop = data.organization.lastIndexOf(";");
      if (chop > 0) {
        data.organization = data.organization.substr(chop + 1);
      }
      var organization = $("<span>").addClass("organization").text(data.organization);
      $(item).append(name);
      $(item).append(title);
      $(item).append(organization);
    } else {
      $(item).text(data.name);
    }
  }

  var resolveName = function(item) {
    var text = $(item).text() || $(item).attr("data-value");
    if (text) {
      if (resolvedNames[text]) {
        render(item, text, resolvedNames[text]);
      } else {
        $.ajax({
          url: "/letter/getNames/" + text,
          context: item,
          dataType: 'json'
        }).done(function(jsondata) {
          if (jsondata && jsondata[0]) {
            resolvedNames[text] = jsondata[0];
            render(item, text, jsondata[0]);
          }
        });
      }
    }
  }

  var items = $(this);
  for (var i = 0; i < items.length; i ++) {
    var item = items[i];
    resolveName(item);
  };
}

$(document).ready(function() {
  $(".resolve-name").resolveUserNames();
});
