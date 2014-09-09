module.exports = function(app){
  // box
  var boxC = require("../simaya/controller/box.js")(app);
  var box = require("../simaya/controller/api/2.0/box.js")(app);

  // ob
  var ob = require("../simaya/controller/ob.js")(app);

  // oauth2 and api2
  var oauth2 = require('../simaya/controller/oauth2/oauth2.js')(app)
  var api2 = require("../simaya/controller/api/2.0")(app)

  // khusus timeline
  var timeline = require("../simaya/controller/api/2.0/timeline.js")(app)
  var timelineC = require("../simaya/controller/timeline.js")(app)

  // khusus letter - uploadAttachments
  var letterC = require("../simaya/controller/letter.js")(app)

  // oauth2 handlers
  app.get('/oauth2/authorize', oauth2.authorization);
  app.post('/oauth2/authorize/decision', oauth2.decision);
  app.post('/oauth2/token', oauth2.token);
  app.get('/oauth2/callback/:clientId?', oauth2.callback);

  // xauth handler
  app.post('/xauth/authorize', oauth2.xauthorization);
  app.get('/xauth/callback/:clientId?', oauth2.xcallback);
  app.get('/xauth/token', oauth2.xtoken);

  // api 2
  var prefix = "/api/2";

  // dummy endpoint, saying hello to you
  app.get(prefix + "/say/hello", oauth2.protectedResource, api2.say.hello);

  // users
  app.get(prefix + "/users/self", oauth2.protectedResource, api2.user.self);
  app.get(prefix + "/users/:id", oauth2.protectedResource, api2.user.info);

  // letters
  app.get(prefix + "/letters/incomings", oauth2.protectedResource, api2.letter.incomings);
  app.get(prefix + "/letters/incomingcount", oauth2.protectedResource, api2.letter.incomingcount);
  app.get(prefix + "/letters/outgoings", oauth2.protectedResource, api2.letter.outgoings);
  app.get(prefix + "/letters/outgoingcount", oauth2.protectedResource, api2.letter.outgoingcount);
  app.get(prefix + "/letters/sender-selection", oauth2.protectedResource, api2.letter.senderSelection);
  app.get(prefix + "/letters/recipient-organization-selection", oauth2.protectedResource, api2.letter.orgSelection);
  app.get(prefix + "/letters/recipient-candidates-selection", oauth2.protectedResource, api2.letter.recipientCandidatesSelection);
  app.get(prefix + "/letters/cc-candidates-selection", oauth2.protectedResource, api2.letter.ccCandidatesSelection);
  app.get(prefix + "/letters/reviewer-candidates-selection", oauth2.protectedResource, api2.letter.reviewerCandidatesSelection);
  app.post(prefix + "/letters/reject", oauth2.protectedResource, api2.letter.rejectLetter);
  app.get(prefix + "/letters/read/:id", oauth2.protectedResource, api2.letter.read);
  app.get(prefix + "/letters/:id/documents", oauth2.protectedResource, api2.letter.attachments);
  app.all(prefix + "/letters/new", oauth2.protectedResource, api2.letter.sendLetter);
  app.post(prefix + "/letters/uploadAttachments", oauth2.protectedResource, api2.letter.uploadAttachment);
  app.del(prefix + "/letters/attachments/:letterId/:attachmentId", oauth2.protectedResource, api2.letter.deleteAttachment);

  // documents
  app.get(prefix + "/documents/:id", oauth2.protectedResource, api2.letter.attachment);
  app.get(prefix + "/documents/:id/stream", oauth2.protectedResource, api2.letter.attachmentStream);

  // agendas
  app.get(prefix + "/agendas/incomings", oauth2.protectedResource, api2.letter.agendaIncomings);
  app.get(prefix + "/agendas/outgoings", oauth2.protectedResource, api2.letter.agendaOutgoings);

  // dispositions
  app.get(prefix + "/dispositions/incomings", oauth2.protectedResource, api2.disposition.incomings);
  app.get(prefix + "/dispositions/outgoings", oauth2.protectedResource, api2.disposition.outgoings);
  app.get(prefix + "/dispositions/:id", oauth2.protectedResource, api2.disposition.read);

  // profile
  app.get(prefix + "/profile/view", oauth2.protectedResource, api2.profile.view);
  app.get(prefix + "/profile/avatar", oauth2.protectedResource, api2.profile.getAvatar);
  app.post(prefix + "/profile/save", oauth2.protectedResource, api2.profile.save);

  // calendar
  app.get(prefix + "/calendar", oauth2.protectedResource, api2.calendar.list);
  app.post(prefix + "/calendar/create", oauth2.protectedResource, api2.calendar.create);

  // notification
  app.get(prefix + "/notifications", oauth2.protectedResource, api2.notification.list);
  app.get(prefix + "/notifications/view/:id", oauth2.protectedResource, api2.notification.view);
  
  //contacts
  app.get(prefix + "/contacts/waiting", oauth2.protectedResource, api2.contacts.waiting);
  app.get(prefix + "/contacts/to-be-approved", oauth2.protectedResource, api2.contacts.toBeApproved);
  app.get(prefix + "/contacts", oauth2.protectedResource, api2.contacts.list);
  app.get(prefix + "/contacts/request", oauth2.protectedResource, api2.contacts.request);
  app.get(prefix + "/contacts/remove", oauth2.protectedResource, api2.contacts.remove);
  app.get(prefix + "/contacts/establish", oauth2.protectedResource, api2.contacts.establish);

  // timeline
  app.get(prefix + "/timeline/list", oauth2.protectedResource, timeline.listJSON);
  app.post(prefix + "/timeline/post", oauth2.protectedResource, timelineC.post);
  app.post(prefix + "/timeline/comment", oauth2.protectedResource, timelineC.postComment);
  app.post(prefix + "/timeline/love", oauth2.protectedResource, timelineC.love);
  app.post(prefix + "/timeline/unlove", oauth2.protectedResource, timelineC.unlove);
  app.post(prefix + "/timeline/upload", oauth2.protectedResource, timeline.uploadMedia);

  // ob
  app.get(prefix + "/ob/get/:id", oauth2.protectedResource, ob.simpleDownload);

  // box
  app.get(prefix + "/box/users", oauth2.protectedResource, boxC.findUser);
  app.get(prefix + "/box/users/org", oauth2.protectedResource, boxC.findUserOrg);
  app.get(prefix + "/box/dir", oauth2.protectedResource, box.readDir);
  app.get(prefix + "/box/dir/*", oauth2.protectedResource, box.readDir);
  app.get(prefix + "/box/file/*", oauth2.protectedResource, box.readFile);
  app.post(prefix + "/box/dir", oauth2.protectedResource, boxC.createDir);
  app.post(prefix + "/box/file", oauth2.protectedResource, box.writeFile);
  app.post(prefix + "/box/revisions", oauth2.protectedResource, boxC.revisions);
  app.post(prefix + "/box/share/file", oauth2.protectedResource, boxC.shareFile);
  app.post(prefix + "/box/share/dir", oauth2.protectedResource, boxC.shareDir);
  app.post(prefix + "/box/delete/file", oauth2.protectedResource, boxC.deleteFile);
  app.post(prefix + "/box/delete/dir", oauth2.protectedResource, boxC.deleteDir);
}