var page = new WebPage()
var requestTokenUrl = 'http://localhost:3000/oauth/authorize?client_id=1&redirect_uri=/oauth/success&response_type=token'

function userAction(){
  var isLogin = page.evaluate(function(){
    return document.querySelector('input[name=username]') && document.querySelector('input[name=password]')
  })

  var isGrant = page.evaluate(function(){
    return document.querySelector('button[name=allow]') && document.querySelector('button[name=deny]')
  })

  if(isLogin){
    console.log('login')
    page.evaluate(function(){
      // "sandboxed" http://stackoverflow.com/a/15307220
      document.querySelector('input[name=username]').value = 'user.user'
      document.querySelector('input[name=password]').value = 'password'
      document.querySelector('button[name=login]').click()
    })
  }
  else if(isGrant){
    console.log('grant')
    page.evaluate(function(){
      document.querySelector('button[name=allow]').click()
    })
  }
  else{
    console.log('access_token')
    page.evaluate(function(){
      console.log(window.location)
    })
    phantom.exit()
  }
}

page.onConsoleMessage = function(msg, lineNum, sourceId) {
  console.log(msg)

}

page.onLoadFinished = function (status) {
  if(status == 'success'){
    userAction()
  }
}

page.open(requestTokenUrl)
