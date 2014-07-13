Timeline = function() {
  this.me = $(".user-info").attr("data-username");
  moment.lang("id");
}

Timeline.prototype.post = function() {
  var self = this;
  $(".post-button").prop("disabled", true);
  $(".post-timeline-text").prop("disabled", true);
  var post = $(".post-timeline-text").val();

  var data = {
    text: post,
  }
  var attachment = $("#upload-placeholder").attr("data-attachment");
  if (attachment) {
    data.attachment = attachment;
  }
  $.ajax({
    url: "/timeline",
    type: "POST",
    data: data
  }).success(function(result) {
    if (result.id) {
      self.reRenderTimeline(result.id)
    } else {
      $("#timeline-post-error").css("display", "block");
    }
  }).always(function(result) {
    $(".post-button").prop("disabled", false);
    $(".post-timeline-text").prop("disabled", false);
    $(".post-timeline-text").val("");
    $("#upload-placeholder").attr("data-attachment","");
    $(".timeline.attachment.preview").css("display", "none"); 
  }).error(function(result) {
    $("#timeline-post-error").css("display", "block");
  });
}

Timeline.prototype.postComment = function(id, button, textElement) {
  button.prop("disabled", true);
  var post = textElement.val();

  var data = {
    id: id,
    text: post,
  }
  $.post("/timeline/comment", data, function(result) {
    console.log(result);
    button.prop("disabled", false);
    textElement.val("");
  });
}

Timeline.prototype.love = function(id) {
  var data = {
    id: id
  }
  $.post("/timeline/love", data, function(result) {
    if (result.ok == "true") {
      self.reRenderTimeline(id)
    }
  });
}

Timeline.prototype.unlove = function(id) {
  var data = {
    id: id
  }
  $.post("/timeline/unlove", data, function(result) {
    if (result.ok == "true") {
      self.reRenderTimeline(id)
    }
  });

}

Timeline.prototype.renderOneTimeline = function(story, data) {
  var self = this;
  var id = data._id;
  story.find(".avatar").attr("data-username", data.user);
  story.find(".name").text(data.user);
  story.find(".timeline.text").text(data.text);
  story.find(".time").text(moment(data.date).fromNow());
  if (data.attachment) {
    story.find(".attachment").empty();
    story.find(".attachment").append($("<img>").attr("src", data.attachment));
  } else {
    story.find(".attachment").remove();
  }
  story.find(".profile").attr("href", "/profile/view?" + data.user);
  var comments = data.comments;
  var loves = data.loves;

  var meLove = false;
  var loveCount = 0;
  var commentsCount = 0;
  var htmlLovers = "";
  if (loves && Object.keys(loves).length > 0) {
    Object.keys(loves).forEach(function(x,j) {
      if (self.me == loves[x].user) {
        meLove = true;
      }
      htmlLovers += "<span class=resolve-name>"+loves[x].user+"</span>";
    });
    loveCount = Object.keys(loves).length;
    resolvedLovers = $(htmlLovers);
    resolvedLovers.resolveUserNames();
    lovers = "";
    for (var i = 0; i < resolvedLovers.length; i ++) {
      lovers += resolvedLovers[i].innerText + "<br>";
    }
    resolvedLovers = htmlLovers = null;
  }
  if (data.comments) {
    var sortFunction = function(a, b) {
      if (a.date < b.date) {
        return 1;
      } else if (a.date > b.date) {
        return -1;
      }
      return 0;
    }
    data.comments = data.comments.sort(sortFunction);
    var commentPlaceholder = story.find(".itemdiv.dialogdiv.template");
    story.find(".itemdiv.dialogdiv.content").remove();
    for (var i = 0; i < data.comments.length; i ++) {
      var comment = commentPlaceholder.clone();
      comment.removeClass("template").addClass("content");
      var avatar = comment.find(".timeline.comment.commenter");
      avatar.attr("data-username", data.comments[i].user);
      avatar.contactAvatar();
      comment.find(".time").text(moment(data.comments[i].date).fromNow());
      comment.find(".name").text(data.comments[i].user); 
      comment.find(".text").text(data.comments[i].text); 
      commentPlaceholder.after(comment);
    }
    commentsCount = data.comments.length;
  }

  if (loveCount > 0 || commentsCount > 0) {
    var c = story.find(".love-counter");
    if (loveCount > 0) {
      c.css("display", "inline");
      c.find("span").text(loveCount);
      c.attr("data-html", true);
      c.attr("title", lovers);
      c.attr("data-toggle","tooltip");
      c.on("mouseover", function() {
        $(this).tooltip("show");
      });
    } else {
      c.css("display", "none");
    }
    var c = story.find(".comments-counter");
    if (commentsCount > 0) {
      c.css("display", "inline");
      c.find("span").text(commentsCount);
    } else {
      c.css("display", "none");
    }
    story.find(".timeline.control.counter").css("display", "block");
  } else {
    story.find(".counter").css("display", "none");
  }

  // Hide love button if already love
  if (meLove) {
    story.find(".unlove-button").css("display", "inherit");
    story.find(".love-button").css("display", "none");
    story.find(".unlove-button").unbind();
    story.find(".unlove-button").click(function() {
      self.unlove(id);
      self.reRenderTimeline(id);
    });
  } else {
    story.find(".love-button").css("display", "inherit");
    story.find(".unlove-button").css("display", "none");
    story.find(".love-button").unbind();
    story.find(".love-button").click(function() {
      self.love(id);
      self.reRenderTimeline(id);
    });
  }
  story.find(".timeline.comment.me").attr("data-username", self.me);
  var commentButton = story.find(".btn-comment");
  var textElement = story.find(".comment-timeline-text");
  commentButton.unbind();
  commentButton.click(function() {
    self.postComment(id, commentButton, textElement);
    self.reRenderTimeline(id);
  });
}

Timeline.prototype.reRenderTimeline = function(id) {
  var self = this;
  var story = $("[data-id=" + id + "]");  
  var newlyAdded = false;
  if (story.length == 0) {
    var start = $(".timeline.start");
    story = $(".timeline.story.template").clone();  
    story.attr("data-id", id);
    start.after(story);
    newlyAdded = true;
  }
  $.ajax({
    url: "/timeline/json?id=" + id,
    dataType: "json",
  }).success(function(data) {
    self.renderOneTimeline(story, data[0]);
    $(".resolve-name").resolveUserNames();
    if (newlyAdded) {
      story.find(".contact-avatar.timeline.avatar").contactAvatar();
      story.find(".contact-avatar.timeline.comment.me").contactAvatar();
      story.find(".resolve-name").resolveUserNames();
      story.find("textarea").autogrow();
      story.removeClass("template");
    }
  });

}

Timeline.prototype.renderTimeline = function(data) {
  var self = this;
  var start = $(".timeline.start");
  for (var i = 0; i < data.length; i ++) {
    var story = $(".timeline.story.template").clone();  

    story.removeClass("template");

    self.renderOneTimeline(story, data[i]);
    story.attr("data-id", data[i]._id);
    start.after(story);
  }
  $(".contact-avatar.timeline.avatar").contactAvatar();
  $(".contact-avatar.timeline.comment.me").contactAvatar();
  $(".resolve-name").resolveUserNames();
  $("textarea").autogrow();
}

Timeline.prototype.update = function() {
  var self = this;
  $.ajax({
    url: "/timeline/json",
    dataType: "json",
  }).success(function(data) {
    if (data.length == 0) {
      $("#no-story").css("display", "inherit");
    } else {
      $("#no-story").css("display", "none");
      self.renderTimeline(data);
    }

  });
}

Timeline.prototype.setupEvents = function() {
  var self = this;
  $(".post-button").click(function() {
    self.post(); 
  });
}


$(document).ready(function() {
  timeline = new Timeline();
  timeline.setupEvents();
  timeline.update();
});
