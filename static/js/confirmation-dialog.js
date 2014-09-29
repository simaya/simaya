var confirm = function(e) {
  if ($(this).attr("data-confirmation-confirmed")) {
  } else {
    var self = $(this);
    e.preventDefault();
    $(".modal-confirmation-dialog").remove();
    var modal = $("<div>").addClass("modal fade modal-confirmation-dialog").attr("role", "dialog").attr("id", "modal_confirmation__");
    var header = $("<div>").addClass("modal-header")
                      .append($("<button>").attr("data-dismiss", "modal").addClass("close").text("×"))
                      .append($("<h3>").text($(this).attr("data-confirmation-header")))
    var body = $("<div>").addClass("modal-body").text($(this).attr("data-confirmation-body"))
    var footer = $("<div>").addClass("modal-footer")
                      .append($("<button>").addClass("btn").attr("data-dismiss", "modal").text($(this).attr("data-confirmation-close-text")))
                      .append($("<button>").addClass("btn btn-primary").attr("data-dismiss", "modal").text($(this).attr("data-confirmation-confirm-text")).click(function() { self.attr("data-confirmation-confirmed","1"); self.click()}))
    modal.append(header);
    modal.append(body);
    modal.append(footer);
    $("#main-container").append(modal);
    modal.modal("show");
  }
}

$(document).ready(function() {
  $(".requires-confirmation").click(confirm);
});
