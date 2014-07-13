var spawn = require('child_process').spawn
process.chdir('../../')
process.env['DB'] = 'test-simaya'
console.log(process.cwd())
var provider = spawn('node', ['app.js'])