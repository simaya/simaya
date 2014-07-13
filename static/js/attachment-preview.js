var attachmentPreview = function() {
  var show = function(e) {
    e.popover({html: true, title:"Pratinjau",trigger: "hover", content: "<img src='" + e.attr("data-href") + "'>"});
  }

  return {
    show: show
  }
}();

jQuery.fn.attachmentPreview = function(data) {
  
  var re = /(png|gif|jpeg|jpg)$/;
  var rePdf = /(pdf|PDF)$/;

  var i = this.length;

  while (i--) {

    var attachmentId = $(this[i]).attr("data-attachment-id");
    var uri;

    if ($(this[i]).text().match(re)) {
      // if image
      attachmentPreview.show($(this[i]));
    }
    else if ($(this[i]).text().match(rePdf)) {
      // if pdf, we need more data about it
      var letterId = $(this[i]).attr("data-letter-id");
      var dispositionId = $(this[i]).attr("data-disposition-id");
      var allowDisposition = $(this[i]).attr("data-allow-disposition") || false;

      uri = "/letter/view-pdf-stub/" + letterId + "/" + attachmentId;

      if (dispositionId) {
        uri += "/" + dispositionId;
      }

      if (allowDisposition) {
        uri += "?allowDisposition=true";
      }
    } 
    // if not pdf, set it as downloadable
    uri = uri || "/letter/attachment/" + attachmentId;
    $(this[i]).attr("href", uri);
  }
}

$(document).ready(function() {
  $(".attachment-preview").attachmentPreview();
});
