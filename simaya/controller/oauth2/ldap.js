module.exports = function(app) {
	var passport = require('passport');
	var ldapStrategy = require('passport-ldap').Strategy;
	var simpleLDAPAuth = require('simple-ldap-auth');

	var ldapConfig = {
		server : {
			url : 'ldap://192.168.1.75'
		},
		debug : false,
		authMode : 0,
		usernameField : 'username',
		passwordField : 'password',
		base : ['ou=simaya','dc=dycode','dc=com'],
		search : {
			// belum paham bagian ini
		}
	};

	passport.use(new ldapStrategy(ldapConfig, function(profile, done) {
		return done(null,profile);
	}));

	passport.authenticate('ldap', {session : true});
}