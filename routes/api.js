module.exports = function(app){
  /*
    Helper
  */
  app.map = function(a, route){
    route = route || '';
    for (var key in a) {
      switch (typeof a[key]) {
        case 'object': app.map(a[key], route + key); break;
        case 'function':
        app[key](route, a[key]);
        break;
      }
    }
  }

  var prefix = '../simaya/controller'
  var oauth = require(prefix + '/oauth')
  var auth = require(prefix + '/auth')(app)
  var utils = require('../sinergis/controller/utils.js')(app)

  /*
    Available handlers
  */
  var api = {
    oauth : require(prefix + '/oauth/lib/oauth')(app),
    '1' : {
      letter : require(prefix + '/api/1.0/letter')(app),
      disposition: require(prefix + '/api/1.0/disposition')(app),
      profile: require(prefix + '/api/1.0/profile')(app),
      calendar: require(prefix + '/api/1.0/calendar')(app),
      notification: require(prefix + '/api/1.0/notification')(app),
      contacts: require(prefix + '/api/1.0/contacts')(app),
      pushNotification: require(prefix + '/api/1.0/push-notification')(app),
      timeline: require(prefix + '/api/1.0/timeline')(app),
      dashboard: require(prefix + '/api/1.0/dashboard')(app),
      user: require(prefix + '/api/1.0/user')(app),
    }
  }

  /*
    Available API endpoints 
  */
  app.map({
    '/api' : {
      '/1' : {
        '/letter' : {
          'post': api['1'].letter.sendLetter,
          '/view' : {
            get : api['1'].letter.view
          },
          '/incoming' : {
            get : api['1'].letter.incoming  
          },
          '/outgoing' : {
            get : api['1'].letter.outgoing
          },
          '/document/metadata' : {
            get : api['1'].letter.documentMetadata
          },
          '/document/rendering' : {
            get : api['1'].letter.documentRendering
          },
          '/document/rendering/base64' : {
            get : api['1'].letter.documentRenderingBase64
          },
          '/reject' : {
            post: api['1'].letter.rejectLetter
          },
          '/incoming-agenda' : {
            get : api['1'].letter.incomingAgenda
          },
          '/outgoing-agenda' : {
            get : api['1'].letter.outgoingAgenda
          },
          '/sender-selection' : {
            get : api['1'].letter.senderSelection
          },
          '/recipient-org-selection' : {
            get : api['1'].letter.orgSelection
          },
          '/recipient-candidates-selection' : {
            get : api['1'].letter.recipientCandidatesSelection
          },
          '/cc-candidates-selection' : {
            get : api['1'].letter.ccCandidatesSelection
          },
          '/reviewer-candidates-selection' : {
            get : api['1'].letter.reviewerCandidatesSelection
          },
        },
        '/profile' : {
          '/avatar' : {
            get : api['1'].profile.getAvatar
          },
          '/avatar/base64' : {
            get : api['1'].profile.getAvatarBase64
          },
          '/fullName' : {
            get : api['1'].profile.getFullName
          },
          '/login-name' : {
            get : api['1'].profile.getLoginName
          },
          '/view' : {
            get : api['1'].profile.view
          },
          '/status' : {
            get : api['1'].profile.getStatus,
            post : api['1'].profile.putStatus,
          },
        },
        '/disposition' : {
          '/candidates' : {
            get : api['1'].disposition.getRecipientCandidates
          },
          '/info' : {
            get : api['1'].disposition.getInfo
          },
          '/outgoing' : {
            get : api['1'].disposition.outgoing
          },
          '/incoming' : {
            get : api['1'].disposition.incoming
          },
          '/new-entry' : {
            post: api['1'].disposition.create
          },
          '/decline' : {
            post: api['1'].disposition.decline
          },
          '/comments' : {
            post: api['1'].disposition.addComments
          },
          '/mark-as-read' : {
            post: api['1'].disposition.markAsRead
          },
        },
        '/calendar': {
          '/list' : {
            get: api['1'].calendar.list
          },
        },
        '/notification' : {
          get : api['1'].notification.list,
          '/push' : {
            '/register': {
              post: api['1'].pushNotification.register
            }
          },
          '/view' : {
            get: api['1'].notification.view
          }
        },
        '/contacts': {
          '/list' : {
            get: api['1'].contacts.list
          },
          '/waiting' : {
            get: api['1'].contacts.waiting
          },
          '/to-be-approved' : {
            get: api['1'].contacts.toBeApproved
          },
          '/request' : {
            get: api['1'].contacts.request
          },
          '/remove' : {
            get: api['1'].contacts.remove
          },
          '/establish' : {
            get: api['1'].contacts.establish
          },
          '/check' : {
            get: api['1'].contacts.checkConnection
          },
        },
        '/timeline' : {
          '/list' : {
            get: api['1'].timeline.list
          },
          '/post-comment' : {
            post: api['1'].timeline.postComment
          },
          '/post' : {
            post: api['1'].timeline.post
          },
          '/love' : {
            post: api['1'].timeline.love
          },
          '/unlove' : {
            post: api['1'].timeline.unlove
          },
          '/media' : {
            get: api['1'].timeline.downloadMedia,
            post: api['1'].timeline.uploadMedia
          },
        },
        '/dashboard': {
          '/values' : {
            get: api['1'].dashboard.values
          },
        },
        '/user' : {
          '/resolve' : {
            get: api['1'].user.resolveNames
          },
          '/list' : {
            get: api['1'].user.list
          }
        },

      }
    },
    '/oauth' : {
      '/login' : {
        get : api.oauth.login,
        post : api.oauth.login
      },
      '/logout' : {
        get : api.oauth.logout,
        post : api.oauth.logout
      },
      '/success' : {
        get : api.oauth.success 
      }
    }
  })

  /*
    Additional handler
  */
  oauth.provider.on('authorize_form', function(req, res, clientId, authorizeUrl){
    api.oauth.authorize(req, res, clientId, authorizeUrl)
  })

  oauth.provider.on('access_token', function(req, res, token, next){
    api.oauth.accessToken(req, res, token, next)
  })

  app.post('/auth/get-token', auth.getToken);
}
