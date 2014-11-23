var hawk = require("hawk");
var crypto = require("crypto");
var request = require("request");
var x509 = require("x509");
var fs = require("fs");

var credentials = {
  id : "ZDc5YzY3NjgtNjJhMy00M2Y0LWJkMmQtNGVjNTU0NTAwZTcz", // key
  key : "TTtMkUGdMk", // secret
  algorithm : "sha256"
}

var content = "test12345";

var payload = JSON.stringify({cert : content });

var nodeRequestOption = {
  uri : "http://localhost:3001/l/nodes",
  method : "POST",
  headers: {
    "Content-Type" : "application/json"
  },
  body : payload,
  json : true
}

var header = hawk.client.header(
  nodeRequestOption.uri, 
  nodeRequestOption.method, 
  { 
    credentials: credentials, 
    ext: "simaya-l",
    timestamp: Date.now(),
    nonce: Date.now().valueOf(),
    app: credentials.id,
    contentType : "application/json",
    hash : crypto.createHash("sha256").update(credentials.key).digest("base64"),
    payload : payload
  });

nodeRequestOption.headers.Authorization = header.field;

request(nodeRequestOption, function(err, res, body){
  console.log (err);
  console.log (res.statusCode);
  console.log (body);
});


