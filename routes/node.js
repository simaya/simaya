module.exports = function(app) {
  var node = require("../simaya/controller/node.js")(app)

  app.get("/nodes/sync/request/:id", node.requestSync);
  app.get("/nodes/sync/start/:id", node.startSync);
}
