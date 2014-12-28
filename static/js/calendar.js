var pathname = $(location).attr("pathname");
var setupNewEvents = function() {
  $("#add-event-dialog").bind("show", function() {
    $(".delete-confirm-buttons").addClass("hidden");
    $(".event-buttons").removeClass("hidden");
    $(".alert").addClass("hidden");
    $("[name=id]").val("");
    $("[name=title]").val("");
    $("[name=reminder]").val("0");
    $("[name=status]").val("0");
    $("[name=recurrence]").val("0");
    $("[name=visibility]").val("0");
    $("[name=description]").val("");
    $("#start-date").val("");
    $("#end-date").val("");
    $("#start-time").val("");
    $("#end-time").val("");
  })
  $("#confirm-remove").click(function() {
    $(".event-buttons").addClass("hidden");
    $(".delete-confirm-buttons").removeClass("hidden");
    $("#confirm-remove").addClass("hidden");
  });
  $("#confirm-dismiss").click(function() {
    $(".delete-confirm-buttons").addClass("hidden");
    $(".event-buttons").removeClass("hidden");
    $("#confirm-remove").removeClass("hidden");
  });
  $("#edit-event-button-ok").click(function() {
    $("#add-event-dialog").modal("show");
    $("#view-event-dialog").modal("hide");
    $("#add-event-title").addClass("hidden");
    $("#edit-event-title").removeClass("hidden");
    $("#confirm-remove").removeClass("hidden");

    var e = $(".calendar-timetable").fullCalendar("clientEvents", $("#event-view-id").text());
    $("[name=id]").val($("#event-view-id").text());
    $("[name=title]").val($("#event-view-title").text());
    $("[name=recipients]").val(e[0].recipients.join(","));
    var editors = $(".recipient-editor");
    for (var i = 0; i < editors.length; i ++) {
      var item = editors[i];
      recipientEditor.reset(item);
    };

    var startTime = moment(e[0].start).format("HHmm");
    var endTime = moment(e[0].end).format("HHmm");
    var startDate = moment(e[0].start).format("DD/MM/YYYY");
    var endDate = moment(e[0].end).format("DD/MM/YYYY");

    $("#start-date").val(startDate);
    $("#end-date").val(endDate);
    $("#start-time").val(startTime);
    $("#end-time").val(endTime);

    var reminder = $("#event-view-reminder-0").parent().children().not(".hidden").attr("data-value");
    $("[name=reminder]").val(reminder);
    var status = $("#event-view-status-0").parent().children().not(".hidden").attr("data-value");
    $("[name=status]").val(status);
    var recurrence = $("#event-view-recurrence-0").parent().children().not(".hidden").attr("data-value");
    $("[name=recurrence]").val(recurrence);
    var visibility = $("#event-view-visibility-0").parent().children().not(".hidden").attr("data-value");
    $("[name=visibility]").val(visibility);
    $("[name=description]").val($("#event-view-description").text());
  })
  $(".alert").addClass("hidden");
  $("#new-event").click(function(e) {
    e.preventDefault();
    $("#dialog-event-date-text").text(moment(now).format("dddd, DD/MM/YYYY"));
    $("#add-event-dialog").modal("show");
    $("#edit-event-title").addClass("hidden");
    $("#add-event-title").removeClass("hidden");
    $("#confirm-remove").addClass("hidden");
  });
  $("#add-event-button-ok").click(function(e) {
    e.preventDefault();

    $('#form').upload("/calendar/new", function(result) {
      needPost = false;
      console.log(result)
      result = JSON.parse(result);
      if (result.status == "OK") {
        document.location = pathname; 
      } else {
        $(".error-message").addClass("hidden");
        $(".alert").removeClass("hidden");
        $("#error-" + result.error).removeClass("hidden");
      }
    });
  })
}

// Gets dates with events from the webservice
var retrieveEventsInMonth = function(callback) {
  var parameter = now.getFullYear() + "-" + (now.getMonth() + 1 < 10 ? "0" : "") + (now.getMonth() + 1) + "-" + (now.getDate() < 10 ? "0" : "") + now.getDate();
  $.ajax({
    url: "/calendar/dates-in-month?date=" + parameter, 
    context: document.body,
    dataType: 'json'
  }).done(function(jsondata) {
    callback(jsondata);
  })
 
}

var setupCalendar = function(selector) {
  // called when the dijit is ready
  var dates = $(".dijitCalendarEnabledDate");
  var todaysDate = now.getDate(); // now is in widgets/calendar.js
  
  // Mark holidays
  $(".dijitCalendarEnabledDate").attr("id",""); // reset all dates
  $("#"+selector).find(dates).each(function(i, e) {
    if (i % 7 == 6 || i % 7 == 0) {
      $(e).addClass("calendar-date-holidays");
    }
    var date = $(e).children("span").text(); 
    if ($(e).hasClass("dijitCalendarCurrentMonth")) {
      $(e).attr("id", selector + "-date-" + date);
    }
  });

  //Populates events
  retrieveEventsInMonth(function(data) {
    $(".calendar-date-with-events").removeClass("calendar-date-with-events");
    for (var i = 0; i < data.length; i ++) {
      $("#"+selector + "-date-" + data[i]).addClass("calendar-date-with-events");
      $("#"+selector + "-date-" + data[i]).children("span").addClass("calendar-date-with-events-text");
    }
  });

}

var loadDialogs = function() {
  $.ajax({
    url: "/js/templates/calendar.html",
    context: document.body,
    dataType: 'html'
  }).done(function(data) {
    $("#calendar-dialogs").html(data);
    $(".calendar-picker").calendarPicker();
    setupNewEvents();
    $(".calendar-timepicker").timePicker();
    $(".name-chooser").nameChooser();
  })
}

var updateCalendarTimeTableList = function() {
  $(".calendar-timetable-list").timeTableList();
}

var updateCalendarDay = function(value) {
  $(".calendar-timetable").attr("data-current-date", value.toISOString());
  $(".calendar-timetable").updateTimeTable();
  $(".calendar-todays-date").text(moment(value).format("dddd, DD/MM/YYYY"));
  setupCalendar("cal-month");
}

$(document).ready(function() {
  loadDialogs();
});

