#!/usr/bin/env node

var args = require('../../snapshot-args')
var options = args()

if(options){
  var snapshot = require('../')
  var mongo = require('mongoskin')

  var start = process.hrtime();

  var elapsedTime = function(note){
    var precision = 3;
    var elapsed = process.hrtime(start)[1] / 1000000; 
    console.log(process.hrtime(start)[0] + " s, " + elapsed.toFixed(precision) + " ms - " + note); 
    start = process.hrtime(); 
  }

  snapshot(options, function(err, res){
    if(err) throw err
    console.log(res)
    console.log("len: " + res.length)
    elapsedTime("Retrieved")
  })
}