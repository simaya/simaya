// Dependencies: moment, pagination
//
var LinkLetterMaps = {};
var LinkLetter = function(e, initialData) {
  if ($(e) 
      && $(e).attr("data-name")
      && LinkLetterMaps[$(e).attr("data-name")]) {
    var linkLetter = LinkLetterMaps[$(e).attr("data-name")];
    return linkLetter;
  }

  if (!(this instanceof LinkLetter)) return new LinkLetter(e, initialData);
  this.name = "link-letter-" + parseInt(Math.random()*10000000);
  this.$e = $(e);
  this.$e.attr("data-name", this.name);

  this.init();
  this.selections = {};
  if (initialData && initialData.length > 0) {
    for (var i = 0; i < initialData.length; i ++) {
      initialData[i].initial = true;
      this.selections[initialData[i]._id] = initialData[i];
    }
    this.populateList();
  }
  LinkLetterMaps[this.name] = this;

}

LinkLetter.prototype.populateList = function() {
  var self = this;

  self.list.find("li:not(.template)").remove();
  var template = self.list.find("li.template");
  var urlTemplate = "/letter/read/";
  var canUpdate = false; 
  Object.keys(self.selections).forEach(function(item) {
    var data = self.selections[item];
    var row = template.clone();
    row.removeClass("hidden template");
    var url = urlTemplate + data._id;
    row.find(".title").text(data.title);
    row.find(".url").attr("href", url).attr("target", "_blank");
    self.list.append(row);
    var dismiss = row.find(".dismiss");
    var id = data._id;
    if (data.initial) {
      dismiss.addClass("hidden");
    } else {
      canUpdate = true;
      dismiss.click(function() {
        delete self.selections[id];
        self.populateList();
      });
    }
  });
  if (self.btnUpdate) {
    if (canUpdate) {
      self.btnUpdate.removeClass("hidden");
    } else {
      self.btnUpdate.addClass("hidden");
    }
  }
}

LinkLetter.prototype.populateSelections = function() {
  var self = this;

  var selectionWidgets = $(".link-letter-checkbox");

  var insert = function(checked, data) {
    if (checked && data && data._id) {
      self.selections[data._id] = data;
    } else if (data && data._id && self.selections[data._id]) {
      delete self.selections[data._id];
    }
  }

  var maps = {};
  for (var i = 0; i < selectionWidgets.length; i ++) {
    var w = $(selectionWidgets[i]);
    var data;
    var dataRaw = w.attr("data");
    var checked = w.prop("checked") == true;
    if (dataRaw) data = JSON.parse(dataRaw);
    if (!data) continue;

    insert(checked, data);
  }
  self.modal.modal("hide");
  self.populateList();
}

LinkLetter.prototype.initModal = function() {
  var self = this;

  var modalTitle = self.$e.attr("data-title") || "missing data-title attribute";
  var dismissButtonLabel = self.$e.attr("data-dismiss-label") || "missing data-dismiss-label attribute";
  var acceptButtonLabel = self.$e.attr("data-accept-label") || "missing data-accept-label attribute";
  var dataLoadingLabel = self.$e.attr("data-loading-label") || "missing data-loading-label attribute";

  var modal = $("<div>").addClass("link-letter-modal modal fade").attr("id", "modal-" + self.name);
  var header = $("<div>").
      addClass("modal-header").
      append($("<a>").attr("data-dismiss","modal").addClass("close").text("×")).
      append($("<h3>").text(modalTitle));

  var spinner = $("<div>")
    .addClass("hidden")
    .append($("<span>").css("margin-right", "10px").addClass("fa fa-spin fa-spinner"))
    .append($("<em>").text(dataLoadingLabel));

  var body = $("<div>");
  var modalBody = $("<div>").addClass("modal-body").append(spinner).append(body);

  var dismissButton = $("<div>").addClass("btn btn-warning").attr("data-dismiss", "modal").text(dismissButtonLabel);
  var acceptButton = $("<div>").addClass("btn btn-success").text(acceptButtonLabel).attr("disabled", true);
  
  var footer = $("<div>")
      .addClass("modal-footer")
      .append(dismissButton)
      .append(acceptButton);

  modal
    .append(header)
    .append(modalBody)
    .append(footer);

  acceptButton.click(function() {
    self.populateSelections();
  });

  $("body").append(modal);
  self.modal = modal;
  self.acceptButton = acceptButton;
  self.body = body;
  self.spinner = spinner;
}

LinkLetter.prototype.initContainer = function() {
  var self = this;

  var container = $("<div>");
  self.container = container;
  self.$e.append(container);
}

LinkLetter.prototype.initButton = function() {
  var self = this;

  var selectButtonLabel = self.$e.attr("data-button-label") || "missing data-button-label attribute";
  var selectButtonClass = self.$e.attr("data-button-class") || "btn btn-info";
  var selectButton = $("<div>").addClass(selectButtonClass).text(selectButtonLabel);

  selectButton.click(function() {
    self.modal.modal("show");
    var width = window.innerWidth * 0.8;
    var left = (window.innerWidth - width) / 2;
    self.modal.css("width", width);
    self.modal.css("left", left);
    self.modal.css("margin-left", "0px");
    self.loadData();
  });
  self.container.append(selectButton);
}

LinkLetter.prototype.init = function() {
  var self = this;

  self.letterId = self.$e.attr("data-letter-id");
  self.initModal();
  self.initContainer();
  self.initButton();
  self.initAgendaWidgets();
  self.initLetterList();

}

LinkLetter.prototype.initLetterList = function() {
  var self = this;
  var btnDismissLetterLabel = self.$e.attr("data-button-dismiss-letter-label") || "missing data-button-dismiss-letter-label attribute";
  self.canUpdate = (self.$e.attr("data-can-update") == "true");
  var btnUpdateLabel = self.$e.attr("data-button-update-label") || "missing data-button-update-label attribute";

  var list = $("<ol>");
  var row = $("<li>");
  row.addClass("template hidden");
  var link = $("<a>");
  link.addClass("url");
  var title = $("<span>")
  title.addClass("title");
  var dismiss = $("<span>");
  dismiss.text(btnDismissLetterLabel)
    .addClass("dismiss")
    .css("margin-left", "5px")
    .css("cursor", "pointer")
    ;
  link.append(title);
  row.append(link);
  row.append(dismiss);
  list.append(row);
  self.list = list;
  self.container.append(list);

  if (self.letterId && self.canUpdate) {
    var btnUpdate = $("<span>").addClass("btn btn-info hidden").text(btnUpdateLabel);
    self.container.append(btnUpdate);
    self.btnUpdate = btnUpdate;

    btnUpdate.click(function() {
      self.update();
    });
  }
}

LinkLetter.prototype.update = function() {
  var self = this;

  self.spinner.removeClass("hidden");
  var url = "/api/4/letters/"+ self.letterId + "/link";
  var data = {
    ids: Object.keys(self.selections)
  };
  $.post(url, data).success(function(data) {
    self.btnUpdate.addClass("hidden");
  }).always(function() {
    self.spinner.addClass("hidden");
  });
 
}

LinkLetter.prototype.initAgendaWidgets = function() {
  var self = this;

  var btnIncomingAgendaLabel = self.$e.attr("data-button-incoming-agenda-label") || "missing data-button-incoming-agenda-label attribute";
  var btnOutgoingAgendaLabel = self.$e.attr("data-button-outgoing-agenda-label") || "missing data-button-outgoing-agenda-label attribute";
  var btnSearchLabel = self.$e.attr("data-button-search-label") || "missing data-button-search-label attribute";
  var tableDateLabel = self.$e.attr("data-table-date-label") || "missing data-table-date-label attribute";
  var tableLetterNumberLabel = self.$e.attr("data-table-letter-number-label") || "missing data-table-letter-number-label attribute";
  var tableAgendaLabel = self.$e.attr("data-table-agenda-label") || "missing data-table-agenda-label attribute";
  var tableSenderLabel = self.$e.attr("data-table-sender-label") || "missing data-table-sender-label attribute";
  var tableTitleLabel = self.$e.attr("data-table-title-label") || "missing data-table-title-label attribute";

  var tab = $("<div>").addClass("usertab btn-group").css("width","100%");
  var btnIncomingAgenda = $("<a>").addClass("btn tab active").attr("href", "#").text(btnIncomingAgendaLabel).attr("name", "incoming");
  var btnOutgoingAgenda = $("<a>").addClass("btn tab").attr("href", "#").text(btnOutgoingAgendaLabel).attr("name", "outgoing");
  var inputContainer = $("<div>").addClass("input-append pull-right");
  var btnSearch = $("<button>").addClass("btn btn-info").text(btnSearchLabel);
  var inputSearch = $("<input>").attr("type", "text");
  inputContainer.append(inputSearch);
  inputContainer.append(btnSearch);

  btnIncomingAgenda.click(function() {
    btnOutgoingAgenda.removeClass("active");
    btnIncomingAgenda.addClass("active");
    var search = inputSearch.val();
    self.loadData("incoming", 1, search);
  });

  btnOutgoingAgenda.click(function() {
    btnIncomingAgenda.removeClass("active");
    btnOutgoingAgenda.addClass("active");
    var search = inputSearch.val();
    self.loadData("outgoing", 1, search);
  });

  btnSearch.click(function(e) {
    e.preventDefault();
    var activeTab = $(".btn.tab.active").attr("name");
    var search = inputSearch.val();
    self.loadData(activeTab, 1, search);
  });

  tab.append(btnIncomingAgenda);
  tab.append(btnOutgoingAgenda);
  tab.append(inputContainer);

  var table = $("<table>").addClass("table table-bordered table-striped");
  var header = $("<thead>")
    .append($("<tr>")
      .append($("<th>"))
      .append($("<th>").text(tableDateLabel))
      .append($("<th>").text(tableAgendaLabel))
      .append($("<th>").text(tableSenderLabel))
      .append($("<th>").text(tableTitleLabel))
    )
  var checkBox = $("<div>").addClass("controls").append($("<input>").attr("type", "checkbox").addClass("ace link-letter-checkbox")).append($("<span>").addClass("lbl"));
  var tableBody = $("<tbody>")
    .append($("<tr>").addClass("hidden template")
      .append($("<td>").append(checkBox))
      .append($("<td>").addClass("date moment").attr("data-format","dddd, DD MMMM YYYY"))
      .append($("<td>").addClass("agenda"))
      .append($("<td>").addClass("sender"))
      .append($("<td>").addClass("title"))
    )

  table.append(header);
  table.append(tableBody);
  
  var paginationContainer = $("<div>");
  paginationContainer.addClass("pull-center");
  var pagination = $("<div>");
  pagination.addClass("pagination")
    .attr("data-label-total","%TOTAL%")
    ;

  paginationContainer.append(pagination);


  self.pagination = pagination;
  self.body.append(tab);
  self.body.append(table);
  self.body.append(paginationContainer);
}

LinkLetter.prototype.populateData = function(agenda, data, page) {
  var self = this;

  var checkSelection = function() {
    var selections = $(".link-letter-checkbox:checked");
    if (selections.length > 0) {
      self.acceptButton.attr("disabled", false);
    } else {
      self.acceptButton.attr("disabled", true);
    }
  }

  var body = self.body.find("tbody");
  body.find("tr:not(.template)").remove();
  if (!data || !data.data) { 
    //  Reset pagination when there's no data
    self.pagination.attr("data-total", 0);
    self.pagination.attr("data-page", 1);
    self.pagination.pagination();
    return;
  }
  var template = body.find("tr.template");
  for (var i = 0; i < data.data.length; i++) {
    var d = data.data[i];
    var row = template.clone();
    row.removeClass("template hidden");
    var checked = (typeof self.selections[d._id] !== "undefined");
    row.find("input")
      .click(checkSelection)
      .attr("checked", checked)
      .attr("data", JSON.stringify(d))
      ;
    row.find(".date").attr("data-value", d.date).moment();
    row.find(".agenda").text(d.incomingAgenda || d.outgoingAgenda);
    if (d.senderManual) {
      var label = d.senderManual.name + "<br>" + d.senderManual.organization + "<br>" + d.senderManual.address;
      row.find(".sender").html(label);
    } else {
      row.find(".sender").text(d.sender);
    }
    row.find(".title").text(d.title);
    body.append(row);
  }

  var count = data.total;
  self.pagination.attr("data-total", count);
  self.pagination.attr("data-limit", 20);
  self.pagination.attr("data-page", page);
  self.pagination.pagination(function(page) {
    self.loadData(agenda, page, search);
  });
}

LinkLetter.prototype.loadData = function(agenda, page, search) {
  var self = this;
  var page = page || 1;
  var url = "/api/4/agendas/"+ (agenda || "incoming" ) + "s?limit=20&page=" + page ;
  if (search) {
    url += "&search[letterType]=&search[string]=" + search;
  }
  self.spinner.removeClass("hidden");
  $.ajax({
    url: url
  }).success(function(data) {
    self.populateData(agenda, data, page, search);
  }).always(function() {
    self.spinner.addClass("hidden");
  });
}

jQuery.fn.linkLetter = function(initialData) {
  var items = $(this);
  var results = [];
  for (var i = 0; i < items.length; i ++) {
    results.push(LinkLetter(items[i], initialData));
  }
  if (results.length > 1) {
    return results;
  }
  return results[0];
}
