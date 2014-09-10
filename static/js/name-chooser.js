// Dependency: jqTre
//
var NameChooser = function(e){
  var self = this;
  self.name = "nc" + parseInt(Math.random()*10000000);
  self.title = self.name + "__title";
  self.treeName = self.name + "__tree";
  $(e).attr("id", self.name);
  self.$control = $("#" + $(e).attr("data-control"));
   
  this.shown = false;

  this.$e = $(e);
  this.init();
};

NameChooser.prototype.init = function(e) {
  var self = this;
  var $e = self.$e;

  var label = $e.attr("data-label");
  var classNames = $e.attr("data-class");
  $e.text("");
  var moved = $("<div>")
              .attr("id", self.title)
              .attr("class", classNames)
              .text(label)
              ;
  moved.click(function(e) {
    self.show(e);
  });

  var tree = $("<div>")
              .attr("id", self.treeName)
              .addClass("hidden")
              .tree({
                data:[],
                closedIcon: "<span class='icon-plus-sign'></span>",
                openedIcon: "<span class='icon-chevron-down'></span>",
                onCreateLi: function(node, $li) {
                  var last = node.name.lastIndexOf(";");
                  if (last > 0) {
                    $li.find(".jqtree-title").text("").append("<b>").text(node.name.substr(last + 1));
                  } else 
                  if (node.profile) {
                    $li.addClass("tree-leaf");
                    $li.find(".jqtree-title").after("<span class='label label-success' style='margin-left: 10px'>" + node.profile.title + "</span>");
                    $li.find(".jqtree-title").text(node.profile.fullName);
                  }
                }
              })
              ;

  tree.bind("tree.click", function(e) {
    if (e && e.node && !e.node.profile) {
      e.preventDefault();
    } else {
      self.$control = $("#" + self.$e.attr("data-control"));
      self.$control.val(e.node.username);
      self.$btnOk.removeClass("disabled");
    }
  });
  var spinner = $("<div>")
              .addClass("hidden")
              .append($("<em>").text(self.$e.attr("data-label-loading")))
              ;


  var group = $("<div>")
              .addClass("hidden");
  var btnOk = $("<div>")
              .attr("class", "btn btn-mini btn-success disabled")
              .text(self.$e.attr("data-label-choose"))
              ;
  var btnCancel = $("<div>")
              .attr("class", "btn btn-mini btn-danger")
              .text(self.$e.attr("data-label-cancel"))
              ;
  group.append(btnOk);
  group.append(btnCancel);

  self.$tree = tree;
  self.$title = moved;
  self.$spinner = spinner;
  self.$group = group;
  self.$btnOk = btnOk;
  $e.append(moved);
  $e.append(spinner);
  $e.append(tree);
  $e.append(group);

  btnOk.click(function(e) {
    var placeholder = $("#" + $e.attr("data-placeholder"));
    placeholder.find(".data-empty").addClass("hidden");
    var node = tree.tree("getSelectedNode");
    placeholder.find(".data-value")
      .removeClass("hidden")
      .text(node.profile.fullName || node.username)
      ;
    var clear = placeholder.find(".data-clear");
    clear.removeClass("hidden");
    clear.unbind();
    clear.click(function() {
      placeholder.find(".data-empty").removeClass("hidden");
      placeholder.find(".data-value").addClass("hidden");
      placeholder.find(".data-clear").addClass("hidden");
      moved.removeClass("hidden");
      self.$tree.tree("loadData", []);
      self.show();
    });
    self.hide();

  });

  btnCancel.click(function(e) {
    self.$control = $("#" + self.$e.attr("data-control"));
    self.$control.val("");

    var placeholder = $("#" + $e.attr("data-placeholder"));
    placeholder.find(".data-empty").removeClass("hidden");
    placeholder.find(".data-value").addClass("hidden");
    self.hide();
  });

}

NameChooser.prototype.show = function(e) {
  var self = this;
  if (self.shown) return;
  
  self.$title.addClass("hidden");
  self.$tree.removeClass("hidden");
  self.$spinner.removeClass("hidden");
  self.$group.removeClass("hidden");
  self.shown = true;
  self.loadData();

}

NameChooser.prototype.dispositionLoadData = function() {
  var self = this;
  var letterId = self.$e.attr("data-letter-id");
  var url = "/disposition/getRecipients";
  if (letterId) url += "?letterId=" + letterId;
  var $e = self.$e;

  $.ajax({
    url: url
  }).success(function(data) {
    self.$tree.tree("loadData", data);
  }).always(function() {
    self.$spinner.addClass("hidden");
    var placeholder = $("#" + $e.attr("data-placeholder"));
    placeholder.addClass("hidden");
  });
}

NameChooser.prototype.loadData = function() {
  var self = this;
  if (self.$e.attr("data-type") == "disposition") {
    self.dispositionLoadData();
  }
}

NameChooser.prototype.hide = function(e) {
  this.shown = false;
  var self = this;
  $e = self.$e;
  self.$tree.addClass("hidden");
  self.$group.addClass("hidden");
  var placeholder = $("#" + $e.attr("data-placeholder"));
  placeholder.removeClass("hidden");
  var value = $("#" + $e.attr("data-control"));
  if (!value.val()) {
    placeholder.find(".data-empty").removeClass("hidden");
    self.$title.removeClass("hidden");
  } else {
    placeholder.find(".data-empty").addClass("hidden");
    self.$title.addClass("hidden");
  }

}

jQuery.fn.nameChooser = function() {
  var items = $(this);
  for (var i = 0; i < items.length; i ++) {
    new NameChooser(items[i]);
  }
}
