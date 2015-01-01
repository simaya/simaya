function BoxModel(){
  // we haven't use it much, at least for now
}

// https://github.com/Wolfy87/EventEmitter/blob/master/docs/guide.md
// before everything else, inherit the EventEmitter
// use the aliases self.{trigger, on, off, once}
heir.inherit(BoxModel, EventEmitter);


// table-main-head
// table-main-body
// span-path

BoxModel.prototype.fetch = function(url, stamped) {

  var self = this;

  // if no url then get current location.href
  url = url || window.location.href;
  url = stamped ? url + "?slug=" + (new Date).getTime() : url;

  // fetch `$ ls -la` of current dir 
  $.getJSON(url) 
    .fail(function(xhr, msg, err){
      self.trigger("fetch:fail", json);
    })
    .done(function(json){
      self.trigger("fetch:success", [json, url]);
    });
}

// the box controller
function Box () {
  var self = this;
  self.model = new BoxModel();
  self.fileCounter = 0;
}

// open a modal for selecting files to be uploaded
Box.prototype.prepareUploadFile = function(){
  $("#modal-add-file").modal();
}

// preparing a row for adding a dir
Box.prototype.prepareCreateDir = function(){
  // scroll and wait
  if ($(window).scrollTop() > 0) {
    $("#btn-scroll-up").click();
    box.toCreateDir = true;  
  } else {
    box.prepareCreateDirCtrl();    
  }
}

// prepare the controls
Box.prototype.prepareCreateDirCtrl = function(){

  var mainControls = $(".main-control");
  var tableMainBody = $("#table-main-body");

  // disable main controls
  mainControls.prop("disabled", true);

  // set the flag to false, when scrolling we need this flag
  box.toCreateDir = false;
  
  var row = $("<tr id=\"proto-dir\" class=\"clickable\">");
  var name = $("<td class='table-body-cell-0 span6'>");
  var kind = $("<td class='table-body-cell-1 span3'>").append("--");
  var modified = $("<td class='table-body-cell-2 span3'>").append("--");

  var nameInputHtml = '<div class="input-append">' + 
    '<input id="proto-dir-input"class="span12" type="text" style="min-height : 24px;">' + 
    '<button type="submit" id="proto-dir-save" class="btn btn-mini btn-primary">' + 
    'Simpan' + 
    '</button>' + 
    '<button id="proto-dir-cancel" class="btn btn-mini btn-primary">' + 
    'Batal' + 
    '</button>' + 
    '</div>';
  var nameInput = $("<div>").html(nameInputHtml);

  name.append(nameInput);
  row.append(name);
  row.append(kind);
  row.append(modified);

  tableMainBody.prepend(row);

  box.setupProtoDirEvents();
}

// this is events from dir creation process
Box.prototype.setupProtoDirEvents = function(){
  var self = this;
  $("#proto-dir-cancel").unbind();
  $("#proto-dir-save").unbind();
  $("#proto-dir-cancel").click(self.cancelCreateDir);
  $("#proto-dir-save").click(self.createDir);
}

// handle cancel dir creation
Box.prototype.cancelCreateDir = function(){
  $("#proto-dir").remove();
  $(".main-control").prop("disabled", false);
}

Box.prototype.linkAction = function (e){

  e.preventDefault();
  e.stopPropagation();

  var download = $(this).data("download");
  var href = $(this).attr("href");

  if (!download && href) {
    $(this).prev().show();
    box.refresh(href);
  }
}

Box.prototype.setupEvents = function(){

  var self = this;

  // on clicking "+ Berkas"
  $("#add-item").click(self.prepareUploadFile);

  // on clicking "+ Direktori"
  $("#add-dir").click(self.prepareCreateDir);

  // on window resize
  $('#page-content').resize(self.windowResized);

  // model
  self.model.on("fetch:success", self.populate);

  // modal
  $("#modal-add-file").on("hidden", self.modalClosed);
  $("#modal-share-file").on("hidden", self.modalClosed);

  // 
  $("body").click(self.clearSelection);

  $("#share-item").click(self.share);

  $("#detail-item").click(self.detail);

  $("#btn-share-item").click(self.shareItem);

  $("#remove-item").click(self.removeItem);

  $("#share-users").change(function(e){
    if ($("#share-users").val()) {
      $("#btn-share-item").show();
    }
  })
}

Box.prototype.removeItem = function(e){

  var selectedItem = $($(".selected-item")[0]);
  var type = selectedItem.data("type");
  var item = selectedItem.text();

  var url = type == "application/directory.ownbox" ? "/box/delete/dir" : "/box/delete/file";

  $.post(url, {
    currentPath : currentPath,
    item : item
  })
  .fail()
  .done(function(){
    box.refresh();
    box.clearSelection();
  });

  e.preventDefault();
  e.stopPropagation();
}

Box.prototype.detail = function(e){

  $("#modal-detail-file").modal();

  e.preventDefault();
  e.stopPropagation();
}

Box.prototype.shareItem = function(e){

  var itemType = $(".selected-item").data("type");
  var url = itemType == "application/directory.ownbox" ? "/box/share/dir" : "/box/share/file";
 
  $.post(url, { 
    currentPath : currentPath, 
    users : $("#share-users").val(), 
    item : $($(".selected-item")[0]).text(),
    itemType : $(".selected-item").data("type"),
    message : $("#share-message").val()
  })
  .fail(function(){
    // nothing in here - quick fix
  })
  .done(function(json){
    // nothing in here - quick fix
  })
  .always(function(){
    $("#btn-share-item").button("reset");
    $("#modal-share-file").modal("hide");
  })

  $("#btn-share-item").button("loading");

  e.preventDefault();
  e.stopPropagation();
}

Box.prototype.modalClosed = function(){
  $(".files").children().remove();
  $(".modal-shield").unbind();
  box.clearSelection();
  box.refresh();
}

Box.prototype.share = function(e){
  e.stopPropagation();
  $("#btn-share-item").hide();
  box.initUsers();
  $("#modal-share-file").modal();
  $(".modal-shield").unbind();
  $(".modal-shield").click(function(e){
    e.stopPropagation();
  })
}

// renders
Box.prototype.populate = function(json, url) {

  var items = json.items;
  currentPath = json.currentPath;
  history.pushState(null, url.substr(url.indexOf("dir/") + 3), url);

  box.clearSelection();
  box.clearRows();

  items.forEach(function(item){
    box.createRow(item);
  });

  box.fileUpload(currentPath);
  
  $("#table-main").show();
  box.createPath(); 

  $("#indicator-main-refresh").hide();
}

Box.prototype.clearRows = function(){
  $("#table-main-body").children().remove();
}

Box.prototype.createPath = function(){

  var span = $("#span-path");
  
  // clear the path
  span.children().remove();

  var parts = currentPath.split("/");

  var url = "/box/dir";

  count = 0;

  parts.forEach(function(path){

    // if only we have `path`
    if (path) {

      count++;

      // the current url, given the `path`
      url += "/" + path;

      // append slash
      span.append($("<span>").text(" / "));

      // the current part
      var part = $("<span>").text(path);

      // check if it is the last part
      if (count < (parts.length - 1)) {

        // build the part
        part = $("<a href='" + url + "' data-download='false' >").append("<span>" + path + "</span>");
        
        $(part).unbind();

        // bind it
        if (parts[parts.length - 1] != "shared") {
          $(part).click(box.linkAction);  
        }
      }

      // append the spinner
      span.append($('<i class="icon-refresh icon-spin" style="display : none;" ></i>'));

      // append the part
      span.append(part);
    }
  });
}

// send a post ajax message to create a directory inside the box
Box.prototype.createDir = function(){

  var self = this;
  var dirname = $("#proto-dir-input").val();

  if (dirname.length > 0) {
    
    // get the path
    var path = currentPath + "/" + dirname;

    // send the message
    $.post("/box/dir", { path : path})
    .fail(function(xhr, msg, err){
    // todo render error
    })
    .done(function(json){

      box.cancelCreateDir();
      box.refresh();

    });
  }
}

Box.prototype.loading = function(flag) {

  /*if (flag) {
    var spinner = $("<div>")
    spinner.addClass("icon");
    spinner.addClass("icon-spin");
    spinner.addClass("icon-spinner");

    $("#span-path").append(spinner);
  } else {
    $("#span-path").find(".icon").remove();
  }*/

}

Box.prototype.refresh = function(url){
  $("#indicator-main-refresh").show();
  this.model.fetch(url);
}

Box.prototype.windowResized = function(){
  var pageContent = $("#page-content");
  var topBar = $("#topbar");
  var tableMainContainer = $("#table-main-container");
  var tableFloatingContainer = $("#table-floating-container");
  var tableMainHead = $("#table-main-head");
  var pageContentWidth = $("#page-content").width();
  var searchItem = $("#search-item");

  if (pageContentWidth >= 860) {
    tableFloatingContainer.show();
    topBar.addClass("topbar-fixed");
    topBar.width(pageContentWidth);
    tableMainContainer.addClass("table-main-container-floating");
    tableMainHead.hide();
  } else {
    tableFloatingContainer.hide();
    topBar.removeClass("topbar-fixed");
    tableMainContainer.removeClass("table-main-container-floating");
    tableMainHead.show();
  }
}

// re-init the file upload using current directory path
Box.prototype.fileUpload = function(pwd){

  // file upload
  $('#fileupload').show();
  $('#fileupload').unbind();
  $('#fileupload').fileupload({
    url: '/box/file',
    autoUpload : true,
    filesContainer : '.files',
    prepend : true,
    formData : { dirname : pwd },
    done: function(e, data) {
      if (data.result.error) {
          $("#modal-add-file").modal("hide");
          alert("Hanya menerima berkas berupa jpg, png, pdf, dan Open Document Format");
      } else {
        // TODO: handle file upload in background
        box.fileCounter++;
        if (box.fileCounter == data.getNumberOfFiles()){
          box.fileCounter = 0;
          $("#modal-add-file").modal("hide");
        }
      }
    }
  });
}

Box.prototype.createRow = function(options){

  var self = this;
  var tableMainBody = $("#table-main-body");

  var row = $("<tr data-owner='" + JSON.stringify(options.owner) + "' data-sharedTo='" + JSON.stringify(options.sharedTo) + "' class=\"table-entry\" >");
  var root = options.type != "application/directory.ownbox" ? window.location.pathname.split("/box/dir").join("/box/file") : window.location.pathname;

  if (root.split("/").pop() == "shared") {
    if (options.type != "application/directory.ownbox") {
      root = "/box/file" + options.dirname.slice(0, -1);  

    }
  }

  var link = root + "/" + options.name;
  link = decodeURI(link);
  var nameLinkHtml = '<i class="icon-refresh icon-spin" style="display : none;" ></i> <a class="link" href="' + link + '" data-download=' + (options.type != "application/directory.ownbox") + '>' + options.name + '</a>';
  var name = $("<td class='table-body-cell-0 span6'>").html(nameLinkHtml);
  var kind = $("<td class='table-body-cell-1 span3'>").append(options.type);
  var modified = $("<td class='table-body-cell-2 span3'>").append(options.date);

  row.append(name);
  row.append(kind);
  row.append(modified);

  tableMainBody.append(row);

  $(row).unbind();
  $(row).find("a").unbind();
  $(row).click(box.rowAction);
  $(row).find("a").click(box.linkAction);
}

Box.prototype.rowAction = function(e){
  
  var self = this;

  box.clearSelection();
  box.toggleSelection(self);

  var first = ($(self).find("td")[0]);
  var firstA = $(first).find("a");

  var second = ($(self).find("td")[1]);

  $(".item-control").show();
  $(".main-control").hide();

  if ($(second).text() == "application/directory.ownbox") {
    $("#share-item").hide();
    $("#download-item").hide();
  } else {
    $("#download-item").attr("href", firstA.attr("href"));
  }


  $(".selected-item").text(firstA.text());
  $(".selected-item").data("type", $(second).text());
  var owner = $(self).data("owner");
  var sharedTo = $(self).data("sharedto");
  var org = owner.profile.organization;
  var organization = org.substr(org.lastIndexOf(";") + 1, org.length);
  var href = "/profile/view?username=" + owner.user;
  var ownerA = $("<a>");
  ownerA.attr("href", href);
  ownerA.text(owner.profile.fullName || owner.user);
  $(".selected-item-owner").children().remove();
  $(".selected-item-shared").children().remove();
  $("#control-shared-to").hide();
  
  $(".selected-item-owner").append(ownerA);
  
  for (var i = 0; i < sharedTo.length; i++) {
    var shared = sharedTo[i].profile.fullName || sharedTo[i].user;

    var sharedA = $("<a>");
    var href = "/profile/view?username=" + sharedTo[i].user;
    
    sharedA.attr("href", href);
    sharedA.text(shared);

    $(".selected-item-shared").append(sharedA);
    
    if (i != sharedTo.length -1 ) {
      $(".selected-item-shared").append("<span>, </span>")
    }

    $("#control-shared-to").show();
  }
  
  


  if (e.metaKey) {

  }

  if (e.shiftKey) {

  }

  e.stopPropagation();
}

/* selection */
// toggle selection state of an item
Box.prototype.toggleSelection = function(el){
  // toggle selection, check current item class
  var c = $(el).attr("class");

  // if it has selected then remove it
  if (c.indexOf("selected") >= 0) {
    $(el).removeClass("selected");
  } else {
    // else add the class
    $(el).addClass("selected");
  }
}

// clear up selection from rows
Box.prototype.clearSelection = function(){
  
  // remove the selected class from items
  $("tr").removeClass("selected");

  // show the main control and hide the item control
  $(".main-control").show();
  $(".item-control").hide();
  $(".selected-item").text("");
  
}

Box.prototype.initUsers = function(){

  $("#share-message").val("");

  $("#share-users").select2("data", null);

  $("#share-users").select2({
    allowClear : true,
    placeholder: "Cari pengguna",
    tags : true,
    initSelection: function (element, callback) {
        var data = [];
        callback(data);
    },
    minimumInputLength: 3,
    ajax: {
        url: "/box/users",
        dataType: 'json',
        quietMillis: 100,
        data: function (term, page) { // todo add page to limit result
            return {
                q: term
            };
        },
        results: function (data, page) {
            return {results: data, more: false};
        }
    },
    formatResult: box.userFormatResult, 
    formatSelection: box.userFormatSelection, 
    escapeMarkup: function (m) { return m; } 
  });
}

Box.prototype.userFormatResult = function(user) {
  return "<b>" + user.name + "</b>";
}

Box.prototype.userFormatSelection = function(user) {
  return user.id;
}

// blastoff!
$(function(){

  var box = new Box();
  window.box = box;

  box.setupEvents();
  box.refresh(location.href);
  box.initUsers();

  // visual hacks
  $('input').css('color', '#393939'); 
  $('textarea').css('color', '#393939');

});
