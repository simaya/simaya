module.exports = function(app) {
  var node = require("../simaya/controller/node.js")(app)

  app.get("/nodes/sync/request/:id", node.checkNodeCredentials, node.requestSync);
  app.get("/nodes/sync/start/:id", node.checkNodeCredentials, node.startSync);
  app.get("/nodes/sync/finalize/:id", node.checkNodeCredentials, node.finalizeSync);
  app.get("/nodes/sync/check/:id", node.checkNodeCredentials, node.checkSync);
  app.post("/nodes/sync/stage/:id", node.checkNodeCredentials, node.updateStage);
  app.get("/nodes/sync/manifest/:id/:fileId", node.checkNodeCredentials, node.manifestContent);
  app.post("/nodes/sync/manifest/:id", node.checkNodeCredentials, node.manifestReceiveIndex);
  app.post("/nodes/sync/manifest/:id/:fileId", node.checkNodeCredentials, node.manifestReceiveContent);

  app.get("/nodes/check/:id", node.checkNodeCredentials, node.checkNode);
}
