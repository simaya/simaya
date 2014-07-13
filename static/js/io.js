/*
 * Communication bus, using socket.io
 */
var bus = io.connect();
// Keep online contacts here
// It is initialized by static/js/contacts.js
// and updated by the signal from the socket
bus.contacts = {};
bus.emit('ready');

// Emitted when a person's presence status has changed
//
// User is 'online' when ready signal is obtained
// and 'going-offline' when got disconnected
// The presence status is then changed to offline
// e.g. removed from bus.contacts when the timer expires
bus.on("presence-status", function(message) {
  var user = message.user;
  if (message.status == "online") {
    bus.contacts[user] = bus.contacts[user] || {};
    bus.contacts[user].state = "online";
    console.log("User " + user + " is online"); 
  } else if (message.status == "going-offline") {
    bus.contacts[user] = bus.contacts[user] || {};
    bus.contacts[user].state = "going-offline";
    setTimeout(function() {
      if (bus.contacts[user] && 
        bus.contacts[user].state == "going-offline") {
        console.log("User " + user + " is offline"); 
        delete(bus.contacts[user]);
      }
      // Keep state for 30 seconds
    }, 15000);
  }
});

bus.on("private-message", function(message) {
  if (message.message == "notification") {
    getNotification();
  }
  if (message.message == "alarm") {
    getAlarm();
  }
});

bus.on("timeline", function(message) {
  if (timeline) {
    if (message.id) {
      timeline.reRenderTimeline(message.id);
    }
  }
})
