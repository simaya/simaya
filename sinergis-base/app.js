
/**
 * Module dependencies.
 */
var settings = require('./settings.js')

var sinergisVar = {
  version: '0.1',
  appName: 'Sinergis'
}

var express = require('express')
  , app = express()
  , cons = require('consolidate')
  , http = require('http');

app.sidebarSettings = __dirname + '/sidebar-settings.js';
app.db = function(modelName) {
  return settings.model(settings.db, modelName);
}

app.validator = settings.validator;

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

app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.engine('html', cons.hogan);
  app.set('view engine', 'html');
  app.use(express.static(__dirname + '/public'));
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.set('sinergisVar', sinergisVar);
});

var routes = require('./routes')(app)
http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});
