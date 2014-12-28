// now is updated by dijit widget or someother widget
var now = new Date();

/// From dojo
var isLeapYear = function(d) {
  var year = dateObject.getFullYear();
  return !(year%400) || (!(year%4) && !!(year%100)); 
}

var daysInMonth = function(d) {
  var month = dateObject.getMonth();
  var days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month == 1 && isLeapYear(d)) { 
    return 29; 
  } 
  return days[month]; 
}

// Gets time table from the webservice
var retrieveTimeTable = function(start, numDays, callback) {
  var parameter = start.getFullYear() + "-" + (start.getMonth() + 1) + "-" + start.getDate();
  parameter += "&num-days=" + numDays;
  $.ajax({
    url: "/calendar/day/list?date=" + parameter, 
    context: document.body,
    dataType: 'json'
  }).done(function(jsondata) {
    callback(jsondata);
  })
 
}

// Returns type of timetable
var getType = function(item) {
  var type = $(item).attr("data-type") || "day";
  return type;
}

// Returns the number of days covered by a certain timetable
var numberOfDays = function(item) {
  var retval = getType(item) == "day" ? 1: 7;
  return retval;
}


// Returns the array of dates of the week/or day
var allDates = function(item) {
  var dates = [];
  var currentDate= $(item).attr("data-current-date") || new Date().toISOString();
  var offset;
  if (getType(item) == "day") {
    offset = 0;
  } else {
    offset = new Date(currentDate).getDay(); 
  }

  var d = new Date(currentDate);
  d.setDate(d.getDate() - offset);

  var numDays = numberOfDays(item);
  for (var i = 0; i < numDays; i ++) {
    dates.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }

  return {
    dates: dates,
    offset: offset,
    numDays: numDays
  }
}

function setupBoxPositionAndWidth(box) {
  var e = $("#" + box.attr("data-timetable"));
  var start = new Date(box.attr("data-start"));
  var startTimeFormatted = formatTime(start);
  var id = "d" + start.getFullYear() + start.getMonth() + start.getDate();
  var target = $("#" + id + "t" + startTimeFormatted);
  box.css("top", target.position().top + $(e).children().scrollTop() + "px");
  box.css("left", target.position().left + "px");
  box.css("width", target.css("width"));
}

var normalizeMinutes = function(m) {
  if (m != 0 && m != 15 && m != 30 && m != 45) {
    if (60 - m < 15) {
      m = 45;
    } else if (45 - m < 15) {
      m = 30;
    } else if (30 - m < 15) {
      m = 15;
    } else { 
      m = 0;
    }
  }
  return m;
}


var formatTime = function(start) {
  var startTimeFormatted = start.getHours() + "";
  if (start.getHours() < 10) {
    var startTimeFormatted = "0" + start.getHours();
  }
  
  var m = normalizeMinutes(start.getMinutes());
  if (m < 10) {
    startTimeFormatted = startTimeFormatted + "0" + m;
  } else {
    startTimeFormatted = startTimeFormatted + m;
  }

  return startTimeFormatted;
}

var cancelAllInvitationButtons = function() {
  $("#edit-event-button-decline").unbind();
  $("#edit-event-button-accept").unbind();
  $("#edit-event-button-cancel").unbind();
}

var connectCancelInvitationButton = function(id) {
  $("#edit-event-button-cancel").click(function(e) {
    e.preventDefault();
    $.ajax({
      url: "/calendar/invitation/cancel/" + id, 
      context: document.body,
      dataType: 'json'
    }).done(function(jsondata) {
      $("#view-event-dialog").modal("hide");
      document.location = pathname; 
    })
  });
}

var connectAcceptInvitationButton = function(id) {
  $("#edit-event-button-accept").click(function(e) {
    e.preventDefault();
    $.ajax({
      url: "/calendar/invitation/accept/" + id, 
      context: document.body,
      dataType: 'json'
    }).done(function(jsondata) {
      $("#view-event-dialog").modal("hide");
      document.location = pathname; 
    })
  });
}

var connectDeclineInvitationButton = function(id) {
  $("#edit-event-button-decline").click(function(e) {
    e.preventDefault();
    $.ajax({
      url: "/calendar/invitation/decline/" + id, 
      context: document.body,
      dataType: 'json'
    }).done(function(jsondata) {
      $("#view-event-dialog").modal("hide");
      document.location = pathname; 
    })
  });
}

var connectRemoveInvitationButton = function(id) {
  $("#add-event-button-remove").click(function(e) {
    e.preventDefault();
    $.ajax({
      url: "/calendar/invitation/remove/" + id, 
      context: document.body,
      dataType: 'json'
    }).done(function(jsondata) {
      $("#add-event-dialog").modal("hide");
      document.location = pathname; 
    })
  });
}

var showInvitation = function(event) {
  console.log(event);
  var user = event["user"];
  $(".selection").addClass("hidden");
  $("#event-view-invitor").text(user);
  var eventId = event["_id"];
  $("#event-view-id").text(eventId);
  $("#event-view-title").text(event["title"]);

  var accepters = {}, decliners = {};
  var a = event["accepters"] || "";
  if (a.length > 0) {
    var r = a;
    for (var i = 0; i < r.length; i ++) {
      accepters[r[i]] = 1;
    }
  }

  var a = event["decliners"] || "";
  if (a.length > 0) {
    var r = a;
    for (var i = 0; i < r.length; i ++) {
      decliners[r[i]] = 1;
    }
  }

  var recipients = event["recipients"] || "";
  if (recipients.length > 0) {
    var r = recipients;
    $("#event-view-recipients-container").removeClass("hidden");
    var target = $("#event-view-recipients");
    target.empty();
    target.attr("values", recipients);
    for (var i = 0; i < r.length; i ++) {
      var s = $("<span>").addClass("resolve-name").text(r[i]); 
      if (accepters[r[i]]) {
        s.addClass("calendar-invitation-accept-text");
      }
      if (decliners[r[i]]) {
        s.addClass("calendar-invitation-decline-text");
      }
      var li = $("<li>").append(s);
      target.append(li);
    }
    $(".resolve-name").resolveUserNames();
  } else {
    $("#event-view-recipients-container").addClass("hidden");
  }
  $("#event-view-start").text(moment(event["start"]).format("dddd, DD MMMM YYYY HH:mm"));
  $("#event-view-end").text(moment(event["end"]).format("dddd, DD MMMM YYYY HH:mm"));
  $("#event-view-reminder-" + event["reminder"]).removeClass("hidden");
  $("#event-view-recurrence-" + event["recurrence"]).removeClass("hidden");
  $("#event-view-visibility-" + event["visibility"]).removeClass("hidden");
  $("#event-view-status-" + event["status"]).removeClass("hidden");
  $("#event-view-description").text(event["description"]);
  var attachments = event["fileAttachments"];
  if (attachments && attachments.length > 0) {
    $("#event-view-attachments-container").removeClass("hidden");
    var holder = $("#event-view-attachments");
    if (holder.children()) {
      holder.children().remove();
    }

    for (var j = 0; j < attachments.length; j ++) {
      var entry = $("<li>");
      var url = $("<a>").attr("href", "/calendar/attachment/" + attachments[j].path);
      url.text(attachments[j].name);
      entry.append(url);
      holder.append(entry);
    }


  } else {
    $("#event-view-attachments-container").addClass("hidden");
  }
  cancelAllInvitationButtons();
  $("#event-close-buttons").addClass("hidden");
  $("#event-accept-decline-buttons").addClass("hidden");
  $("#event-change-buttons").addClass("hidden");
  $("#event-cancel-buttons").addClass("hidden");

  if (currentUser == user) {
    $("#event-change-buttons").removeClass("hidden");
    connectRemoveInvitationButton(eventId);
  } else {
    var confirmed = false;
    if (decliners[currentUser]) {
      confirmed = true;
      $("#event-close-buttons").removeClass("hidden");
    }
    if (accepters[currentUser]) {
      confirmed = true;
      $("#event-cancel-buttons").removeClass("hidden");
      connectCancelInvitationButton(eventId);
    }
    if (!confirmed) {
      $("#event-accept-decline-buttons").removeClass("hidden");
      connectAcceptInvitationButton(eventId);
      connectDeclineInvitationButton(eventId);
    }
  }

  $("#view-event-dialog").modal("show");
}


// Populate time table
// argument is a calendar-timetable
var populateTimeTable = function(e) {

  var dates = allDates(e); 
  var start = new Date(dates.dates[0]);

    if (typeof(timeTablePopulated) === "function") {
      timeTablePopulated();
    }
}

var updateTimeLine = function() {
  var container = $(".calendar-timetable-container");
  var t = new Date();
  container.each(function(i,e) {
    var m = t.getHours();
    var m1 = m + 1;
    if (m < 10) {
      m = "0" + m;
      if (m1 < 10) {
        m1 = "0" + m1;
      }
    } 
    var d = new Date($(e).attr("data-current-date") || new Date().toISOString());
    var id = "d" + d.getFullYear() + d.getMonth() + d.getDate();
    var target = $("#" + id + "t" + m + "00");   
    var targetNext = $("#" + id + "t" + m1 + "00");   
    var line = $(".calendar-timetable-timeline"); 
    if (target.length == 0) {
      line.addClass("hidden");
      return;
    } else {
      line.removeClass("hidden");
    }
    var diff;
    if (targetNext.position() == null) {
      targetNext = $("#eod");
    }
    diff = targetNext.position().top - target.position().top;
    var top = (target.position().top + $(e).parent().scrollTop() + ((diff/60) * t.getMinutes()));
    line.css("top", top + "px");
    $(e).parent().scrollTop(target.position().top);
  });
}

// Creates a time line showing current time
var createTimeLine = function(item) {
  var line = $("<div>").addClass("calendar-timetable-timeline"); 
  item.parent().append(line);
  updateTimeLine();
}

var updateTimeTable = function(item) {
  var dates = allDates(item);
  $(item).find(".calendar-timetable-day-header").each(function(j, cell) {
    var column = $(cell).attr("data-column");
    $(cell).text(moment(dates.dates[parseInt(column)]).format("DD/MM/YYYY")); 
  });
  $(item).find(".calendar-timetable-empty-description-column").each(function(j, cell) {
    var column = $(cell).attr("data-column");
    var row = $(cell).attr("data-row");
    var date = dates.dates[parseInt(column)];
    var newId = "d" + date.getFullYear() + date.getMonth() + date.getDate() + "t" + row;
    $(cell).attr("id", newId);
    $(cell).attr("data-date", date);
  });

  populateTimeTable($(item));
}

// Creates time table
var createTimeTable = function(item) {
  // dateId is an identifier derived from the date
  // set in the data-current-date attribute otherwise 
  // get the current date and use the iso string
  var currentDate= $(item).attr("data-current-date") || new Date().toISOString();

  var table = $("<table>").addClass("calendar-timetable-container");

  var dateId;
  var dates = allDates(item); 
  var start = dates.dates[0]; 

  if (dates.numDays > 1) {
    var head = $("<thead>");
    var headerRow = $("<tr>");
    headerRow.append($("<td>"));
    for (var i = 0; i < dates.numDays; i ++) {
      var weekDate = $("<td>").addClass("calendar-timetable-day-header").attr("data-column", i);
      weekDate.text(moment(dates.dates[i]).format("DD/MM/YYYY")); 
      headerRow.append(weekDate);
    }
    head.append(headerRow);
    table.append(head);
  }
  var tbody = $("<tbody>");
  for (var i = 0;i < 24; i ++) {
    var row0, row15, row30, row45;

    row0 = $("<tr>").addClass("calendar-timetable-row calendar-timetable-firstrow");
    var timeColumn = $("<td>").addClass("calendar-timetable-time-column");
    timeColumn.attr("rowspan", "4");
    var t = i; // FIXME: locale
    if (i < 10) {
      t = "0" + t;
    }
    timeColumn.text(t);
    row0.append(timeColumn)

    for (var j = 0; j < dates.numDays; j ++) {
      var descriptionColumn = $("<td>").addClass("calendar-timetable-empty-description-column");
      // The column now has an id derived from the dateId
      var id = "d" + dates.dates[j].getFullYear() + dates.dates[j].getMonth() + dates.dates[j].getDate();
      descriptionColumn.attr("data-date", dates.dates[j]);
      descriptionColumn.attr("id", id + "t" + t + "00");
      descriptionColumn.attr("data-column", j);
      descriptionColumn.attr("data-row", t + "00");
      descriptionColumn.html("");
      row0.append(descriptionColumn)
    }
  
    row15 = $("<tr>").addClass("calendar-timetable-row");
    for (var j = 0; j < dates.numDays; j ++) {
      var descriptionColumn = $("<td>").addClass("calendar-timetable-empty-description-column");
      // the second row is 30 minutes pass the t
      var id = "d" + dates.dates[j].getFullYear() + dates.dates[j].getMonth() + dates.dates[j].getDate();
      descriptionColumn.attr("data-date", dates.dates[j]);
      descriptionColumn.attr("id", id + "t" + t + "15");
      descriptionColumn.attr("data-column", j);
      descriptionColumn.attr("data-row", t + "15");
      descriptionColumn.html("");
      row15.append(descriptionColumn);
    }

    row30 = $("<tr>").addClass("calendar-timetable-row");
    for (var j = 0; j < dates.numDays; j ++) {
      var descriptionColumn = $("<td>").addClass("calendar-timetable-empty-description-column");
      // the second row is 30 minutes pass the t
      var id = "d" + dates.dates[j].getFullYear() + dates.dates[j].getMonth() + dates.dates[j].getDate();
      descriptionColumn.attr("data-date", dates.dates[j]);
      descriptionColumn.attr("id", id + "t" + t + "30");
      descriptionColumn.attr("data-column", j);
      descriptionColumn.attr("data-row", t + "30");
      descriptionColumn.html("");
      row30.append(descriptionColumn);
    }

    row45 = $("<tr>").addClass("calendar-timetable-row");
    for (var j = 0; j < dates.numDays; j ++) {
      var descriptionColumn = $("<td>").addClass("calendar-timetable-empty-description-column");
      // the second row is 30 minutes pass the t
      var id = "d" + dates.dates[j].getFullYear() + dates.dates[j].getMonth() + dates.dates[j].getDate();
      descriptionColumn.attr("data-date", dates.dates[j]);
      descriptionColumn.attr("id", id + "t" + t + "45");
      descriptionColumn.attr("data-column", j);
      descriptionColumn.attr("data-row", t + "45");
      descriptionColumn.html("");
      row45.append(descriptionColumn);
    }

    tbody.append(row0)
    tbody.append(row15)
    tbody.append(row30)
    tbody.append(row45)
  }
  table.append(tbody);
  var end = $("<div>").addClass("").attr("id", "eod");

  var wrapper = $("<div>").addClass("calendar-timetable-wrapper");
  $(wrapper).append(table);
  table.parent().append(end);
  $(item).append(wrapper);
  populateTimeTable(item);
  createTimeLine(table);

  $(".calendar-timetable-empty-description-column").unbind();
  $(".calendar-timetable-empty-description-column").click(function() {
    var target = this;
    now = new Date($(target).attr("data-date"));
    $("#dialog-event-date-text").text(moment(now).format("dddd, DD/MM/YYYY"));
    $("#add-event-dialog").modal("show");
    var id = $(target).attr("id");
    var times = id.split("t");
    $("#start-time").val(times[1])
    var hour = times[1][0] + times[1][1];
    var endTime = (parseInt(hour) + 1) + times[1][2] + times[1][3];
    if ((parseInt(hour) + 1) < 10) {
      endTime = "0" + endTime;
    }
    $("#end-time").val(endTime);
  });
}

// Creates time table
var createTimeTableList = function(item) {
  var startDate = $("#" + $(item).attr("start")).val();
  var endDate = $("#" + $(item).attr("end")).val();

  if (startDate && endDate) {
    var start = new Date(moment(startDate,"DD/MM/YYYY").toDate());
    var end  = new Date(moment(endDate,"DD/MM/YYYY").toDate());
    var span = ((end-start)/1000/60/60/24 + 1);

    if (span > 0) {
      retrieveTimeTable(start, span, function(dayEvents) {
        var body = $(item).find("tbody");
        body.children(".entries").remove();
        if (dayEvents.length == 0) {
          body.children(".no-entries").removeClass("hidden");
        } else {
          body.children(".no-entries").addClass("hidden");
        }

        for (var i = 0; i < dayEvents.length; i ++) {
          var row = body.find(".template").clone();;

          var cell = $(row.children("td")[0]); 
          cell.text(dayEvents[i].title);

          var cell = $(row.children("td")[1]); 
          cell.text(dayEvents[i].location);

          var cell = $(row.children("td")[2]); 
          var status = dayEvents[i].status;
          cell.find("[data-type="+status+"]").removeClass("hidden");

          var cell = $(row.children("td")[3]); 
          cell.text(moment(dayEvents[i].start).format("dddd, DD/MM/YYYY HH:mm"));

          var cell = $(row.children("td")[4]); 
          cell.text(moment(dayEvents[i].end).format("dddd, DD/MM/YYYY HH:mm"));

          row.removeClass("hidden").removeClass("template").addClass("entries");
          body.append(row);
        }
      })
    }
  }
}

var dataSource = function(start, end, callback) {
  var numDays = Math.round((end-start)/(60*24*24)/1000);
  retrieveTimeTable(start, numDays, function(dayEvents) {
    for (var i =0; i < dayEvents.length; i ++) {
      dayEvents[i].start = new Date(dayEvents[i].start);
      dayEvents[i].end = new Date(dayEvents[i].end);
    }
    callback(dayEvents);
  })
}

jQuery.fn.timeTable = function() {
  var items = $(this);
  for (var i = 0; i < items.length; i ++) {
    var item = $(items[i]);
    item.fullCalendar({
      header: {
        right: "prev, next",
      },
      editable: false,
      defaultView: item.attr("data-type"),
      allDayDefault: false,
      events: dataSource,
      ignoreTimeZone: false,
      dayClick: function(date, allDay, jsEvent, view) {
        var target = this;
        var now = date;
        var end = new Date(date);
        end.setHours(end.getHours() + 1);
        $("#dialog-event-date-text").text(moment(now).format("dddd, DD/MM/YYYY"));
        $("#add-event-dialog").modal("show");
        $("#edit-event-title").addClass("hidden");
        $("#add-event-title").removeClass("hidden");
        $("#confirm-remove").addClass("hidden");

        var startDate = moment(now).format("DD/MM/YYYY");
        var startTime = moment(now).format("HHmm");
        $("#start-date").val(startDate)
        $("#start-time").val(startTime)

        var endDate = moment(end).format("DD/MM/YYYY");
        var endTime = moment(end).format("HHmm");
        $("#end-date").val(endDate)
        $("#end-time").val(endTime)
      },
      eventClick: function(event, jsEvent, view) {
        showInvitation(event);
      },
    });
    var invitationStartDate = item.attr("data-invitation-date");
    var invitationId = item.attr("data-invitation-id");
    if (invitationStartDate && invitationId) {
      var start = new Date(invitationStartDate);
      item.fullCalendar("gotoDate", start);
      retrieveTimeTable(start, 1, function(dayEvents) {
        var e = null;
        for (var i =0; i < dayEvents.length; i ++) {
          if (invitationId == dayEvents[i]._id) {
            dayEvents[i].start = new Date(dayEvents[i].start);
            dayEvents[i].end = new Date(dayEvents[i].end);
            e = dayEvents[i];
            break;
          }
        }
        if (e) {
          showInvitation(e);
        }
      });
    }
  };
}

jQuery.fn.updateTimeTable = function() {
  var items = $(this);
  for (var i = 0; i < items.length; i ++) {
    var item = items[i];
    updateTimeTable(item);
  };
}

jQuery.fn.timePicker = function() {

  var items = $(this);
  var mins = ["00", "15", "30", "45"];
  for (var i = 0; i < items.length; i ++) {
    var item = items[i];
    for (var j = 0; j < 24; j ++) {
      var t = j;
      if (j < 10) {
        t = "0" + j;
      }
      for (var k = 0; k < mins.length; k ++) {
        var entry = $("<option>").text(t + ":" + mins[k]).val(t + mins[k]);
        $(item).append(entry);
      }
    }
  };
}

jQuery.fn.timeTableList = function() {
  var items = $(this);
  for (var i = 0; i < items.length; i ++) {
    var item = items[i];
    createTimeTableList(item);
  };
}

$(document).ready(function() {
  moment.lang("id"); 
  $(".calendar-timetable").timeTable();
  $(".calendar-timetable-list").timeTableList();
  $(".calendar-todays-date").text(moment().format("dddd, DD/MM/YYYY"));
  $(".calendar-timepicker").timePicker();
});


