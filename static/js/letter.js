var LetterComposer = function(e) {
  var self = this;
  this.$e = e;
  this.formData = {};

  e.submit(function(ev) {
    ev.preventDefault();
      self.submit();
  });

  var tryValidate = function() {
    if (self.validationProcess) return;
    self.validationProcess = setTimeout(function() {
      self.validate();
      self.validationProcess = null;
    }, 1000);
  }

  // Register on-change events for each input
  // and validates on each change
  var elements = self.$e.find(":input");
  elements.each(function(index, item) {
    $(item).on("input change", function() {
      tryValidate();
    });
  });

  $('#fileupload').on("fileuploadadd fileuploadchange", function() {
    tryValidate();
  });
  self.validate(false);
};

LetterComposer.prototype.prepareData = function() {
  var self = this;
  var elements = self.$e.find(":input");

  if (window["CKEDITOR"] && CKEDITOR && CKEDITOR.instances && CKEDITOR.instances.text_body) {
    CKEDITOR.instances.text_body.updateElement();
  }
  elements.each(function(index, item) {
    var $item = $(item);
    if ($item.attr("type") == "checkbox") {
      self.formData[$item.attr("name")] = ($item.prop("checked"));
    } else {
      if ($item.attr("name") && $item.attr("data-value")) {
        self.formData[$item.attr("name")] = $item.attr("data-value");
      } else {
        self.formData[$item.attr("name")] = $item.val();
      }
    }
  });
}

LetterComposer.prototype.validateManualOutgoing = function(step) {
  var self = this;
  var allFields = [
    ["date", "mailId", "sender", "outgoingAgenda"],
    ["title", "priority", "classification"],
    ["type", "comments"]
    ]

  var fields = allFields[step - 1];
  var errorFields = [];

  var ok = true;
  for (var i = 0; i < fields.length; i ++) {
    var field = fields[i];

    if (!self.formData[field]) {
      errorFields.push(field);
      ok = false;
    }
  }

  var files = $(".files").children().length;
  if (!files){
    errorFields.push("files");
    ok = false;
  }

  if (self.formData.date) {
    if (isNaN(new Date(self.formData.date).valueOf())) {
      errorFields.push("date");
      ok = false;
    }
  }

  var recipientManual = false;
  if (self.formData["recipientManual[id]"] &&
      self.formData["recipientManual[name]"] &&
      self.formData["recipientManual[address]"] &&
      self.formData["recipientManual[organization]"]
      ) {
    recipientManual = true;
  }
  if (!recipientManual && step == 2) {
    errorFields.push("recipientManual");
    ok = false;
  }
  return {
    success: ok,
    fields: errorFields
  }
}

LetterComposer.prototype.validateManualIncoming = function(step) {
  var self = this;
  var allFields = [
    ["date", "receivedDate", "mailId", "incomingAgenda"],
    ["recipient", "title", "priority", "classification"],
    ["type"]
    ]

  var fields = allFields[step - 1];
  var errorFields = [];

  var ok = true;
  for (var i = 0; i < fields.length; i ++) {
    var field = fields[i];

    if (!self.formData[field]) {
      errorFields.push(field);
      ok = false;
    }
  }

  var files = $(".files").children().length;
  if (!files){
    errorFields.push("files");
    ok = false;
  }

  if (self.formData.date) {
    if (isNaN(new Date(self.formData.date).valueOf())) {
      errorFields.push("date");
      ok = false;
    }
  }

  if (self.formData.receivedDate) {
    if (isNaN(new Date(self.formData.receivedDate).valueOf())) {
      errorFields.push("receivedDate");
      ok = false;
    }
  }

  var senderManual = false;
  if (self.formData["senderManual[id]"] &&
      self.formData["senderManual[name]"] &&
      self.formData["senderManual[address]"] &&
      self.formData["senderManual[organization]"]
      ) {
    senderManual = true;
  }
  if (!self.formData.sender && !senderManual) {
    errorFields.push("sender");
    errorFields.push("senderManual");
    ok = false;
  }
  return {
    success: ok,
    fields: errorFields
  }
}

LetterComposer.prototype.validateReceiveIncoming = function(step) {
  var self = this;

  var fields = ["incomingAgenda"]
  var errorFields = [];

  var ok = true;
  for (var i = 0; i < fields.length; i ++) {
    var field = fields[i];

    if (!self.formData[field]) {
      errorFields.push(field);
      ok = false;
    }
  }

  return {
    success: ok,
    fields: errorFields
  }
}


LetterComposer.prototype.validateSendOutgoing = function(step) {
  var self = this;

  var fields = ["mailId", "outgoingAgenda"]
  var errorFields = [];

  var ok = true;
  for (var i = 0; i < fields.length; i ++) {
    var field = fields[i];

    if (!self.formData[field]) {
      errorFields.push(field);
      ok = false;
    }
  }

  var files = $(".files").children().length;
  if (!files){
    if (!self.formData["ignoreFileAttachments"]) {
      errorFields.push("files");
      ok = false;
    }
  }

  return {
    success: ok,
    fields: errorFields
  }
}

LetterComposer.prototype.validateReviewOutgoing = function(step) {
  var self = this;
  var allFields = [
    ["sender", "date"],
    ["title", "priority", "classification"],
    ["type", "comments"]
    ]

  var fields = allFields[step - 1];
  var errorFields = [];

  var ok = true;
  for (var i = 0; i < fields.length; i ++) {
    var field = fields[i];

    if (!self.formData[field]) {
      errorFields.push(field);
      ok = false;
    }
  }

  var recipientManual = false;
  var recipientDb = false;
  if (self.formData.recipients) {
    recipientDb = true;
  }
  if (self.formData["recipientManual[id]"] &&
      self.formData["recipientManual[name]"] &&
      self.formData["recipientManual[address]"] &&
      self.formData["recipientManual[organization]"]
      ) {
    recipientManual = true;
  }

  if (step == 2 && (recipientManual == false && recipientDb == false)) {

    errorFields.push("recipient");
    ok = false;
  }


  /*
  var files = $(".files").children().length;
  if (!files){
    errorFields.push("files");
    ok = false;
  }
  */

  if (self.formData.date) {
    if (isNaN(new Date(self.formData.date).valueOf())) {
      errorFields.push("date");
      ok = false;
    }
  }

  return {
    success: ok,
    fields: errorFields
  }
}


LetterComposer.prototype.validateOutgoing = function(step) {
  var self = this;
  var allFields = [
    ["sender", "date"],
    ["title", "priority", "classification"],
    ["type", "comments"]
    ]

  var fields = allFields[step - 1];
  var errorFields = [];

  var ok = true;
  for (var i = 0; i < fields.length; i ++) {
    var field = fields[i];

    if (!self.formData[field]) {
      errorFields.push(field);
      ok = false;
    }
  }

  var recipientManual = false;
  var recipientDb = false;
  if (self.formData.recipients) {
    recipientDb = true;
  }
  if (self.formData["recipientManual[id]"] &&
      self.formData["recipientManual[name]"] &&
      self.formData["recipientManual[address]"] &&
      self.formData["recipientManual[organization]"]
      ) {
    recipientManual = true;
  }

  if (step == 2 && (recipientManual == false && recipientDb == false)) {

    errorFields.push("recipient");
    ok = false;
  }

  /*
  var files = $(".files").children().length;
  if (!files){
    errorFields.push("files");
    ok = false;
  }
  */

  if (self.formData.date) {
    if (isNaN(new Date(self.formData.date).valueOf())) {
      errorFields.push("date");
      ok = false;
    }
  }

  return {
    success: ok,
    fields: errorFields
  }
}

LetterComposer.prototype.validate = function(quiet) {
  var self = this;
  self.prepareData();

  var wizard = $("#fuelux-wizard");
  var step = 0;
  if (wizard.length > 0) {
    var step = wizard.data("wizard").selectedItem().step;
  }

  var validateFunctions = {
    "manual-incoming": "validateManualIncoming",
    "manual-outgoing": "validateManualOutgoing",
    "outgoing": "validateOutgoing",
    "review-outgoing": "validateReviewOutgoing",
    "send-outgoing": "validateSendOutgoing",
    "receive-incoming": "validateReceiveIncoming",
    "-": "noop"
  }

  var n = self.formData.operation || "-";
  var f = validateFunctions[n];

  var checkResult = {};
  if (f) {
    checkResult = self[f](step);
  }

  $(".btn-next").prop("disabled", !checkResult.success);
  if (quiet !== false)
    self.highlightErrors(checkResult.errorFields);
}

LetterComposer.prototype.submitManualOutgoing = function() {
  var self = this;
  var formData = self.formData;
  formData.date = new Date(formData.date);

  if (self.formData["recipientManual[id]"] &&
      self.formData["recipientManual[name]"] &&
      self.formData["recipientManual[address]"] &&
      self.formData["recipientManual[organization]"]
     ) {
       self.formData["recipientManual"] = {
         id: self.formData["recipientManual[id]"],
         name: self.formData["recipientManual[name]"],
         address: self.formData["recipientManual[address]"],
         organization: self.formData["recipientManual[organization]"],
       }
       delete(self.formData["recipientManual[id]"]);
       delete(self.formData["recipientManual[name]"]);
       delete(self.formData["recipientManual[address]"]);
       delete(self.formData["recipientManual[organization]"]);
     }

  self.submitForm();
}

LetterComposer.prototype.submitManualIncoming = function() {
  var self = this;
  var formData = self.formData;
  formData.date = new Date(formData.date);
  formData.receivedDate = new Date(formData.receivedDate);

  if (self.formData["senderManual[id]"] &&
      self.formData["senderManual[name]"] &&
      self.formData["senderManual[address]"] &&
      self.formData["senderManual[organization]"]
      ) {
    self.formData["senderManual"] = {
      id: self.formData["senderManual[id]"],
      name: self.formData["senderManual[name]"],
      address: self.formData["senderManual[address]"],
      organization: self.formData["senderManual[organization]"],
    }
    delete(self.formData["senderManual[id]"]);
    delete(self.formData["senderManual[name]"]);
    delete(self.formData["senderManual[address]"]);
    delete(self.formData["senderManual[organization]"]);
  }

  self.submitForm();
}

LetterComposer.prototype.submitOutgoing = function() {
  var self = this;
  var formData = self.formData;
  formData.date = new Date(formData.date);
  self.submitForm();
}

LetterComposer.prototype.submitReviewOutgoing = function() {
  var self = this;
  var formData = self.formData;
  formData.date = new Date(formData.date);
  self.submitForm();
}

LetterComposer.prototype.submitSendOutgoing = function() {
  var self = this;
  var formData = self.formData;
  self.submitForm();
}

LetterComposer.prototype.submitReceiveIncoming = function() {
  var self = this;
  var formData = self.formData;
  self.submitForm();
}

LetterComposer.prototype.highlightErrors = function(fields) {
  $("#error-invalid-fields").addClass("hidden");
  $(".form-error").addClass("hidden");
  $(":input").removeClass("input-has-error");
  if (fields) {
    for (var i = 0; i < fields.length; i ++) {
      var field = fields[i];
      $("[name="+field+"]").addClass("input-has-error");
    }
  }
  $("#error-invalid-fields").removeClass("hidden");
}

var saveDocument = function(ng, cb) {
  ng.getByteArray(function(err, d) {
    var id = $("[name=_id]").val();
    var blob = new Blob([d.buffer], {type: "application/vnd.oasis.opendocument.text"});

    var data = new FormData();
    data.append("_id", id);
    data.append("data", blob);

    $.ajax({
      url: "/letter/content",
      type: "POST",
      contentType: false,
      processData: false,
      data: data
    }).error(function(result) {
      $(".form-error").removeClass("hidden");
      $(".form-content-error").removeClass("hidden");
    }).done(function(result, status) {
      cb();
    });
  });
}

LetterComposer.prototype.saveDocument = function(ng, cb) {
  saveDocument(ng, cb);
}

LetterComposer.saveDocument = function(ng, cb) {
  saveDocument(ng, cb);
}

LetterComposer.prototype.submitForm = function() {
  var self = this;

  var submit = function() {
    $.ajax({
      url: "/letter",
      dataType: "json",
      method: "POST",
      data: self.formData
    }).always(function() {
    }).error(function(result) {
      var obj = result.responseJSON;
      var reason = [
        "<br>Nomor surat sudah pernah digunakan. ",
        "<br>Nomor agenda sudah pernah digunakan. "
      ];
      if (obj && obj.fields) {
        self.highlightErrors(obj.fields);
      }
      obj.message.forEach(function(r){
        console.log(JSON.stringify(r));
        $(".form-error").append(reason[r]);
      })
      $(".form-error").removeClass("hidden");
    }).done(function(result, status) {
      $(".form-success").removeClass("hidden");
      $("#fuelux-wizard").addClass("hidden");
      $(".letter-composer").addClass("hidden");
      $(".wizard-actions").addClass("hidden");

    });
  }

  var odfName = self.$e.attr("data-odf");
  var webodf = $("[name=" + odfName + "]");
  var saveDocumentFirst = false;
  var ng;

  if (webodf && webodf.length > 0) {
    ng = angular.element(webodf).scope();
    if (ng && ng.dirty()) {
      saveDocumentFirst = true;
    }
  }

  if (saveDocumentFirst) {
    self.saveDocument(ng, submit);
  } else {
    submit();
  }
}

LetterComposer.prototype.noop = function() {
}

LetterComposer.prototype.submit = function() {
  var self = this;

  self.prepareData();
  var submitFunctions = {
    "manual-incoming": "submitManualIncoming",
    "manual-outgoing": "submitManualOutgoing",
    "outgoing": "submitOutgoing",
    "review-outgoing": "submitReviewOutgoing",
    "send-outgoing": "submitSendOutgoing",
    "receive-incoming": "submitReceiveIncoming",
    "-": "noop"
  }

  var n = self.formData.operation || "-";
  var f = submitFunctions[n];

  if (f) {
    self[f]();
  }
};

jQuery.fn.LetterComposer = function() {
  var e = $(this);
  e.composer = new LetterComposer(e);
  console.log(e.composer);
}

$(document).ready(function() {
  $(".letter-composer").LetterComposer();
});
