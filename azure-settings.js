var azure = require('azure');

// konstanta
var hubname = "simaya-dev";
var connectionstring = 'Endpoint=sb://jepret-ns.servicebus.windows.net/;SharedAccessKeyName=DefaultFullSharedAccessSignature;SharedAccessKey=i3r56ogOupPpcGZKlnVIqsTce8rDsf0z5XmdnjDLUFY=';

var notificationHubService = azure.createNotificationHubService(hubname, connectionstring);
exports.makeNotification = function(message, id) {
	var payload = '<token><visual><binding template="ToastText01"><text id="1">'+message+'</text></binding></visual></token>';
	// var payload = {
	// 	text1:message
	// }
	notificationHubService.wns.send("user_"+id, payload, 'wns/toast', function(err) {
		if (err) {
			console.log(err);
		}else {
			console.log(message + " sent!");
		}
	});
}