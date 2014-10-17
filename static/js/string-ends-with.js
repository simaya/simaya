String.prototype.endsWith = function (suffix) {
  if (this.length < suffix.length)
    return false;
  return this.lastIndexOf(suffix) === this.length - suffix.length;
};


