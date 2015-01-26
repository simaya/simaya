// deprecated by name-chooser.js
var shownEditors = {};
var editors = {};
var echelons = {};

var recipientEditor = function() {

  var sortEchelon = function(a,b) {
    return (echelons[b]-echelons[a]);
  }

  var sortValues = function(data) {
    var v = data.split(",");
    v.sort(sortEchelon);
    var sorted = ""
    for (var i = 0; i < v.length; i++) {
      if (i == 0) {
        sorted = v[i];
      } else {
        sorted = sorted + "," + v[i];
      }
    }
    return sorted;
  }

  var resetValues = function(data, config) {
    var dataHolder = $("#" + data);
    var v = dataHolder.attr("value").split(",");
 
    if (config.add) {
      v.push(config.add);
    }
    var reset = "";
    var cache = {};
    for (var i = 0;i < v.length; i++) {
      if (v[i].length == 0)
        continue;
      if (cache[v[i]] == 1)
        continue;
      if (config.remove && v[i] == config.remove) {
        continue;
      }

      if (reset != "") {
        reset = reset + "," + v[i];
      } else {
        reset = v[i];
      }
      cache[v[i]] = 1;
    }
    reset = sortValues(reset);
    dataHolder.attr("value", reset);

    return reset;
  }

  var listNames = function(c, names) {
    var id = $(c).attr("data-recipient");
    var count = $(c).attr("data-count");
    var data = $("#" + id).attr("data-data");
    var place = $("#" + $("#" + id).attr("data-placeholder"));
    place.empty();

    if (names == null || names == "") {
      // Suggested to be removed because of aestethic point of view, but keeping this around if there will be a dispute
      // place.append($("<span>").addClass("label label-important").text("Belum ada data"));
      return;
    }

    $.ajax({
      url: "/letter/getNames/" + names,
      context: document.body,
      dataType: 'json'
    }).done(function(jsondata) {
      var editorId = $(c).attr("id");
      editors[editorId] = 0; 
      jsondata.forEach(function(item) {
        editors[editorId] = editors[editorId] + 1; 
        if (count == "single") {
          $(c).hide();
        }

        var org = item.organization.split(";");

        place.append($("<span/>")
             .addClass("orgName")
             .attr("data-toggle", "tooltip")
             .attr("title", item.name + " (" + (item.deputyActive ? "PLH " : "") + item.title + ") → " + item.organization.split(";").reverse().join(", "))
             .html('<span class=""><b>' + item.name + '</b></span><br/><span class="">' + 
              (item.deputyActive ? 'PLH ' : '') + item.title + ', ' + org[org.length - 1] + '</span>'))
             .append($("<a/>")
                      .attr("href", "#")
                      .attr("id", "reset-button")
                      .text("×")
                      .addClass("close")
                      .click(function(e) {
                        e.preventDefault();
                        var reset = resetValues(data, {remove: item.username});
                        listNames(c, reset);
                        if (count == "single") {
                          $(c).show();
                        }
                        editors[editorId] = editors[editorId] - 1; 
                        if (editors[editorId] <= 0) {
                          var alt = $(c).attr("data-alternative");
                          $("#" + alt).show();
                          
                        }
                        $("#"+data).trigger('change');
                      }))
             .append($("<br>"));
      });

      $('.orgName').tooltip({ placement : 'right'});

      place.append($("<br>"))
    });
    
  }

  var reset = function(c) {
    var id = $(c).attr("data-recipient");
    var data = $("#" + id).attr("data-data");

    var reset = resetValues(data, {});
    listNames(c, reset);
  }
 
  var show = function(c) {

    var id = $(c).attr("data-recipient");
    var type = $(c).attr("data-type");
    var scope = $(c).attr("data-scope");
    var letterId = $(c).attr("data-letter-id");
    var data = $("#" + id).attr("data-data");
    if (shownEditors[id] == 1) {
      return;
    }

    var place = $("#" + $(c).attr("data-recipient"));
    var alt = $(c).attr("data-alternative");
    $("#" + alt).hide();
    
    var entry = $("<div>");
    var list = $("<select/>").attr("data-role", "user-list").css("margin-top", "10px").hide();

    var button = $("<button>")
                    .addClass("btn btn-success btn-mini")
                    .text("Masukkan")
                    .hide()
                    .click(function(e) {
                      e.preventDefault();
                      var value = list.val();
                      var reset = resetValues(data, {add: value});
                      listNames(c, reset);
                      delete shownEditors[id];
                      entry.remove();
                      $(c).show();
                      $("#"+data).trigger('change');
                    });

    var showOrgList = false;
    if ((type == "recipient" || type == "cc" || type == "calendar") 
        && (scope == "normal")) {
      showOrgList = true;
    }
    else if (scope == "external") {
      if (type == "cc" || type == "sender"){
        showOrgList = true;
      }
    }

    if (showOrgList) {
      var orgList = $("<select/>").css("margin-top", "10px");
      var warning = $("<span>")
                    .addClass("label label-warning")
                    .text("Tidak ada yang bisa dipilih")
                    .hide();

      var opt = $("<option>")
                .attr("value", "")
                .text("Silakan pilih instansi tujuan")
      orgList.append(opt);
 
      $.ajax({
        url: "/findOrg?onlyFirstLevel=1",
        context: entry, 
        dataType: 'json'
      }).done(function(data) {
        $(this).find("i").remove();
        data.forEach(function(item) {
          p = item.path;
          var start = 0;
          var opt = $("<option>")
                      .attr("value", item.path)
                      .text(item.name)

          orgList.append(opt);
        });
        orgList.css("width","500px");
        orgList.chosen({search_contains: true});
      });

      orgList.change(function() {
        if ($(this).val() == "") {
          return
        }
        entry.find('[data-role="org-placeholder"]').empty();
        entry.find('[data-role="user-list"]').empty().hide();
        var orgListExpanded = $("<select/>").css("margin-top", "10px")
        entry.find('[data-role="org-placeholder"]').append(orgListExpanded)

        var opt = $("<option>")
                  .attr("value", "")
                  .text("Silakan pilih instansi tujuan")

        orgListExpanded.append(opt);
        $.ajax({
          url: "/findOrg?prefix=" + $(this).val(),
          context: entry, 
          dataType: 'json'
        }).done(function(data) {
          data.forEach(function(item) {
            p = item.path;
            var start = 0;
            var numSpan = "⊢";
            while (true) {
              var i = p.indexOf(';', start);
              if (i == -1)
                break;

              numSpan = numSpan + "―";
              start = i + 1;
            }
            if (numSpan.length == 1) {
              item.name = item.name.toUpperCase();
            }
            var opt = $("<option>")
                        .attr("value", item.path)
                        .text(numSpan + " " + item.name)

                    orgListExpanded.append(opt);

          });
          orgListExpanded.css("width","500px");
          orgListExpanded.chosen({search_contains: true});
        });

        orgListExpanded.change(function() {
          entry.append($("<i>").addClass("icon-refresh infinite-rotation-animation"));
          var org = $(this).val();
          var url = "/letter/getRecipients?org=" + org
          if (type == "cc") {
            url = "/letter/getCc?org=" + org
          }
          else if (type == "calendar") {
            url = "/calendar/getRecipients?org=" + org
          }
          $.ajax({
            url: url, 
            context: entry,
            dataType: 'json'
          }).done(function(data) {
            $(this).find("i").remove();
            var userList = $(entry.children("select")[1]);

            if (data.length > 0) {
              warning.hide();
              userList.show();
              button.show();
            } else {
              warning.show();
              userList.hide();
              button.hide();
            }
            userList.empty();
            data.forEach(function(item) {
              echelons[item.username] = parseInt(item.echelon);
              var opt = $("<option>")
                          .attr("value", item.username)
                          .text(item.fullName + ' | ' + (item.deputyActive == true? "PLH " : "") + item.title + ' | ' + item.organization)

              userList.append(opt);
              userList.addClass('span12')
            });
          });
        });
      });

      var cancel = $("<button>")
                      .addClass("btn btn-mini btn-danger")
                      .text("Batal")
                      .click(function(e) {
                        e.preventDefault()
                        delete shownEditors[id];
                        entry.remove();
                        $(c).show();
                        var alt = $(c).attr("data-alternative");
                        $("#" + alt).show();
                    })

      entry.append($("<i>").addClass("icon-refresh infinite-rotation-animation"));
      entry.append(orgList);
      entry.append($("<br>"));
      entry.append($("<div>").attr("data-role", "org-placeholder"));
      entry.append(list);
      entry.append($("<br>"))
      entry.append(warning);
      entry.append($("<br>"))
      entry.append(cancel);

    } else {
      var url = "/letter/getReviewer";
      if (scope == "internal") {
        switch (type) {
        case "cc":
          url = "/internal/getCc";
          break;
        case "recipient":
          url = "/internal/getRecipients";
          break;
        case "reviewer":
          url = "/internal/getReviewer";
          break;
        }
      }
      else if (scope == "disposition" && type == "recipient") {
        url = "/disposition/getRecipients?letterId=" + letterId;
      }
      else if (scope == "disposition" && type == "share") {
        url = "/disposition/getShareRecipients?letterId=" + letterId;
      }
      else if (scope == "external") {
        if (type == "recipient") {
          url = "/letter/getRecipientsExternal";
        }
      }
      $.ajax({
        url: url,
        context: entry, 
        dataType: 'json'
      }).done(function(data) {

        $(this).find("i").remove();
        
        if (data.length > 0) {
          data.forEach(function(item) {
            echelons[item.username] = parseInt(item.echelon);
            if (scope == "disposition" && type == "recipient") {
              opt = $("<option>")
                        .attr("value", item.username)
                        .text(item.fullName)
            } else {
              opt = $("<option>")
                        .attr("value", item.username)
                        .text(item.fullName + ' | ' + (item.deputyActive == true? "PLH " : "") + item.title + ' | ' + item.organization)

            }
            list.append(opt);
            list.addClass('span3')
          });
          button.show();
        } 
      });

      var cancel = $("<button>")
                      .addClass("btn btn-mini btn-danger")
                      .text("Batal")
                      .click(function(e) {
                        e.preventDefault()
                        delete shownEditors[id];
                        entry.remove();
                        $(c).show();
                        var alt = $(c).attr("data-alternative");
                        $("#" + alt).show();
                    });
      list.show();
      entry.append($("<i>").addClass("icon-refresh infinite-rotation-animation"));
      entry.append(list);
      entry.append($('<br>'))
      entry.append($('<br>'))
      entry.append(cancel)
    }
    entry.append(button);
    
    var reset = resetValues(data, {});
    listNames(c, reset);

    place.append(entry);
    shownEditors[id] = 1;
    if (type == "recipient" || type == "cc") {
      if (orgList) {
        orgList.change();
      }
    }
  }

  return {
    show: show
    , reset: reset
  }
}();

var manualRecipient = function() {
  var show = function(c, data) {
    var data = data || {
      name: '',
      organization: '',
      address: ''
    };

    var id = $(c).attr("data-recipient");
    var key = $(c).attr("data-key");
    var alt = $(c).attr("data-alternative");
    var place = $("#" + $("#" + id).attr("data-placeholder"));
    place.empty();

    var fields = $('<div>')
    var fields = $("<div>")
                  .append($("<input>")
                            .attr("type","hidden")
                            .attr("name", key + "[id]")
                            .attr("value","1"))
                  .append($("<span>")
                            .text("Nama")
                            .append("<br>"))
                  .append($("<input>")
                            .attr("type","text")
                            .attr("name", key + "[name]")
                            .attr("value", data.name) 
                            .addClass("span8")
                            .append("<br>"))
                  .append($("<span>")
                            .text("Instansi")
                            .prepend("<br>")
                            .append("<br>"))
                  .append($("<input>")
                            .attr("type","text")
                            .attr("name", key + "[organization]")
                            .addClass("span8")
                            .attr("value", data.organization) 
                            .append("<br>"))
                  .append($("<span>")
                            .text("Alamat instansi")
                            .prepend("<br>")
                            .append("<br>"))
                  .append($("<textarea>")
                            .attr("name", key + "[address]")
                            .addClass("span8")
                            .val(data.address) 
                            .append("<br>"));

    
    var cancel = $("<button>")
                      .addClass("btn btn-mini btn-danger")
                      .text("Batal")
                      .click(function(e) {
                        e.preventDefault()
                        delete shownEditors[id];
                        fields.remove();
                        $(c).show();
                        var alt = $(c).attr("data-alternative");
                        $("#" + alt).show();
                      })
    
    fields.append('<br>');
    fields.append('<br>');
    fields.append(cancel);
    place.append(fields);
    place.append('<br>');

    // aestethic
    $('input').css('color', '#393939');
    $('textarea').css('color', '#393939');
  }

  return {
    show: show
  }
}()

jQuery.fn.manualRecipient = function(data) {
  $(this).unbind();
  if (typeof(data) === "object") {
    $(this).hide();
    manualRecipient.show(this, data);
  }

  $(this).click(function(e) {
    e.preventDefault();
    $(this).hide();
    manualRecipient.show(this);
  });
}

jQuery.fn.recipientEditor = function() {
  $(this).unbind();
  $(this).click(function(e) {
    e.preventDefault();
    $(this).hide();
    recipientEditor.show(this);
  });
}

$(document).ready(function() {
  $(".manual-recipient").manualRecipient();
  $(".recipient-editor").recipientEditor();
  var editors = $(".recipient-editor");
  for (var i = 0; i < editors.length; i ++) {
    var item = editors[i];
    recipientEditor.reset(item);
  };
});
