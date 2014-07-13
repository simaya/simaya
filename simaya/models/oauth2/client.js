module.exports = function(app) {
  var db = app.db("oauth2.client");
  
  // dedicated clients
  var clients = {

    // alternate web app
    "1" : {
      id: 1,
      name : "simaya-web",
      title : "Simaya untuk Web",
      description : "Simaya untuk Web",
      redirectUri : "/oauth2/callback", // something like /dedicated/callback
      trusted : true,
      secret : "ayam",
      author : {
        id: "system",
        profile : {
          email : "system@simaya.layanan.go.id"
        }
      }
    },

    // /dialog/authorize?response_type=code&dialog_type=mobile&redirect_uri=%2Foauth%2Fcallback&scope=all&client_id=2
    "2" : {
      id: 2,
      name : "simaya-android",
      title : "Simaya untuk Android",
      description : "Simaya untuk Android",
      redirectUri : "/oauth2/callback",
      trusted : true,
      secret : "ayam",
      author : {
        id: "system",
        profile : {
          email : "system@simaya.layanan.go.id"
        }
      }
    },

    // 
    "3" : {
      id: 3,
      name : "simaya-ios",
      title : "Simaya untuk iOS",
      redirectUri : "/oauth2/callback",
      trusted : true,
      secret : "ayam",
      author : {
        id: "system",
        profile : {
          email : "system@simaya.layanan.go.id"
        }
      }
    },

    "entMx1mC60JRfDbWdvPj" : {
      id : "entMx1mC60JRfDbWdvPj",
      name : "simaya-apigee",
      title : "Simaya untuk apigee",
      redirectUri : "https://apigee.com/oauth_callback/simaya/oauth2CodeCallback",
      trusted : false,
      secret : "vvEFCvDeA7",
      author : {
        id : "system",
        profile : {
          email : "system@simaya.layanan.go.id"
        }
      }
    },

    // WP client
    // 
    // ROOTURL/dialog/authorize?response_type=code&dialog_type=mobile&redirect_uri=%2Foauth%2Fcallback&scope=all&client_id=entMx1mC60JRfDbWdvPj
    "BRqLmovip8Az22" : {
      id : "BRqLmovip8Az22",
      name : "simaya-wp",
      title : "Simaya untuk Windows Phone",
      redirectUri : "/oauth2/callback",
      trusted : true,
      secret : "HHTeUVqebLG3TO",
      author : {
        id : "system",
        profile : {
          email : "system@simaya.layanan.go.id"
        }
      }
    }

  }

  // get client info
  var get = function(id, fn) {

    // toString()
    id = id + "";

    var exists = Object.keys(clients).indexOf(id) >= 0;

    // todo: list client from db

    if (exists) {
      fn (null, clients[id]);  
    } else {
      fn (null, false);
    }
  }

  // set client info or create a new one
  // options should contain `id`
  var set = function(options, fn) {
    // todo: new client registration
  }
  
  return {
    get : get,
    set : set
  }
}
