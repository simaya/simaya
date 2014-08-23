// Dependency: moment, resolve-name
var updateReviewerList = function() {
  moment.lang("id");
  var populateReviewerList = function(data) {
    var $list = $("#reviewers-list");

    var originator = $list.attr("data-originator");
    var currentReviewer = $list.attr("data-current");
    var date = $list.attr("data-date");
    data.unshift({
      date: date,
      username: originator,
      profile: {
        fullName: originator
      },
      needResolve: true
    });
    data.push({
      username: "",
      profile: {
        fullName: "Tata Usaha"
      }
    });
    $list.children(":not(.template)").remove();
    var width = (100/data.length);
    for (var i = 0; i < data.length; i ++) {
      var item = data[i];
      var $item = $list.find(".template").clone();
      $item.removeClass("hidden");
      $item.removeClass("template");
      if (item.username == currentReviewer) 
        $item.addClass("review-current");
      else if (item.action == "approved") 
        $item.addClass("review-approved");
      else if (item.action == "declined") 
        $item.addClass("review-declined");
      $item.css("width", width + "%");
      var step = $item.find(".step");
      step.text(item.profile.fullName);
      if (item.needResolve) {
        step.resolveUserNames();
      }
      if (item.date) {
        var tooltip = moment(item.date).fromNow();
        if (item.message) 
          tooltip += ": " + item.message;
        step.tooltip({placement: "bottom", title: tooltip});
      }
      $item.find(".title").text(item.profile.title);
      $list.append($item);
    }
  }

  var letterId = $("[name=_id]").val();
  $("#reviewers-loading").removeClass("hidden");
  $.ajax({
    url: "/letter/reviewers-by-letter/" + letterId, 
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
