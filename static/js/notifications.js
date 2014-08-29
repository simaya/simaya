function showBox() {
  $("#notification-box").css("display", "inherit").css("bottom","50px");
}

function getNotification() {
  $.ajax({
    url: "/notification/list",
  dataType: 'json'
  }).done(function(jsonData) {
    var htmlList = '<li class="nav-header"> \
    <i class="icon-envelope"></i> \
    Notifikasi \
    </li>';
    var unRead = 0;
    var counter = 240;
    var maxHeight = $(window).height();
    jsonData.forEach(function(d){
      if (!d.sender) {
        d.sender = "";
      }
      if (!d.isRead) {
        if (counter < maxHeight) {
          var originalMessage = d.message;
          var message = d.message.substring(0, 50) + ' ...';
          var html = '<li> \
            <a href="/notification/'+ d._id +'"> \
            <img class="nav-user-photo" src="/profile/get-avatar?username=' + d.sender + '" data-username="' + d.sender + '" alt="' + d.sender + '" /> \
            <span class="msg-body"> \
            <span class="resolve-name blue">' + d.sender + '</span> \
            <span class="msg-title"> \
            <span class="notification-message" data-truncate="true" data-value="' + originalMessage + '">' + message + '</span> \
            </span> \
            \
            <span class="msg-time"> \
            <i class="icon-time"></i> \
            <span>'+ d.formattedTime +'</span> \
            </span> \
            </span> \
            </a> \
            </li>';
          htmlList = htmlList + html;
        }
        counter = counter + 240;

        unRead++;
      }
    });
    htmlList = htmlList + '<li> \
               <a href="/notification"> \
               Lihat semua notifikasi\
               <i class="icon-arrow-right"></i> \
               </a> \
               </li>';
    $('#topNotify').html(htmlList);
    $('#unRead').html(unRead);
    $("#topNotify").find(".resolve-name").resolveUserNames();
    $("#topNotify").find(".notification-message").resolveNotificationMessage();
  });
}

function getAlarmData(data, box) {
  var _id = data.calendarId;
  $.ajax({
    url: "/calendar/getAlarmData/" + data.calendarId,
    context: document.body,
    dataType: 'json',
  }).done(function(data) { 
    if (data.length == 1) {
      var id = "alarm" + _id;
      var existing = $("#" + id);
      
      if (existing != null && existing.length > 0) 
        return;

      var entry = $("<div/>", {
        "class": "fade in alert alert-warning",
        "id": id
      });
      var button = $("<button/>", {
        "class": "close",
        "data-dismiss": "alert",
        "text": "×"
      });
      var title = $("<h5/>", {
        "text": data[0].title
      });
      var time = $("<span>", {
        "text": moment(data[0].start).format("HH:mm") + "-" + moment(data[0].end).format("HH:mm")
      });

      var link = $("<a/>", {
        "href": '/calendar/day?date=' + _id,
        "class": 'btn btn-mini',
        "text": 'Lihat acara',
      });

      entry.bind('closed', function() {
        $.ajax({
          url: "/calendar/removeAlarm/" + _id,
          context: document.body,
          dataType: 'json',
        }).done(function(data){
        });
      });

      entry.append(button);
      entry.append(title);
      entry.append(time);
      entry.append(link);

      box.append(entry);
      
      setTimeout(showBox, 50);
    }
  });
}


function getAlarm() {
  $.ajax({
    url: "/calendar/getAlarm",
    context: document.body,
    dataType: 'json',
  }).done(function(data) { 
    var box = $("#notification-box");
    for (var i = 0; i < data.length; i ++) {
      getAlarmData(data[i], box);
    }
    box.css("display", "inherit");
  });
}
 
$(document).ready(function() {
  getNotification();
  getAlarm();
});

