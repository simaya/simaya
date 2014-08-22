var updateReviewerList = function() {
  var populateReviewerList = function(data) {
    var $list = $("#reviewers-list");
    $list.children(":not(.template)").remove();
    for (var i = 0; i < data.length; i ++) {
      var item = data[i];
      var $item = $list.find(".template").clone();
      $item.removeClass("hidden");
      $item.removeClass("template");
      if (item.current) $item.addClass("active");
      $item.find(".step").text(item.profile.fullName);
      $item.find(".title").text(item.profile.title);
      $list.append($item);
    }
  }

  var sender = $("#sender").val();
  var letterId = $("[name=_id]").val();
  $("#reviewers-loading").removeClass("hidden");
  $.ajax({
    url: "/letter/reviewers-by-user/" + sender + "/" + letterId, 
    dataType: "json"
  }).always(function () {
    $("#reviewers-loading").addClass("hidden");
  }).done(function (result) {
    populateReviewerList(result);

  });


}

$(document).ready(function() {
  // Update reviewer list
  $("#sender").change(function() {
    updateReviewerList();
  });

  updateReviewerList();

});
