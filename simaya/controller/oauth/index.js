var OAuth2Provider = require('./lib/oauth2-provider').OAuth2Provider
var provider = new OAuth2Provider({crypt_key: 'blankon', sign_key: 'simaya'})

var prefix = '../../../../sinergis'

provider.on('enforce_login', function(req, res, authorize_url, next){
  if(req.session.authId){
    next(req.session.authId)
  }else{
    res.writeHead(302, {Location: '/oauth/login?next=' + encodeURIComponent(authorize_url)})
    res.end()
  }
})

provider.on('create_access_token', function(user_id, client_id, next) {
    var extra_data = 'blankon'
    next(extra_data)
})

provider.on('save_access_token', function(user_id, client_id, access_token) {
  console.log('saving access token %s for user_id=%s client_id=%s', JSON.stringify(access_token), user_id, client_id)
})

provider.on('access_denied', function(url, req, res){
  res.send(403, {status : 'error', message : 'access denied'})
})

provider.filter = function() {
  var self = this;
  return function(req, res, next) {
    if(req.path.substring(1, 7) == 'api/1/'){
      if(req.session.authId && req.session.data == 'blankon') {
        req.api1 = true;
        next();
      }
      else res.send(403, {status : 'error', message : 'access denied'})
    }else{
      next()
    }
  }
}

module.exports = {
  provider : provider
}
