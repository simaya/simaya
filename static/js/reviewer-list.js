// Dependency: moment, resolve-name
var updateReviewerList = function() {
  moment.lang("id");
  var popover;
  var allPossibleReviewers = {};
  var additionalReviewers = [];
  var automaticReviewers = [];
  var finalReviewers = [];

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
      if (d[i].username == item) {
        index = i;
        break;
      }
    }
    if (index >= 0) {
      additionalReviewers.splice(index, 1);
      populateReviewerList();
      checkAddButton();
    }

  }

  var populateAllPossibleList = function(e) {
    e.children().remove();
    var d = allPossibleReviewers;
    var select = $("<div>").attr("id", "new-reviewer");
    var r = automaticReviewers;
    var tree = new PeopleTree();
    tree.setData(d);
    var b = $("<div>")
      .attr("id", "btn-add-new-reviewer")
      .addClass("btn btn-info btn-small hidden")
      .text("Tambahkan")
      .css("margin-top", "10px")
      .click(function(e) {
        var i = tree.selectedNode; 
        if (i) {
          var data = JSON.parse(JSON.stringify(i.data));
          data.additional = true;
          additionalReviewers.push(data);
          popover.popover("hide");
          populateReviewerList();
          checkAddButton();
          popover.active = false;
        }
      });
      ;
    tree.select(function(node) {
      var b = $("#btn-add-new-reviewer")
      if (node) {
        b.removeClass("hidden");
      } else {
        b.addClass("hidden");
      }
    });

   var c = $("<div>")
      .addClass("btn btn-warning btn-small")
      .text("Batal")
      .css("margin-top", "10px")
      .click(function(e) {
        e.preventDefault();
        e.stopPropagation();
        popover.active = false;
        popover.popover("hide");
      });
  
    e.append(select);
    e.append(b);
    e.append(c);
    setTimeout(function() {
      tree.render("#new-reviewer");
    }, 500);
  }

  var populateAllReviewersData = function(cb) {
    var cbCalled = false;
    $.ajax({
      url: "/letter/all-reviewers", 
      dataType: "json"
    }).always(function () {
      if (cb && !cbCalled) cb();
    }).done(function (result) {
      var d = result.data;
      var r = finalReviewers;
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
      if (cb) {
        cbCalled = true;
        cb();
      }
    });
  }

  var populateAllReviewers = function(cb) {
    var p = popover.parent().find(".popover-content");
    var spinner = p.find(".fa-spinner");
    var placeholder = p.find("div");

    spinner.removeClass("hidden");
    populateAllReviewersData(function() {
      spinner.addClass("hidden");
      populateAllPossibleList(placeholder);
    });
  }

  var setupAddButton = function() {
    var placeholderString =  
      "<div id='reviewer-placeholder'>" 
      + "<span class='hidden fa fa-spin fa-spinner'></span>"
      + "<div></div>"
      + "</div>";
      
    // Remove id of all previous elements which have this id
    $("#add-reviewer-button").attr("id", "");
    popover.attr("id", "add-reviewer-button");
    popover.addClass("fa fa-plus clickable");
    popover.removeClass("hidden");
    popover.attr("title", "Pilih pemeriksa tambahan");
    popover.attr("data-content", placeholderString);
    popover.attr("data-html", "true");
    popover.attr("data-placement", "top");
    popover.css("margin: 10px");
  }

  var populateReviewerList = function() {

    var $list = $("#reviewers-list");
    $list.children(":not(.template)").remove();
    var data = [];

    var originator = $list.attr("data-originator");
    var currentReviewer = $list.attr("data-current");
    var status = $list.attr("data-status");
    var readOnly = ($list.attr("data-readonly") == "true");
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

    var sender;
    // Work on the copy
    var automatic = JSON.parse(JSON.stringify(automaticReviewers));
    if (automatic.length > 0) {
      sender = automatic.pop();
    }
    data = data.concat(automatic);
    data = data.concat(additionalReviewers);

    if (!readOnly) {
      data.push({
        type: "add-button",
      });
    }

    if (sender) {
      data.push(sender);
    }

    data.push({
      username: "tu",
      type: "administration",
      profile: {
        fullName: "Tata Usaha"
      }
    });

    finalReviewers = data;
    var additionalString = "";
    for (var i = 0; i < additionalReviewers.length; i ++) {
      if (additionalReviewers[i].username) {
        additionalString += additionalReviewers[i].username;
        if (i < additionalReviewers.length - 1) {
          additionalString += ",";
        }
      }
    }
    var inputElement = $list.attr("data-input");
    if (inputElement) {
      $("[name=" + inputElement + "]").val(additionalString);
    }

    $list.children(":not(.template)").remove();
    var width = (100/data.length);
    for (var i = 0; i < data.length; i ++) {
      var item = data[i];
      var $item = $list.find(".template").clone();
      $item.removeClass("hidden");
      $item.removeClass("template");
      if (item && item.type == "add-button") {
        $item.css("width", "30%");
        var step = $item.find(".step");
        if (popover) {
          popover.popover("destroy");
        }
        popover = step;
        setupAddButton();
        $item.addClass("review-add");
        $item.find(".title").text("Tambahkan pemeriksa");
        
        $item.find(".body").click(function(e) {
          if (popover.active) return;
          e.stopPropagation();
          var p = popover.popover({
            html: true,
          });
          p.popover("show");
          popover.active = true;
          setTimeout(function() {
            populateAllReviewers();
          }, 500);
        });
      } else {
        var step = $item.find(".step");
        if (item.username == currentReviewer && !approved) { 
          $item.find(".body").prepend($("<span>").addClass("fa fa-envelope reviewer-current").attr("title","Pemeriksa saat ini"));
          $item.addClass("review-current");
        } else if (item.username == "tu" && approved)  {
          $item.find(".body").prepend($("<span>").addClass("fa fa-envelope reviewer-current").attr("title","Menunggu pengiriman"));
          $item.addClass("review-current");
        } else if (item.action == "approved") 
          $item.addClass("review-approved");
        else if (item.action == "declined") 
          $item.addClass("review-declined");
        $item.css("width", "50%");
        var avatar = $item.find(".contact-avatar");
        avatar.attr("data-username", item.username);
        avatar.contactAvatar();
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
          var closeButton = $("<span>")
            .addClass("fa fa-times review-remove-additional")
            .css("margin-left", "10px")
            .attr("data-id", item.username)
            ;
          closeButton.click(function() {
            removeReviewer($(this).attr("data-id"));
          });
          step.append(closeButton);
          $item.find(".title").text(item.profile.title);
        } else {
          $item.find(".title").text(item.profile.title);
        }
      }
      if (i == 0) {
        $list.prepend($item);
      } else {
        $list.append($item);
      }
    }
  }

  var checkAddButton = function() {
    populateAllReviewersData(function() {
      if (allPossibleReviewers.length == 0) {
        $("#add-reviewer-button").addClass("hidden");
      } else {
        $("#add-reviewer-button").removeClass("hidden");
      }
    });
  }

  var $list = $("#reviewers-list");
  var letterId = $("[name=_id]").val() || $list.attr("data-id");
  var sender = $("[name=sender]").val() || $list.attr("data-sender");

  if (!letterId || !sender) {
    return;
  }
  $("#reviewers-loading").removeClass("hidden");
  $.ajax({
    url: "/letter/reviewers-by-letter/" + letterId + "?sender=" + sender, 
    dataType: "json"
  }).always(function () {
    $("#reviewers-loading").addClass("hidden");
  }).done(function (result) {
    automaticReviewers = result;
    populateReviewerList();
    checkAddButton();
  });
}

$(document).ready(function() {
  // Update reviewer list
  $("#sender").change(function() {
    updateReviewerList();
  });

  updateReviewerList();

});
