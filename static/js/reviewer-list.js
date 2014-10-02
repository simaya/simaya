// Dependency: moment, resolve-name
var updateReviewerList = function() {
  moment.lang("id");
  var popover;
  var allPossibleReviewers = {};
  var additionalReviewers = [];
  var automaticReviewers = [];

  var getReviewer = function(id) {
    var d = allPossibleReviewers;
    for (var i = 0; i < d.length; i ++) {
      if (d[i]._id == id) {
        return d[i];
      }
    }
  }

  var removeReviewer = function(item) {
    var d = additionalReviewers;
    var index = -1;
    for (var i = 0; i < d.length; i ++) {
      if (d[i]._id == item) {
        index = i;
        break;
      }
    }
    if (index >= 0) {
      additionalReviewers.splice(index, 1);
      populateReviewerList();
    }

  }

  var populateAllPossibleList = function(e) {
    e.children().remove();
    var d = allPossibleReviewers;
    var select = $("<select>").attr("id", "new-reviewer");
    var r = automaticReviewers;
    for (var i = 0; i < d.length; i ++) {
      var opt = $("<option>").val(d[i]._id).text(d[i].profile.fullName);
      select.append(opt);
    }
    var b = $("<div>")
      .addClass("btn btn-info btn-small")
      .text("Tambahkan")
      .css("margin-top", "10px")
      .click(function() {
        var s = $("#new-reviewer");
        var i = getReviewer(s.val());
        i.additional = true;
        additionalReviewers.push(i);
        popover.popover("hide");
        populateReviewerList();
        console.log(additionalReviewers);
      });
      ;

    e.append(select);
    e.append(b);
  }

  var populateAllReviewers = function() {
    var p = popover.parent().find(".popover-content");
    var spinner = p.find(".fa-spinner");
    var placeholder = p.find("div");

    spinner.removeClass("hidden");
    $.ajax({
      url: "/letter/all-reviewers", 
      dataType: "json"
    }).always(function () {
      spinner.addClass("hidden");
    }).done(function (result) {
      var d = result.data;
      var r = automaticReviewers;
      allPossibleReviewers = [];
      for (var i = 0; i < d.length; i ++) {
        var skip = false;
        for (var j = 0; j < r.length; j ++) {
          if (d[i].username == r[j].username) {
            skip = true;
          }
        }
        if (!skip) {
          allPossibleReviewers.push(JSON.parse(JSON.stringify(d[i])));
        }
      }

      populateAllPossibleList(placeholder);
    });
  }

  var setupAddButton = function() {
    var placeholderString =  
      "<div id='reviewer-placeholder'>" 
      + "<span class='hidden fa fa-spin fa-spinner'></span>"
      + "<div></div>"
      + "</div>"
      
    popover.attr("id", "add-reviewer-button");
    popover.addClass("fa fa-plus clickable");
    popover.tooltip({placement: "bottom", title: "Tambahkan pemeriksa lain"});
    popover.attr("data-original-title", "Pilih pemeriksa tambahan");
    popover.attr("data-content", placeholderString);
    popover.attr("data-html", "true");
    popover.attr("data-placement", "top");
    popover.click(function() {
      $(this).popover({
        html: true,
      });
      setTimeout(function() {
        populateAllReviewers();
      }, 500);
    });
  }

  var populateReviewerList = function() {
    var $list = $("#reviewers-list");
    $list.children(":not(.template)").remove();
    var data = [];

    var originator = $list.attr("data-originator");
    var currentReviewer = $list.attr("data-current");
    var status = $list.attr("data-status");
    var approved = false;
    if (status) {
      approved = (status == "3");
    }

    var date = $list.attr("data-date");
    data.push({
      date: date,
      type: "originator",
      username: originator,
      profile: {
        fullName: originator
      },
      needResolve: true
    });

    data = data.concat(automaticReviewers);
    data = data.concat(additionalReviewers);

    if (allPossibleReviewers.length != additionalReviewers.length) {
      data.push({
        type: "add-button",
      });
    }

    data.push({
      username: "tu",
      type: "administration",
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
      if (item && item.type == "add-button") {
        $item.css("width", width + "%");
        var step = $item.find(".step");
        popover = step;
        setupAddButton();
        $item.addClass("review-add");
        
      } else {
        if (item.username == currentReviewer && !approved) 
          $item.addClass("review-current");
        else if (item.username == "tu" && approved) 
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
        if (item.additional) {
          var closeButton = $("<span>").addClass("fa fa-times review-remove-additional").css("margin-left", "10px");
          var id = item._id;
          closeButton.click(function() {
            removeReviewer(id);
          });
          step.append(closeButton);
          $item.find(".title").text(item.profile.title);
        } else {
          $item.find(".title").text(item.profile.title);
        }
      }
      $list.append($item);
    }
  }

  var letterId = $("[name=_id]").val();
  var sender = $("[name=sender]").val();
  $("#reviewers-loading").removeClass("hidden");
  $.ajax({
    url: "/letter/reviewers-by-letter/" + letterId + "?sender=" + sender, 
    dataType: "json"
  }).always(function () {
    $("#reviewers-loading").addClass("hidden");
  }).done(function (result) {
    automaticReviewers = result;
    populateReviewerList();

  });


}

$(document).ready(function() {
  // Update reviewer list
  $("#sender").change(function() {
    updateReviewerList();
  });

  updateReviewerList();

});
