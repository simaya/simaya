module.exports = function(app) {
  var node = require("../simaya/controller/node.js")(app)

  app.get("/nodes/sync/request/:id", node.requestSync);
  app.get("/nodes/sync/start/:id", node.startSync);
  app.get("/nodes/sync/check/:id", node.checkSync);
  app.post("/nodes/sync/stage/:id", node.updateStage);
  app.get("/nodes/sync/manifest/:id/:fileId", node.manifestContent);
  app.post("/nodes/sync/manifest/:id", node.manifestReceiveIndex);
  app.post("/nodes/sync/manifest/:id/:fileId", node.manifestReceiveContent);

  app.get("/nodes/check/:id", node.checkNode);
}
