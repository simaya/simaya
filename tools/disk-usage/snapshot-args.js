var argv = require('./organization-disk-usage/node_modules/optimist').argv

var opt = argv._
var options = {}
var dbname = process.env.DB || 'simaya'
var remoteServer = process.env.SERVER || 'titik.blankon.rockybars.com'
var remoteServerPort = process.env.PORT || '27017'
var local = 'localhost:27017' + '/' + dbname
var remote =  remoteServer + ':' + remoteServerPort + '/' + dbname

function usage(){
  console.log('Usage: snapshot [local|remote] [save]')
  console.log('Honored env vars: DB (database name), SERVER (server address) and PORT (database port)')
}

module.exports = function(){
  if(opt.length == 1){

    if(opt[0] == 'save')
    {
      options.dbConnection = local
      options.collection = 'diskUsage'
    }
    else if(opt[0] == 'local'){
      options.dbConnection = local
    }
    else if(opt[0] == 'remote'){
      options.dbConnection = remote
    }
    else{
      usage()
      return 
    }
  }
  else if(opt.length == 2){
    if(opt[0] == 'remote'){
      options.dbConnection = remote
    }
    else if(opt[0] == 'local'){
      options.dbConnection = local
    }
    else{
      usage()
      return 
    }

    if(opt[1] == 'save'){
      options.collection = 'diskUsage'
    }

  }else{
    usage()
    return
  }
  return options
}