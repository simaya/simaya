calendarPickerActiveField = null;

CalendarPicker = function(e) {
  var self = this;
  this.e = $(e);
  var maxDate = this.e.attr("data-max-date");
  if (maxDate == "today") {
    maxDate = new Date();
  } else {
    maxDate = new Date(maxDate);
  }
  var format = this.e.attr("data-format") || "yyyy-MM-dd";
  this.w = $(".calendar-picker-widget");
  if (!this.cal) {
    this.w = $("<div>").addClass("calendar-picker-widget");
    this.cal = $("<div>").fullCalendar({
      editable: false,
      header: {
        right: "prev,next"
      },
      dayRender: function(date, cell) {
        if (date > maxDate) {
          $(cell).addClass("disabled");
        }
      },
      dayClick: function(date, allDay, jsEvent, view) {
        if (date > maxDate) {
          return;
        }
        var e = $(calendarPickerActiveField);
        var field;
        var id = self.e.attr("data-id");
        if (id) {
          field = $("#" + id);
        } else {
          var fieldName = self.e.attr("data-field");
          field = $("[name='" + fieldName + "']");
        }
 
        field.val($.fullCalendar.formatDate(date, format));
        field.attr("data-value", date);
        field.change();
        self.w.removeClass("calendar-picker-widget-visible");
      }

    })
    this.w.append(this.cal);
    this.e.after(this.w);
  }
  this.e.unbind();
  this.e.click(function(e) {
    e.preventDefault();
    calendarPickerActiveField = self.e; 
    if (self.w.hasClass("calendar-picker-widget-visible")) {
      self.w.removeClass("calendar-picker-widget-visible");
    } else {
      self.w.addClass("calendar-picker-widget-visible");
      if (self.cal) {
        var field;
        var id = self.e.attr("data-id");
        if (id) {
          field = $("#" + id);
        } else {
          var fieldName = self.e.attr("data-field");
          field = $("[name='" + fieldName + "']");
        }
        self.w.css("left", (field.position().left - 20) + "px");
        var top = field.position().top 
          + field.height() 
          + parseInt(field.css("margin-top")) 
          + parseInt(field.css("margin-bottom"))
          + parseInt(field.css("padding-top")) 
          + parseInt(field.css("padding-bottom"))

        self.w.css("top", top + "px");
        self.cal.fullCalendar("render");
        var fieldDate = new Date(field.val());
        if(isNaN(fieldDate.getTime())){
          fieldDate = new Date();
        }
        self.cal.fullCalendar("gotoDate", fieldDate);
      }
    }
  });
}

jQuery.fn.calendarPicker = function() {
  var items = $(this);
  for (var i = 0; i < items.length; i ++) {
    var item = items[i];
    new CalendarPicker(item);      
  }
}

