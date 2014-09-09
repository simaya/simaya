/*var utils = require('../utils.js')
var moment = require('moment')
var db = utils.db
var app = utils.app
var org = "Bimtek siMAYA" 
var letter = app.db('letter')

function lettersIn(organization, date, done){
  function map(){
    var self = this
    self.today = false

    if(date){
      var d = new Date(self.date).valueOf()
      self.today = (d >= date.setHours(0,0,0,0) && d < date.setHours(24,0,0,0))
    }

    if(this.receivingOrganizations != null){
      var keys = [];
      for(var k in this.receivingOrganizations) {
        keys.push(k)
      }
      if(keys.length > 0) {
        if(keys[0].indexOf(organization) > -1) {
          emit(self.today ? 'today-in' : 'old', 1)
        }
      }
    }
    else if(this.senderOrganization.indexOf(organization) > -1)
    {
      emit(self.today ? 'today-out' : 'old', 1)
    }
  }

  function reduce(key, values){
    return Array.sum(values)
  }

  var options = {
    out : { inline : 1},
    scope : { organization : organization, date : date}
  }

  letter.mapReduce(map, reduce, options, function(err, res){
    console.log(res)
    done(err, res)
  })
}

var lout = new Array()
var lin = new Array()
var count = 0
for(var i = 0; i < 7; i++){
  lettersIn(org, moment().subtract('days', i)._d, function(err, res){
    if(res.length > 1){
      for(var j = 1; j < res.length; j++){
        var o = res[j]
        if(o._id == 'today-in'){
          lin.unshift(o.value)
        }else{
          lout.unshift(o.value)
        }
      }

      if(lout.length != lin.length){
        if(lout.length < lin.length) lout.unshift(0)
        else lin.unshift(0)
      }
    }
    count++

    if(count == 7){
      console.log(lout)
      console.log(lin)  
    }
  })
  
}*/

function c(a,b){
  if(a[0] > b[0]) return 1
  if(a[0] < b[0]) return -1
}

var lin = [[0,1], [1,1], [2,1]]
lin.sort(c)
console.log(lin)




