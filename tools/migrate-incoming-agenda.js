var utils = require(__dirname + "/../helper/utils");
var db = utils.app.db("letter")

var spinner = ["/", "-", "|", "\\"];
var saved = 0;
var mod = function(index, data) {
  if (index == data.length) {
    console.log("Saved: ", saved, "of total", data.length);
    process.exit();
    return;
  }

  db.findOne({_id: data[index]._id}, function(e, item) {
    process.stdout.write(spinner[(index % 4)] + " -> " + index + "/" + data.length + "\r");
    var save = false;
    if (item.incomingAgenda && item.receivingOrganizations) {
      for (var o in item.receivingOrganizations) {
        if (item.receivingOrganizations[o].status == 6) {
          item.receivingOrganizations[o].agenda = item.incomingAgenda;
          save = true;
        }
      }
    }

    if (save) {
      saved ++;
      db.save(item, function() {
        mod(index + 1, data);
      });
    } else {
      mod(index + 1, data);
    }
  });
}

console.log("Standing by...");
utils.db.open(function(){
  db.findArray({status: {$ne: 1}}, {_id:1,incomingAgenda:1,receivingOrganizations:1}, function(e, c) {
    mod(0, c);
  })
});


