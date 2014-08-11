var spawn = require('child_process').spawn
var express = require('express')
var assets = __dirname + "/../../static"
var server = express()

server.use(express.cookieParser(' default '))
server.use(express.session({secret:' default '}))
server.use(express.bodyParser())
server.use(express.static(assets))

server.get('/', function(req, res){
  res.send(
    '<html>' 
    + '<body>'
    + '<button>Test</button>'
    + '<script src="/jq.js"></script>'
    + '<script>$("button").click(function(){' 
    + 'var windowObjectReference;'
    + 'function openRequestedPopup(data) {'
    + 'windowObjectReference = window.open("/preview/pdf", "Preview", strWindowFeatures);'
    + '}'
    + 'var strWindowFeatures = "menubar=no,location=no,resizable=no,scrollbars=no,status=no";'
    + '$.post("/preview/render", { data : {"body" : "<b>This is <i>a cool</i> test</b> converting html to pdf via stdout <i>stream</i>"}}, function(data){ openRequestedPopup(data) })'
    + '})</script>'
    + '</body></html>')
})

server.get('/preview/pdf', function(req, res){
  var preview = spawn('phantomjs', [__dirname + '/../../simaya/controller/scripts/pdf.js', req.session.data])
  res.set('Content-type', 'application/pdf')
  preview.stdout.pipe(res)
})

server.post('/preview/render', function(req, res){
  req.session.data = req.body.data.body
  res.send({})
})

server.listen(8000)