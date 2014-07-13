Announcement = function(e) {
  this.title = $(e).attr("data-title");
  this.dismissText = $(e).attr("data-dismiss-text");
  this.update();
  this.e = e;
}

Announcement.prototype.show = function(data) {
  this.e.empty();
  var m = this.e
      .append($("<div>").addClass("modal-dialog")
          .append($("<div>").addClass("modal-content")
            .append($("<div>").addClass("modal-header"))
            .append($("<div>").addClass("modal-body"))
            .append($("<div>").addClass("modal-footer"))
            )
          )
  m.attr("id", "announcement-modal");
  var title = $("<h4>").addClass("modal-title").text(this.title);
  m.find(".modal-header").append(title);

  var body = $("<span>").text(data.message);
  m.find(".modal-header").append(body);

  var button = $("<button>").text(this.dismissText).addClass("btn btn-default").attr("data-date", data.date).attr("data-dismiss", "modal");
  m.find(".modal-footer").append(button);

  button.click(function() {
    $.cookie("announcement-seen", data.date);
  });
  m.modal();
}

Announcement.prototype.update = function() {
  var self = this;
  $.ajax({
    url: "/announcement",
    dataType: "json"
  }).done(function(data) {
    if (data) {
      var seen = $.cookie("announcement-seen");
      console.log(seen)
      if (data.date != seen) {
        // new announcement, remove old cookie
        $.removeCookie("announcement-seen");
        // and show the announcement
        self.show(data);
      }
    } else {
      // no announcement set, remove cookie
      $.removeCookie("announcement-seen");
    }
  });
}

jQuery.fn.announcement = function() {
  for (var i = 0; i < this.length; i++) {
    new Announcement($(this)); 
  }
}

$(document).ready(function() {
  $("#announcement-modal").announcement();
});
