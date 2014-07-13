var should = require('should')

var utils = require('../utils.js');
var User = require('../../sinergis/models/user')(utils.app)

var user1 = {
  username : 'ben5',
  password : 'test12345',
  profile: {
    emailList : ['test@test', 'test@test.com'],
    phones : ['02270831808']  
  }
}

describe('User', function(){
  describe('#create(user, function(validator){})', function(){
    it('should test', function(done){
      User.create(user1, function(validator){
        validator.hasErrors().should.equal(true)
        done()
      })
    })
  })
})