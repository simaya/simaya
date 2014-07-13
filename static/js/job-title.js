var jobTitle = function() {
  var organization = "";

  var update = function() {
    var url;
    if(organization){
        url = "/titleInOrganization/listTitles/" + organization;
    }else{
        url = "/titleInOrganization/listMyTitles";
    }

    $.ajax({
      url: url, 
      context: document.body,
      dataType: 'json'
    }).done(function(jsondata) {
      var p = $("#list-title-data")
      p.empty();
      if (jsondata.length > 0) {
        jsondata.forEach(function(item) {
          var start = 0;
          var numSpan = "⊢";
          while (true) {
            var i = item.path.indexOf(';', start);
            if (i == -1)
              break;

            numSpan = numSpan + "―";
            start = i + 1;
          }

          var selected = (p.attr("data-value") == item.title)
          var o = $("<option>")
                    .val(item.title)
                    .text(numSpan + " " + item.title)
                    .attr("selected", selected)
          p.append(o);
        })
      }
      p.trigger("list:updated");
    })
  }

  $("#organization-list").change(function() {
    organization = $("#organization-list").val();
    update();
  });

  return {
    update: update
  }
}()

var setDefault = function(){
  if (window.location.href.indexOf('new-user') == -1) return;
  var opt = $("option[value='5']");
  if (opt && opt.length > 0) {
     opt.attr("selected", true);
  }
}

$(document).ready(function() {
  $("#organization-list").change();
  jobTitle.update();
  setDefault();
});
