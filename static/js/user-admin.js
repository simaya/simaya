function updateInputVisibility(e) {
  var isPolitical = ($(e).attr("data-type") === "political");
  if (isPolitical) {
    $("#nip-input").val("000000000000000000");
    $("#nip-control").addClass("hidden");
    $("#class-input").val("0");
    $("#class").addClass("hidden");
  } else {
    $("#nip-input").val("");
    $("#nip-control").removeClass("hidden");
    $("#class-input").val("");
    $("#class").removeClass("hidden");
  }
}
$(document).ready(function() {
  var needPost = false;

  $("input").change(function(){
    needPost = true;
  });

  $("select").change(function(){
    needPost = true;
  });

  $("[class*=\"usertab\"]").find("a").click(function(e) {
    var event = e || window.event;
    var link = $(this);
    if (needPost == true) {
      event.preventDefault();
      var form = $("[class*=\"userform\"]");
      var inputs = form.find("input");
      var selects = form.find("select");

      var data = {};
      var converted = {};
      var convertedData = {};

      for (var i = 0; i < inputs.length; i ++) {
        var e = $(inputs[i]);
        var name = e.attr("name");
        // converts recurring inputs into arrays
        if (data[name]) {
          // There is data[name] so we must convert it into
          // data["name[]"]
          var oldName = name;
          name = name + "[]";
          // push the contents into convertedData["name[]"]
          convertedData[name] = [ data[oldName] ];
          delete data[oldName];
          // Record the mapping between oldName and name
          converted[oldName] = name;
        } else if (converted[name]) {
          // get the name from the converted map, if any
          name = converted[name];
        }

        // Now we either concatenate the values in convertedData
        // or just insert it into data[name]
        if (e.attr("type") == "checkbox" &&
            e.prop("checked")) {
          if (convertedData[name]) {
            convertedData[name].push(e.val());
          } else {
            data[name] = e.val();
          }
        } else if (e.attr("name") && e.attr("value")) {
          if (e.attr("type") != "checkbox") {
            if (convertedData[name]) {
              convertedData[name].push(e.val());
            } else {
              data[name] = e.val();
            }
          }
        }
      }
      for (var i = 0; i < selects.length; i ++) {
        var e = $(selects[i]);
        if (e.attr("name") && e.val()) {
          data[e.attr("name")] = e.val();
        }
      }
      if (convertedData) {
        Object.keys(convertedData).forEach(function(x) {
          data[x] = convertedData[x];
        });
      }

      $.post(form.attr("action"), data, function(result) {
        needPost = false;
        document.location = link.attr("href");
      });
    }
  });
  $("#echelon-input").change(function(){
    $("select[id='echelon-input'] option:selected").each(function(){
      updateInputVisibility(this);
    });
  });

});

