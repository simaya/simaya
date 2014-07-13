(function(){

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

  function setVal(node, val){
    $('#' + node).text(val)
  }

  function update(){

    $.get('/localadmin/stats')
    .done(function(data){
      
      for (var k in data) {
        setVal(k, data[k].total);
      }

      $.plot($("#disk-usage"), data["stat-disk-usage"],
        {
          series: { 
            pie: { show: true }
          },
          grid: {hoverable: true }
      });

      var series1 = {
        label: "Keluar",
        data: data["stat-letters"].history.lin,
        color: "#ff0000",
        points: { show: true },
        lines: { show: true }
      };

      var series2 = {
        label: "Masuk",
        data: data["stat-letters"].history.lout,
        color: "#00ff00",
        points: { show: true },
        lines: { show: true }
      };
  
      var series = [ series1, series2 ]

      $.plot($("#letters-history"), series, { 
        xaxis : data["stat-letters"].history.xaxis,
        yaxis : {min:0, tickSize: 1, tickFormatter : function(val){ return Math.floor(val)}}
      })

      console.log(data["stat-letters"].history.xaxis);

    })
    .fail(function(){

    });
  }

  var arr = location.pathname.split('/')
  if(arr[arr.length - 1] == 'localadmin'){
    $('#menu-dasbor').hide()
    setTimeout(function(){
      update();
    }, 500)
  }

  $('.submenu').each(function(){
    var el = $(this)
    var id = el.attr('id')
    if(!el.attr('href') && id) el.attr('href', '/localadmin/' + id.substring(id.indexOf('-') + 1))
  })

})()
