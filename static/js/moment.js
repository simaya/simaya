
jQuery.fn.moment = function() {
  $(this).each(function(index, item) {
    var val = $(this).attr("data-value");
    var format = $(this).attr("data-format");
    var date = new Date(val);
    if (isNaN(date.valueOf())) {
      $(this).text(val);
    } else {
      $(this).text(moment(val).format(format)); 
    }
  });
}

$(document).ready(function() {
  moment.lang("id");
  $(".moment").moment();
});
