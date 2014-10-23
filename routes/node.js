module.exports = function(app) {
  var node = require("../simaya/controller/node.js")(app)

  app.get("/nodes/sync/request/:id", node.requestSync);
  app.get("/nodes/sync/start/:id", node.startSync);
  app.get("/nodes/sync/check/:id", node.checkSync);
  app.get("/nodes/sync/manifest/:id/:fileId", node.manifestContent);

  app.get("/nodes/check/:id", node.checkNode);
}
