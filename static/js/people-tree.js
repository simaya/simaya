var PeopleTree = function() {
  this.onSelect = null;
  this.selectedNode = null;
}

PeopleTree.prototype.setData = function(data) {
  var maps = {}
  var lastLevel = -1;
  var topLevel = [];
  var getLength = function(string) {
    var count = 0;
    for (var i = 0; i < string.length; i ++) {
      if (string.charAt(i) == ";") {
        count ++;
      }
    }
    return count;
  }

  for (var i = 0; i < data.length; i ++) {
    var item = data[i];

    if (item && item.profile && item.profile.organization) {
      var key = item.profile.organization;
      var level = getLength(key);
      var parentIndex = key.lastIndexOf(";");
      var parentKey;
      if (parentIndex > 0) {
        parentKey = key.substr(0, parentIndex);
      }

      if (lastLevel == -1 || level < lastLevel) {
        topLevel = [];
        topLevel.push(key);
        lastLevel = level;
      } else if (level == lastLevel) {
        topLevel.push(key);
      }
      console.log("level", lastLevel);

      maps[key] = maps[key] || [];
      var children = maps[key].children || [];
      children.push({
        data: item,
        username: item.username,
        label: item.profile.fullName
      });
      maps[key].children = children;
      maps[key].label = key;

      if (maps[parentKey]) {
        var children = maps[parentKey].children || [];
        children.push(maps[key]);
        maps[parentKey].children = children;
        maps[parentKey].label = parentKey;
      }
    }
  }

  var result = [];
  for (var i = 0; i < topLevel.length; i ++) {
    var item = topLevel[i];
    result.push(maps[item]);
  }

  this.data = result;
} 

PeopleTree.prototype.select = function(set) {
  this.onSelect = set;
}

PeopleTree.prototype.render = function(el) {
  var self = this;
  var $el = $(el);
  $el.tree({
    data: self.data,
    autoOpen: true,
    dragAndDrop: true,
    onCreateLi: function(node, $li) {
      if (node && node.data && node.data.profile) {
        var jobTitle = $("<span>")
          .addClass("label label-success")
          .css("margin-left", "10px")
          .text(node.data.profile.title)
          ;
        $li.find('.jqtree-title').append(jobTitle);
      }
    }
  });

  $el.bind("tree.click", function(event) {
    event.stopPropagation();

  });
  $el.bind("tree.select", function(event) {
    if (event.node && event.node.username) {
      self.selectedNode = event.node;
    } else {
      self.selectedNode = null;
    }
    if (self.onSelect) {
      self.onSelect(self.selectedNode);
    }
  });
}


