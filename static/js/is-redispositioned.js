var resolvedNames = {};

jQuery.fn.isReDispositioned = function() {
  var items = $(this);
  for (var i = 0; i < items.length; i ++) {
    var item = items[i];
    var id = $(item).attr("id");
    if (id) {
      $.ajax({
        url: "/disposition/redispositioned?letterId=" + id,
        context: item,
        dataType: 'json'
      }).done(function(jsondata) {
        if (jsondata) {
          var data = $("<span>");
          if (jsondata.result == true) {
            data.addClass("disposition redisposition yes");
          }
          $(this).append(data);
        }
      });
    }
  };

}

$(document).ready(function() {
  $(".disposition.is-redispositioned").isReDispositioned();
});
