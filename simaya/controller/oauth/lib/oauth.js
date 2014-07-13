module.exports = function(app){

  var prefix = '../../../../sinergis'
  var utils = require(prefix + '/controller/utils')(app)
  var user =  require(prefix + '/models/user')(app)
  var session =  require(prefix + '/models/session')(app)

  function enter(req, res){
    var position = { 
      ip: '', 
      lon: 0, 
      lat: 0,  
      device: {
        access: req.body.access,
        uuid: req.body.device, 
        platform: req.body.platform,
        version: req.body.version,
        clientVersion: req.body.clientVersion,
      },
    }
    session.login(req.body.username, position, function(sessionId, reason) {
      if (sessionId == null){
        res.redirect('/oauth/login?unable-login&next=' + encodeURIComponent(req.body.next))
      }else{
        req.session.authId = sessionId
        session.update(req.session.authId, position, function(result) {
          if(result != 0){
            res.redirect('/oauth/login?u&next=' + encodeURIComponent(req.body.next))
          }
          else
          session.getUser(req.session.authId, function(u) {
            req.session.currentUser = u

            if (!u) {
              return res.redirect('/oauth/login?u&next=' + encodeURIComponent(req.body.next))
            }

            user.list({search: { username: u }}, function(r) {         
              r[0].profile.username = u
              req.session.currentUserProfile = r[0].profile;

              if (r[0].roleList == null) {
                r[0].roleList = []
              }

              req.session.currentUserRoles = r[0].roleList;
              res.redirect(302, req.body.next)
            })
          })
        })
      }
        }) 
  }

  function authenticate(req, res){
    user.authenticate(req.body.username, req.body.password, function(r) {
      if(r) 
        enter(req, res)
      else 
        res.redirect('/oauth/login?auth&next=' + encodeURIComponent(req.body.next))
    })
  }

  var login = function(req, res){
    if(req.method == 'GET'){
      if(req.query.next){
        var vals = { nextUrl : req.query.next}
        utils.render(req, res, 'api-oauth-login', vals, 'base-empty-body');
      }else{
        res.redirect('/login')
      }
    }else{
      authenticate(req, res)
    }
  }

  var logout = function(req, res){
    session.logout(req.session.authId, function(){
      res.send({ status : 'success', message : 'logout'})
    })
  }

  var success = function(req, res){
    var atok = req.cookies.atok;
    delete(req.cookies.atok);
    res.send({ status : 'success', message : 'success', atok: atok})
  }

  var authorize = function(req, res, clientId, authorizeUrl){
    utils.render(req, res, 'api-oauth-grant-access', {authorizeUrl : authorizeUrl}, 'base-empty-body');
  }

  var accessToken = function(req, res, token, next){

    req.session.authId = token.user_id;
    req.session.data = token.extra_data;
    
    var position = { 
      ip: '', 
      lon: 0, 
      lat: 0, 
      device: {
        access: req.body.access,
        uuid: req.body.device, 
        platform: req.body.platform,
        version: req.body.version,
        clientVersion: req.body.clientVersion,
      }
    };

    session.update(req.session.authId, position, function(result) {
      console.log(req.session.authId);
      if(result != 0){
        res.redirect('/oauth/login?unable-to-update-session='+result+'&next=' + encodeURIComponent(req.body.next))
        delete(req.session.authId);
      }
      else
      session.getUser(req.session.authId, function(u) {

        if (!u) {
          delete(req.session.authId);
          return res.redirect('/oauth/login?unable-to-update-session='+result+'&next=' + encodeURIComponent(req.body.next))
        }

        user.list({search: { username: u }}, function(r) {         
          if (r) {
            req.session.currentUser = u
            r[0].profile.username = u
            req.session.currentUserProfile = r[0].profile;

            if (r[0].roleList == null) {
              r[0].roleList = []
            }

            req.session.currentUserRoles = r[0].roleList;
            next()
          } else {
            delete(req.session.authId);
            return res.redirect('/oauth/login?unable-to-find-user-in-session&next=' + encodeURIComponent(req.body.next))
          }
        })
      })
    })
  }

  return {
    login : login,
    logout : logout,
    success : success,
    authorize : authorize,
    accessToken : accessToken

  }
}
