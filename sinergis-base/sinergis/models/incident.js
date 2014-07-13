module.exports = function(app) {
  // Private 
  var db = app.db('incident');

  var severity = {
    Low: 0,
    Medium: 1,
    High: 2
  };

  var category = {
    InvalidAuthentication: 0,
    InvalidAuthorization: 1,
    MovingUser: 2,
    InactiveUserTryLogin: 3,
    TryMultipleLogin: 4,
  };

  // Public API
  return {
    // Log an incident 
    // Returns a callback
    //    error: database error if any
    log: function (user, password, severity, category, description, callback) {
      var error;
      var date; 
      callback (error);
    },

    // list incident 
    // with optional search object parameter
    //    user: username
    //    position: position to search
    //    severity: severity
    //    category: category
    //    date: date
    // Returns a callback
    //    error: database error if any
    //    result: array of object of
    //      date: date and time
    //      ip: ip address
    //      lon: longitude
    //      lat: latitude
    //      username: username generating the incident
    //      severity: the severity of the incident
    //      category: the category of the incident
    //      description: the description about the incident
    list: function () {
      var error;
      var search = {};
      var callback = null;
      var result = [];

      if (arguments.length == 2) {
        search = arguments[0];
        callback = arguments[1];
      } else {
        callback = arguments[0];
      }

      callback (error, result);
    },

  }
}
