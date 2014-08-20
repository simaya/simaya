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
  $(".btn-next").prop("disabled", true);
};

LetterComposer.prototype.prepareData = function() {
  var self = this;
  var elements = self.$e.find(":input");

  elements.each(function(index, item) {
    var $item = $(item);
    if ($item.attr("data-value")) {
      self.formData[$item.attr("name")] = $item.attr("data-value");    
    } else {
      self.formData[$item.attr("name")] = $item.val();    
    }
  });
}

LetterComposer.prototype.validateManualIncoming = function(step) {
  var self = this;
  var allFields = [
    ["date", "receivedDate", "mailId", "incomingAgenda"],
    ["recipient", "title", "priority", "classification"],
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

  if (self.formData.receivedDate) {
    if (isNaN(new Date(self.formData.receivedDate).valueOf())) {
      errorFields.push("receivedDate");
      ok = false;
    }
  }

  if (!self.formData.sender && !self.formData.senderManual) {
    errorFields.push("sender");
    errorFields.push("senderManual");
    ok = false;
  }
  self.highlightErrors(errorFields);
  return ok;
}

LetterComposer.prototype.validate = function() {
  var self = this;
  self.prepareData();

  var wizard = $("#fuelux-wizard");
  var step = wizard.data("wizard").selectedItem().step;

  var validateFunctions = {
    "manual-incoming": "validateManualIncoming",
    "-": "noop" 
  }

  var n = self.formData.operation || "-";
  var f = validateFunctions[n];

  var valid = false;
  if (f) {
    valid = self[f](step);
  }

  $(".btn-next").prop("disabled", !valid);
}

LetterComposer.prototype.submitManualIncoming = function() {
  var self = this;
  var formData = self.formData;
  formData.date = new Date(formData.date);
  formData.receivedDate = new Date(formData.receivedDate);
  self.submitForm();
}

LetterComposer.prototype.highlightErrors = function(fields) {
  $("#error-invalid-fields").addClass("hidden");
  $(".form-error").addClass("hidden");
  $(":input").removeClass("input-has-error");
  for (var i = 0; i < fields.length; i ++) {
    var field = fields[i];
    $("[name="+field+"]").addClass("input-has-error");
  }
  $("#error-invalid-fields").removeClass("hidden");
}

LetterComposer.prototype.submitForm = function() {
  var self = this;

  $.ajax({
    url: "/letter",
    dataType: "json",
    method: "POST",
    data: self.formData
  }).always(function() {
  }).error(function(result) {
    $(".form-error").removeClass("hidden");
    var obj = result.responseJSON;
    if (obj && obj.fields) {
      highlightErrors(obj.fields);
    }
  }).done(function(result, status) {
    $(".form-success").removeClass("hidden");
    $("#fuelux-wizard").addClass("hidden");
    $("#manualIncomingLetter").addClass("hidden");
    $(".wizard-actions").addClass("hidden");
    
  });
}

LetterComposer.prototype.noop = function() {
}

LetterComposer.prototype.submit = function() {
  var self = this;
  self.prepareData();
  var submitFunctions = {
    "manual-incoming": "submitManualIncoming",
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
