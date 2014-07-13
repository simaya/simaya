module.exports = function(app){

  var say = require("./say")(app);
  var user = require("./user")(app);
  var letter = require("./letter")(app);
  var disposition = require("./disposition")(app);
  var profile = require("./profile")(app);
  var calendar = require("./calendar")(app);
  var notification = require("./notification")(app);
  var contacts = require("./contacts")(app);

  return {
    say : say,
    user : user,
    letter : letter,
    disposition : disposition,
    profile : profile,
    calendar : calendar,
    notification : notification, 
    contacts : contacts
  }
}
