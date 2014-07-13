$(document).ready(function() {
  $(".single-submit").click(function() {
    $(this).attr("disabled", true);
    $(this).parentsUntil("form").parent().submit();
  });
});
