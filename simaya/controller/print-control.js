module.exports = function(app) {
  var model = require("../models/print-control.js")(app);
  var letter = require("../models/letter.js")(app);

  var view = function(req, res) {
    console.log(this);
    var me = req.session.currentUser;

    model.view({id: req.params.id}, function(err, result) {
      if (err) return res.send(500);
      if (!result) return res.send(404);
      var url;
      if (result.type == "content") {
        url = "/letter/read/" + result.id;
      } else if (result.type = "attachment" && result.extra && result.extra.letterId) {
        letter.openLetter(result.extra.letterId, me, {}, function(err, result) {
          if (err != null && result != null && result.length == 1) {
            url = "/letter/view-pdf-stub/" + result.extra.letterId + "/" + result.id;
          }
        })
      }

      if (url) {
        res.redirect(url);
      } else {
        res.send(400);
      }
    });
  }

  return {
    view: view
  }
}
