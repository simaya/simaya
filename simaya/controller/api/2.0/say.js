module.exports = function(app){

  var envelope = require("./envelope");
  
  var hello = function(req, res){
    envelope.wrap({ data : "hello" }, req, res);
  }
  
  return {
    hello : hello
  }
}