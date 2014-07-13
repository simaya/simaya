$(function () {
  $.ajax({
    url: "/notification/list",
    dataType: 'json'
  }).done(function(jsonData) {
    var htmlList = '';
    jsonData.forEach(function(d){
      var message = d.message.substring(0, 40) + ' ...';
      var html = '<li> \
          <a href="/notification/' + d._id + '"><p>' + message + '</p></a> \
          <hr> \
          </li>';
      htmlList = htmlList + html;
    });
    $('#topNotify').html(htmlList);
  });

  var arr = location.pathname.split('/')
  
  if(arr[arr.length - 1] == '' && arr[arr.length - 2] == 'admin'){
    $.ajax({
      url: "/admin/disk-status",
      dataType: 'json'
    }).done(function(data) {
      $.plot($("#disk-usage"), data,
      {
          series: {
              pie: {
                  show: true
              }
          },
          grid: {hoverable: true}
      });
    });

    $('#menu-dasbor').hide()
  }else{
    $('#menu-dasbor').show()

    if(arr.length == 3){
      var menu = arr[arr.length - 2]
      var submenu = arr[arr.length - 1]
    }else{
      var menu = arr[arr.length - 1]
      var submenu = '1'
    }

    // exception, specific handlers
    if(menu == 'localadmin') menu = 'admin'
    if((location.pathname.indexOf('-user') > -1 || 
        location.pathname.indexOf('change-password') > -1 ||
        location.pathname.indexOf('email-list') > -1 ||
        location.pathname.indexOf('associate-role') > -1 ||
        location.pathname.indexOf('phones') > -1
      )
      && location.pathname.indexOf('admin') > -1) 
    {
      submenu = 'user'
      menu = 'admin'
    }

    $('#menu-' + menu).addClass('open')
    $('#menu-' + menu).addClass('current')


    if(submenu) $('#' + menu + '-' + submenu).attr('style','color: white;')
  }
});