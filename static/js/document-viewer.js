var DocumentViewerPage = function(placeholder) {
  this.placeholder = $(placeholder);
  this.buildPage();
}

DocumentViewerPage.prototype.constructor = DocumentViewerPage;
DocumentViewerPage.prototype.buildPage = function() {
  var self = this;
  var file = this.placeholder.attr("src");
  var page = this.placeholder.attr("page-number");
  var content = this.placeholder.attr("data-content");
  var image = new Image();
  image.src = "/letter/render-page/" + file + "/" + page;
  if (content) {
    image.src += "?content=1";
  }
  self.placeholder.css("background-image", "url(" + image.src + ")");
  image.onload = function() {
    self.placeholder.find(".document-viewer-page-banner").css("opacity", 0);
    self.placeholder.css("height", image.height);
    self.placeholder.css("width", image.width);
  }
  image.onerror = function() {
    self.placeholder.empty().html("Halaman tidak dapat dibuka");
  }
  
}

jQuery.fn.documentViewerPage = function() {
  $(this).each(function(x,y) {
    new DocumentViewerPage(y);
  });
}

var DocumentViewer = function(placeholder) {
  this.placeholder = $(placeholder);
  this.metadata = { numPages: 0};
  if (!this.placeholder.attr("data-disable-auto")) {
    this.readData();
  }
};

DocumentViewer.prototype.constructor = DocumentViewer;
DocumentViewer.prototype.readData = function() {
  var content = this.placeholder.attr("data-content");
  var url = "/letter/metadata/" + this.placeholder.attr("src");
  if (content) {
    url += "?content=1";
  }
  var self = this;
  $.ajax({
    url: url 
  }).done(function(data) {
    if (data.length == 0) {
      var alertDiv = $("<div>").addClass("alert").text("Mohon maaf. Dokumen tidak dapat dibaca");
      self.placeholder.append(alertDiv);
    } else {
      try{
        if (typeof(data) === "string") {
          var meta = JSON.parse(data);
        } else {
          var meta = data;
        }
        self.metadata.numPages = meta.numPages || 1;
        self.buildPages();
      } catch(e){
        var alertDiv = $("<div>").addClass("alert").text("Mohon maaf. Dokumen tidak dapat dibaca");
        self.placeholder.append(alertDiv);
      }
    }
  });
}
DocumentViewer.prototype.buildPages = function() {
  var content = this.placeholder.attr("data-content");
  this.placeholder.children().remove();
  for (var i = 0; i < this.metadata.numPages; i ++) {
    var page = $("<div>").addClass("document-viewer-page");
    page.attr("src", this.placeholder.attr("src"));
    page.attr("page-number", i);
    if (content) {
      page.attr("data-content", "true");
    }
    page.html("<div class='document-viewer-page-banner'><span>Membuka halaman...</span> <i class='icon-refresh infinite-rotation-animation'></i></div>");
    this.placeholder.append(page);
  }
  $(".document-viewer-page").documentViewerPage();
}

var viewers = {};
jQuery.fn.documentViewer = function() {
  var self = this;
  var getObjects = function() {
    var e = $(self);
    e.each(function(x,y) {
      viewers[x] = viewers[x] || new DocumentViewer(y);
    });
    return viewers;
  }
  var reload = function() {
    var v = getObjects();

    Object.keys(v).forEach(function(item) {
      v[item].readData();
    });
  }
  getObjects();
  return {
    reload: reload
  }
}

$(document).ready(function() {
  $(".document-viewer").documentViewer();
});
