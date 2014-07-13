module.exports = function(app) {
  // Private 
  var db = app.db('role');

  // Validation function
  db.validate = function(document, update, callback) {
    var validator = app.validator(document, update);
    
    validator.validateRegex({
      roleName: [/^[a-zA-Z0-9]{3,20}$/, 'Invalid role name'],
    });

    // Check duplicate roleName
    if (validator.isInserting()) {
      validator.validateQuery({
        roleName: [db, {roleName: update.roleName}, false, 'There is already a role with this name']
      }, function () {
        callback(null, validator);
      });
    } else {
      callback(null, validator);
    }
  }

  // Public API
  return {
    // Creates a new role 
    // Returns a callback
    //    validator: The validator
    create: function (roleName, roleDescription, callback) {
      db.getCollection(function (error, collection) {
        var data = {
          roleName: roleName,
          roleDescription: roleDescription
        };
        data._id = collection.pkFactory.createPk();

        db.validateAndInsert(data, function (error, validator) {
          callback(validator);
        }); 
      });
    },

    // Modifies a role
    // Returns via a callback
    //    result: validator
    edit: function(roleName, newRoleName, newDescription, callback) {
      db.findOne({roleName: roleName}, function(err, item) {
        if (err == null && item != null) {
          db.validateAndUpdate({
            _id: item._id
          }, {
            '$set': {
              roleName: newRoleName,
              roleDescription: newDescription
            }
          }, function(err, validator) {
            callback(validator);
          });
        } else {
          var doc = { roleName: roleName, roleDescription: newDescription }; 
          var validator = app.validator(doc, doc);
          validator.addError('roleName', 'Non-existant role');
          callback(validator);
        }
      });
    },

    // Removes a role 
    // Returns a callback
    //    result: true if successfull
    remove: function (roleName, callback) {
      db.remove({roleName: roleName}, function(error){
        callback(error == null);
      });
    },

    // List roles
    // Returns a callback
    //    result: Array of object of
    //      role: role name
    //      description: role description
    list: function (callback) {
      var search = {};
      if (arguments.length == 2) {
        search = arguments[0];
        callback = arguments[1];
      }
      db.findArray(search, function(error, result) {
        callback(result);
      });
    },
  }
}
