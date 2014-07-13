module.exports = function(app) {
  var user = app.db('user');

  var convertClass = function(data) {
    if (typeof(data) === "undefined") {
      return undefined;
    }
    var c = parseInt(data);
    var code = data.replace(""+c, ""); 
    var converted = c;

    switch(c) {
      case 1:
        converted = "I";
        break;
      case 2:
        converted = "II";
        break;
      case 3:
        converted = "III";
        break;
      case 4:
        converted = "IV";
        break;
      case 5:
        converted = "V";
        break;
      case 6:
        converted = "VI";
        break;
    }
    return converted + "/" + code;
  }

  var resolveUsers = function(users, callback) {
    if (!users) {
      callback([]);
      return;
    }
    var search = {
      username: {$in: users}
    }

    user.findArray(search, function(e, result) {
      var returnValue = [];

      var data = {};
      if  (result) {
        for (var i = 0; i < result.length; i++) {
          if (result[i].profile &&
            result[i].profile.fullName &&
            result[i].profile.title) {
            data[result[i].username] = {
                name: result[i].profile.fullName,
                title: result[i].profile.title,
                organization: result[i].profile.organization || 'tidak ada data',
                'class': convertClass(result[i].profile.class) || 'tidak ada data',
                username: result[i].username,
            }
          } else {
            data[result[i].username] = {
                name: result[i].username,
                title: result[i].username,
                username: result[i].username,
                'class': '(golongan tidak diketahui)', 
                organization: '(tidak ada instansi)', 
            }
          }
        }
      }

      for (var i = 0; i < users.length; i ++) {
        if (typeof(data[users[i]]) !== "undefined") {
          returnValue.push(data[users[i]]);
        }
      }
      callback(returnValue);
    });
  }
  return {
    resolveUsers: resolveUsers,
    convertClass: convertClass,
  }
}
