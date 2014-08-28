
/**
 * Module dependencies.
 */
var settings = require('./settings.js')
var package = require("./package.json");

var sinergisVar = {
  version: package.version,
  appName: 'siMAYA',
  isLocal: settings.simaya.installation == 'local'
}

console.log (sinergisVar);

var express = require('express.io')
  , app = express().http().io()
  , cons = require('consolidate')
  , http = require('http')
  , moment = require('moment')
  , passport = require('passport');
  moment.lang("id")

app.use(function (req, res, next) {
  req.proto = req.headers["x-forwarded-proto"]
  if (req.proto == "http") {
    res.redirect("https://" + req.host + req.originalUrl);
    return;
  }

  req.secure = (req.proto == "https")
  next();
});

app.sidebarSettings = __dirname + '/sidebar-settings.js';

app.db = function(modelName) {
  return settings.model(settings.db, modelName);
}

var ioRoutes = require("./io")(app)
app.validator = settings.validator;

app.store = function(fileId, fileName, mode) {
  return settings.store(settings.db, fileId, fileName, mode);
}

app.simaya = settings.simaya;
app.currentUser = {};
app.currentUserProfile = {};
app.currentUserRoles = {};
app.ObjectID = settings.ObjectID;

// set ref to settings.db from app
app.dbClient = settings.db;

app.configure('development', function(){
  var MemStore = express.session.MemoryStore;

  app.use(express.cookieParser(' default '));
  app.use(express.session({secret:' default ', store: MemStore({
    reapInterval: 60000 * 10
    })
  }));

  app.use(express.errorHandler());
  sinergisVar.version += '-devel';

});

// ugly hack, needs better suggestion on object wrapping
var oauth = require('./simaya/controller/oauth');
var auth = require('./simaya/controller/auth')(app);

// oauth2
var oauth2 = require('./simaya/controller/oauth2/oauth2')(app);
  
var corsHandler = function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-token-next, X-token-key, Content-type");
  res.header("Access-Control-Allow-Credentials", true);
  next();
}

app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.engine('html', cons.hogan);
  app.set('view engine', 'html');
  app.use(express.static(__dirname + '/static'));
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser({keepExtensions: true, uploadDir: __dirname + "/uploads" }))
  app.use(express.methodOverride());
  app.use(corsHandler);
  app.use(express.limit('1gb'));

  // passport for oauth2
  app.use(passport.initialize());

  // auth init
  app.use(auth.authCheck())
  
  // oauth init 
  app.use(oauth.provider.dispatch());
  app.use(oauth.provider.oauth());
  app.use(oauth.provider.filter());

  app.use(app.router);
  app.set('sinergisVar', sinergisVar);
});

// passport config
require('./simaya/controller/oauth2/auth')(app);

var routes = require('./routes')(app)

settings.db.open(function(){
  // db.open() needs to be explicitly called in recent mongodb driver
  console.log('database is '  + (settings.db.serverConfig.isConnected() ? 'connected' : 'not connected'))
  console.log('database name: ', settings.db.databaseName)
  app.listen(app.get('port'), function(){
    console.log("Express server listening on port " + app.get('port'));
  });
})

