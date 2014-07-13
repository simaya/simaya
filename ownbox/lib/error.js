var inherits = require("util").inherits;

module.exports = OwnBoxError;

function OwnBoxError(options){
  Error.call(this);
  Error.captureStackTrace(this, arguments.callee);
  
  if ("string" == typeof options) options = { message : options };
  this.message = options.message;

  this.name = (options.name || "OwnBox") + " Error, stay calm. Message";
}

inherits(OwnBoxError, Error);

