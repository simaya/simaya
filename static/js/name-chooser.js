// Dependency: jqTre
//
var NameChooser = function(e){
  var self = this;
  self.name = "nc" + parseInt(Math.random()*10000000);
  self.title = self.name + "__title";
  self.treeName = self.name + "__tree";
  $(e).attr("id", self.name);
  self.$control = $("#" + $(e).attr("data-control"));
  self.manualMode = false;
   
  this.started = false;

  this.$e = $(e);
  this.init();
};

NameChooser.prototype.init = function(e) {
  var self = this;

  self.type = self.$e.attr("data-type");
  self.subType = self.$e.attr("data-subtype") || null;
  // This is for multiple selection in multiple selection tree (e.g letter)
  self.enableMultiple = self.$e.attr("data-enable-multiple") == "true";
  // This is for multiple selection inside a selection tree (e.g disposition)
  self.enableMultipleInASelection = self.$e.attr("data-enable-multiple-in-a-selection") == "true";
  self.enableManual = self.$e.attr("data-enable-manual") == "true";
  self.initWidget(e);
  var manualRecipientData = window.manualRecipientData || {};

  if (self.type == "letter" || self.type == "calendar" && self.enableManual && manualRecipientData && manualRecipientData.name) {
    
    var f = self.$manualFields;
    f.find("[name=recipientManual\\[name\\]]").val(manualRecipientData.name);
    f.find("[name=recipientManual\\[organization\\]]").val(manualRecipientData.organization);
    f.find("[name=recipientManual\\[address\\]]").val(manualRecipientData.address);
    self.startAddManual();
  }
  if (self.val().length != 0) {
    self.renderPlaceholder();
  }
}

NameChooser.prototype.initWidget = function(e) {
  var self = this;
  var $e = self.$e;

  var label = $e.attr("data-label");
  var classNames = $e.attr("data-class");
  $e.text("");

  var moved = $("<div>")
  var addDb = $("<span>")
    .attr("id", self.title)
    .attr("class", classNames)
    .append($("<span>").addClass("fa fa-plus").css("margin-right", "10px"))
    .append($("<span>").text(label))
    ;

  self.$addDb = addDb;

  moved.append(addDb);
  if (self.type == "letter" || self.type == "calendar" && self.enableManual) {
    self.initManual();

    var addManual = $("<span>")
      .attr("class", classNames)
      .css("margin-left", "5px")
      .append($("<span>").addClass("fa fa-plus").css("margin-right", "10px"))
      .append($("<span>").text($e.attr("data-add-manual-label")))
    moved.append(addManual);
    self.$addManual = addManual;

    addManual.click(function(e) {
      self.startAddManual(e);
    });
  }

  addDb.click(function(e) {
    self.start(e);
  });


  var tree = $("<div>")
    .attr("id", self.treeName)
    .addClass("hidden")
    .tree({
      data:[],
      closedIcon: "<span class='icon-plus-sign'></span>",
      openedIcon: "<span class='icon-chevron-down'></span>",
      onCreateLi: function(node, $li) {
        if (node.name) {
          var last = node.name.lastIndexOf(";");
          if (last > 0) {
            $li.find(".jqtree-title").text("").append("<b>").text(node.name.substr(last + 1));
          } 
        } 
        if (node.profile) {
          $li.addClass("tree-leaf");
          $li.find(".jqtree-title").after("<span class='label label-success' style='margin-left: 10px'>" + node.profile.title + "</span>");
          $li.find(".jqtree-title").text(node.profile.fullName);
          $li.find(".jqtree-title").before("<span class='fa name-chooser-selected-name'>");
        }
      }
    })
    .bind(
    'tree.select',
    function (event) {
      event.preventDefault();
      if (event.node) {
        if (event.node.profile) {
          tree.tree("selectNode", event.node);
        }
      }
    });
    ;


  if (self.enableMultipleInASelection) {
    tree.bind("tree.click", function(e) {
      e.preventDefault();
      var selectedNode = e.node;
      if (!selectedNode.id) return;

      if (tree.tree("isNodeSelected", selectedNode)) {
        tree.tree("removeFromSelection", selectedNode);
      } else {
        tree.tree("addToSelection", selectedNode);
      }
    });
  }

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
  self.$btnCancel = btnCancel;

  $e.append(moved);
  $e.append(spinner);
  if (self.type == "letter" || self.type == "calendar") {
    var orgChooser = $("<div>").addClass("hidden");
    orgChooser.select = $("<select>");
    orgChooser.append(orgChooser.select);
    orgChooser.select.append($("<option>"));

    orgChooser.chosen = function() {
      orgChooser.select.chosen();
    }
    orgChooser.val = function() {
      return orgChooser.select.val();
    }

    var selectOrg = function() {
      self.chosenOrg = orgChooser.val();;
      self.letterLoadDataPart2();
      self.start();
    }
    orgChooser.change(function() {
      selectOrg();
    });
    self.$orgChooser = orgChooser;
    $e.append(orgChooser);
  }
  $e.append(tree);
  $e.append(group);

  self.setupButtons();
};

NameChooser.prototype.startAddManual = function() {
  var self = this;

  if (self.$orgChooser) self.$orgChooser.addClass("hidden");
  self.$tree.addClass("hidden");
  self.$addDb.addClass("hidden");
  self.$addManual.addClass("hidden");
  self.$group.removeClass("hidden");
  self.$btnOk.addClass("hidden");
  self.$manualFields.removeClass("hidden");
  self.manualMode = true;
}

NameChooser.prototype.getValue = function() {
  var self = this;
  var val = self.$control.val();
  var data = [];
  if (val) {
    data = val.split(",");
    if (data.length == 1 && data[0] == "") {
      data = [];
    }
  }

  return data;
}

NameChooser.prototype.emitChange = function() {
  var self = this;
  if (self.$control.change) {
    self.$control.change();
  }

}

NameChooser.prototype.setValue = function(val) {
  var self = this;

  if (!val && self.enableMultipleInASelection) {
    var nodes = self.$tree.tree("getSelectedNodes");
    var data = [];
    for (var i = 0; i < nodes.length; i ++) {
      data.push(nodes[i].username);
    }
    self.$control.val(data.join(","));
    self.emitChange();
    return;
  }

  var data = self.getValue();
  var newValue;
  if (val) {
    newValue = val;
  } else {
    var node = self.$tree.tree("getSelectedNode");
    if (!node) {
      return;
    }
    newValue = node.username;
  }

  var add = true;
  for (var i = 0; i < data.length; i ++) {
    if (newValue == data[i]) {
      add = false;
      break;
    }
  }
  if (add) data.push(newValue);
 
  if (data.length > 0) {
    self.$control.val(data.join(","));
  } else {
    self.$control.val("");
  }
  
  self.emitChange();
}

NameChooser.prototype.val = function(a) {
  var self = this;

  if (arguments.length == 1) {
    return self.setValue(a);
  } else {
    return self.getValue();
  }
}

NameChooser.prototype.removeName = function(name) {
  var self = this;
  var data = self.val();
  var newData = [];
  for (var i = 0; i < data.length; i ++) {
    if (name != data[i]) {
      newData.push(data[i]);
    }
  }
  if (data.length > 0) {
    self.$control.val(newData.join(","));
  } else {
    self.$control.val("");
  }
}

NameChooser.prototype.initManual = function() {
  var self = this;

  var key = "recipientManual";
  var fields = $("<div>")
    .append($("<input>")
        .attr("type","hidden")
        .attr("name", key + "[id]")
        .attr("value","1"))
    .append($("<span>")
        .text("Nama")
        .append("<br>"))
    .append($("<input>")
        .attr("type","text")
        .attr("name", key + "[name]")
        .addClass("span8")
        .append("<br>"))
    .append($("<span>")
        .text("Instansi")
        .prepend("<br>")
        .append("<br>"))
    .append($("<input>")
        .attr("type","text")
        .attr("name", key + "[organization]")
        .addClass("span8")
        .append("<br>"))
    .append($("<span>")
        .text("Alamat instansi")
        .prepend("<br>")
        .append("<br>"))
    .append($("<textarea>")
        .attr("name", key + "[address]")
        .addClass("span8")
        .append("<br>"));

  self.$e.append(fields);
  self.$manualFields = fields;
  fields.addClass("hidden");
}

NameChooser.prototype.renderPlaceholder = function() {
  var self = this;

  var placeholder = $("#" + self.$e.attr("data-placeholder"));
  placeholder.removeClass("hidden");
  placeholder
    .find(".data-empty").addClass("hidden");
  var v = placeholder.find(".data-value");
  v.removeClass("hidden")
    .children().remove();
    ;
  var list = $("<ul>");

  v.append(list);

  var data = self.val();
  if (data.length == 0) {
    placeholder.find(".data-empty").removeClass("hidden");
    self.$title.removeClass("hidden");
    if (self.type == "letter" || self.type == "calendar" && self.enableManual) {
      self.$addManual.removeClass("hidden");
    }
    self.$tree.tree("loadData", []);
    self.start();
  }

  for (var i = 0; i < data.length; i ++) {
    var li = $("<li>");

    var clear = $("<span>")
      .addClass("dismiss-x-button fa fa-times")
      .attr("data-value", data[i])
      ;

    clear.click(function() {
      self.removeName($(this).attr("data-value"));
      self.emitChange();
      self.renderPlaceholder();
    });

    var label = $("<span>")
      .addClass("resolve-name")
      .text(data[i])
      ;

    li.append(label);
    li.append(clear);
    list.append(li);

  }
  $(".resolve-name").resolveUserNames();
}

NameChooser.prototype.setupButtons = function() {
  var self = this;

  var btnOk = self.$btnOk;
  var btnCancel = self.$btnCancel;

  btnOk.click(function(e) {
    self.setValue();
    self.renderPlaceholder();
    self.hide();
  });

  btnCancel.click(function(e) {
    if (self.type == "letter" || self.type == "calendar" && self.chosenOrg) {
      self.$orgChooser.removeClass("hidden");
      self.$tree.addClass("hidden");
      self.chosenOrg = "";
    } else if (self.type == "letter" || self.type == "calendar" && self.manualMode) {
      self.$manualFields.addClass("hidden");
      self.$group.addClass("hidden");
      self.$addDb.removeClass("hidden");
      self.$addManual.removeClass("hidden");
      self.$manualFields.find("input").val("");
      self.$manualFields.find("textarea").val("");
      self.manualMode = false;

    } else {
      if (self.$orgChooser) self.$orgChooser.addClass("hidden");
    }
  });
}

NameChooser.prototype.start = function(e) {
  var self = this;
  self.manualMode = false;
  if (self.started) return;
  
  self.$title.addClass("hidden");
  self.$tree.removeClass("hidden");
  self.$spinner.removeClass("hidden");
  self.$group.removeClass("hidden");
  self.$btnOk.removeClass("hidden");
  self.started = true;
  self.loadData();
}

NameChooser.prototype.populateOrganization = function(data) {
  var self = this;
  var chooser = self.$orgChooser.select;
  if (typeof(data) === "string") data = JSON.parse(data);
  for (var i = 0; i < data.length; i ++) {
    var org = data[i];
    var $option = $("<option>").val(org.name).text(org.name);
    
    chooser.append($option);
  }

  self.$orgChooser.removeClass("hidden");
  self.$orgChooser.chosen();
}

NameChooser.prototype.letterLoadData = function() {
  var self = this;
  var letterId = self.$e.attr("data-letter-id");
  var url = "/findOrg?onlyFirstLevel=1";
  var $e = self.$e;

  self.$spinner.addClass("hidden");
  $.ajax({
    url: url
  }).success(function(data) {
    self.populateOrganization(data);
  }).always(function() {
    self.$spinner.addClass("hidden");
  });
}

NameChooser.prototype.letterLoadDataPart2 = function() {
  var self = this;
  var letterId = self.$e.attr("data-letter-id");
  var org = self.chosenOrg;
  var url = "/letter/getRecipients?org=" + org;
  if (self.$control.val()) {
    url += "&exclude=" + self.$control.val();
  }
  var $e = self.$e;

  self.$spinner.removeClass("hidden");
  $.ajax({
    url: url
  }).success(function(data) {
    if (typeof(data) === "string") data = JSON.parse(data);
    self.$orgChooser.addClass("hidden");
    self.$tree.removeClass("hidden");
    self.$tree.tree("loadData", data);
  }).always(function() {
    self.$spinner.addClass("hidden");
  });
}


NameChooser.prototype.dispositionLoadData = function() {
  var self = this;
  var letterId = self.$e.attr("data-letter-id");
  var url = "/disposition/getRecipients";
  if (self.subType == "share") {
    url = "/disposition/getShareRecipients";
  }
  if (letterId) url += "?letterId=" + letterId;
  var $e = self.$e;

  $.ajax({
    url: url
  }).success(function(data) {
    console.log(data);
    self.$tree.tree("loadData", data);
  }).always(function() {
    self.$spinner.addClass("hidden");
    var placeholder = $("#" + $e.attr("data-placeholder"));
    placeholder.addClass("hidden");
  });
}

NameChooser.prototype.loadData = function() {
  var self = this;
  if (self.type == "disposition") {
    self.dispositionLoadData();
  } else if (self.type == "letter" || self.type == "calendar") {
    self.$tree.addClass("hidden");
    if (self.chosenOrg) {
      self.letterLoadDataPart2();
    } else {
      self.letterLoadData();
    }
  }
}

NameChooser.prototype.hide = function(e) {
  this.started = false;
  var self = this;
  $e = self.$e;
  self.$tree.addClass("hidden");
  self.$group.addClass("hidden");

  var node = self.$tree.tree("getSelectedNode");
  if (node && node.username) {
    if (self.type == "letter" || self.type == "calendar") self.$orgChooser.addClass("hidden");
  } else {
  }
  if (self.enableMultiple) {
    self.$title.removeClass("hidden");
    if (self.type == "letter" || self.type == "calendar" && self.enableManual) {
      if (self.val().length > 0) {
        self.$addManual.addClass("hidden");
      } else {
        self.$addManual.removeClass("hidden");
      }
    }
  }
}

jQuery.fn.nameChooser = function() {
  var items = $(this);
  for (var i = 0; i < items.length; i ++) {
    new NameChooser(items[i]);
  }
}
