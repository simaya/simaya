$(document).ready(function() {
  $(".single-submit").click(function(e) {
    e.preventDefault();
    $(this).attr("disabled", true);
    $(this).parents("form").submit();
  });
});
