var resolvedNames = {};

jQuery.fn.resolveUserNames = function() {
  var items = $(this);
  for (var i = 0; i < items.length; i ++) {
    var item = items[i];
    var text = $(item).text();
    if (text) {
      if (resolvedNames[text]) {
        $(item).text(resolvedNames[text]);
      } else {
        $.ajax({
          url: "/letter/getNames/" + text,
          context: item,
          dataType: 'json'
        }).done(function(jsondata) {
          if (jsondata[0]) {
            var text = $(this).text();
            resolvedNames[text] = jsondata[0].name;
            $(this).text(jsondata[0].name);
          }
        });
      }
    }
  };

}

$(document).ready(function() {
  $(".resolve-name").resolveUserNames();
});
