$(document).ready(function() {
  $("#mass-remove-button").click(function(e) {
    e.preventDefault();
    if ($("[name=marked]:checked").length > 0) {
      $("#mass-remove-dialog").modal("show")
    }
  });

  $("[name=marked]").click(function(e) {
    if ($("[name=marked]:checked").length > 0) {
      $("#mass-remove-button").removeAttr("disabled");
    } else {
      $("#mass-remove-button").attr("disabled", true);
    }
  });
  $("#mass-remove-button").attr("disabled", true);

  $("#mass-remove-button-ok").click(function(e) {
    e.preventDefault();
    $("#main-form").append($("<input>").attr("type", "hidden").attr("name", "remove").val("1"));
    $("#main-form").submit();
  });

  $(".remove-button").click(function(e) {
    e.preventDefault();
    $("#remove-text").text($(this).attr("data-contact")); 
    $("#remove-button-ok").attr("data-id", $(this).attr("data-value"));
    $("#remove-dialog").modal("show")
  });

  $("#remove-button-ok").click(function(e) {
    e.preventDefault();
    $.ajax({
      url: "/contacts/remove-connection?id=" + $(this).attr("data-id"),
      context: this,
      dataType: 'json'
    }).done(function(jsondata) {
      location.reload();
    })
  })

  $(".add-button").click(function(e) {
    e.preventDefault();
    $("#add-dialog").modal("show")
  });

  $("#add-button-ok").click(function(e) {
    e.preventDefault();
    $.ajax({
      url: "/contacts/request-connection?username=" + $("[name=add-new-contact-name]").val() + "&text=" + $("[name=add-new-contact-text]").val(),
      context: this,
      dataType: 'json'
    }).done(function(jsondata) {
      location.href="/contacts/waiting"
    })
  });

  $(".add-as-contact").addAsContact();
  $(".contact-avatar").contactAvatar();

  var updateAvatarState = function() {
    $(".avatar").each(function(i, e) {
      var user = $(e).attr("data-username");
      getOnlineState(user, function(state) {
        if (state == "online") { 
          $(e).addClass("contact-name-online").removeClass("contact-name-offline")
        } else {
          $(e).removeClass("contact-name-online").addClass("contact-name-offline")
        }
      });
    })
  }
  bus.on("presence-status", updateAvatarState);

  var getOnlineState = function(username, callback) {
    if (bus.contacts[username] && bus.contacts[username].state) {
      callback(bus.contacts[username].state);
    } else {
      $.ajax({
        url: "/contacts/get-online-state?username=" + username,
        context: this,
        dataType: 'json'
      }).done(function(jsondata) {
        if (typeof(jsondata.state) !== "undefined") {
          var state;
          if (jsondata.state == 2) {
            state = "online";
            bus.contacts[username] = bus.contacts[username] || {};
            bus.contacts[username].state = state; 
          }
          callback(state);
        }
      })
    }
  }

  updateAvatarState();
});


var addAsContact = function() {
  var show = function(e) {
    $.ajax({
      url: "/contacts/check-connection?username=" + e.attr("data-username"),
      context: this,
      dataType: 'json'
    }).done(function(jsondata) {
      if (jsondata != null && jsondata.result == false) {
        e.click(function(){
          $("#contact-name").text(e.text());
          $(".add-as-contact-dialog").css("left", e.offset().left)
                 .css("top", e.offset().top).show()
        });

        $("#add-as-contact-submit").click(function() {
          $.ajax({
            url: "/contacts/request-connection?username=" + e.attr("data-username") + "&text=" + $("#add-new-contact-text").val(),
            context: this,
            dataType: 'json'
          }).done(function(jsondata) {
            $(this).parent().hide();
          })

        });

        $("#add-as-contact-cancel").click(function() {
          $(this).parent().hide();
        });
      }
    })
  }

  return {
    show: show
  }
}();


var contactAvatar = function() {
  var show = function(e) {
    var img = $("<img>")
                      .attr("src", "/profile/get-avatar?username=" + e.attr("data-username"))
                      .attr("data-username", e.attr("data-username"))
                      .addClass("avatar")
    e.prepend(img);

  }

  return {
    show: show
  }
}()

jQuery.fn.addAsContact = function(data) {
  for (var i = 0; i < this.length; i ++) {
    if ($(this[i]).attr("data-username")) {
      addAsContact.show($(this[i]));
    }
  }
}

jQuery.fn.contactAvatar = function(data) {
  for (var i = 0; i < this.length; i ++) {
    if ($(this[i]).attr("data-username")) {
      contactAvatar.show($(this[i]));
    }
  }
}

