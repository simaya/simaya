/**
* Parallel execution of an async function given several arguments
*
* Usage example:
* 
* var lela = require('./lela')
* 
* function getLetters(cb){
*   cb([{letter : {sender : "ceng", body: "body"}}, {letter : {sender : "ceng", body: "body"}}])
* }
* 
* function getUsers(sender, cb){
*   setTimeout(function(){ cb(null, [{fullname : "Ceng Karuk"}]) }, 250)
* }
* 
* // the async function
* function aggregate(letter, cb){
*   getUsers({sender : letter.sender}, function(err, users){
*     letter.senderResolved = users[0].fullname
*     cb(null, letter)
*   })
* }
* 
* // `letters` is the arguments array for `aggregate`
* getLetters(function(letters){
*   lela(aggregate, letters, function(err, data){
*     console.log(data)
*   })
* })
*
* @method lela
* @param {Function} fn function, with following signature fn(args[i], callback)
* @param {Object} args arguments array, with following format: [{key : value}, {key : value}, ... ]
* @param {Function} cb_, a callback function with follwoing signature: cb(err, data)
*/
function lela(fn, args, label, cb_){
  var n = args.length
  var results = []
  var errState = null

  function cb(er, data){
    if(errState) return 
    if(er)
      return cb(errState = er)
    results.push(data)
    if(--n === 0)
      cb_(null, label, results)
  }

  function toArray(obj){
    var arr = []
    for(var i in obj){
      arr.push(obj[i])
    }
    return arr
  }

  args.forEach(function(arg){
    var a = toArray(arg)
    a.push(cb)
    fn.apply(this, a)
  })
}

if(typeof module !== 'undefined' && "exports" in module){
  module.exports = lela
}