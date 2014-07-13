var page = require('webpage').create()
var system = require('system')

var protocol = system.args[1] || 'http'
var host = system.args[2] || 'http://localhost:3000'
var headers = JSON.parse(system.args[3])

var viewPortWidth = system.args[4] || 600 
var viewPortHeight = system.args[5] || 600
var paperSize = system.args[6] || 'Letter'
var orientation = system.args[7] || 'portrait'
var margin = system.args[8] || '1cm'
var format = system.args[9] || 'pdf'

function emptyLetterHead(){
  var arr = document.querySelectorAll("img");
  for (var i = 0; i < arr.length; i++) { 
    var temp = arr[i].src.split("/"); 
    if (temp[temp.length - 1] == '') {
      arr[i].style.visibility="hidden"; 
    }
  }
}

page.viewportSize = { width: viewPortWidth, height: viewPortHeight }
page.paperSize = { format: paperSize, orientation: orientation, margin: margin }
page.customHeaders = headers
page.open( 'http://127.0.0.1:3000/letter/preview-html-provider', function(status){
  if(status != 'success'){
    phantom.exit()
  }else{

    window.setTimeout(function() {
      page.evaluate('(function(){ ' + emptyLetterHead.toString() +  ' emptyLetterHead(); })()')
      page.render('/dev/stdout', { format: format })
      phantom.exit()
    }, 200)
  }
})

