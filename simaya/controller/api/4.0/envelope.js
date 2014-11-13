/* wrap the API response */

exports.wrap = function(options, req, res) {
  res.send(options);
}