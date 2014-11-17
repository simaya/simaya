module.exports = function(app){

  // oauth2 and api4
  var oauth2 = require('../simaya/controller/oauth2/oauth2.js')(app)
  var api4 = require("../simaya/controller/api/4.0")(app);

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
  var prefix = "/api/4";

  // dummy endpoint, saying hello to you
  app.get(prefix + "/say/hello", oauth2.protectedResource, api4.say.hello);

  // users
  app.get(prefix + "/users/self", oauth2.protectedResource, api4.user.self);
  app.get(prefix + "/users/:id", oauth2.protectedResource, api4.user.info);

  // letters
  app.get(prefix + "/letters/incomings", oauth2.protectedResource, api4.letter.incomings);
  app.get(prefix + "/letters/outgoings", oauth2.protectedResource, api4.letter.outgoings);
  app.get(prefix + "/letters/sender-selection", oauth2.protectedResource, api4.letter.senderSelection);
  app.get(prefix + "/letters/recipient-organization-selection", oauth2.protectedResource, api4.letter.orgSelection);
  app.get(prefix + "/letters/recipient-candidates-selection", oauth2.protectedResource, api4.letter.recipientCandidatesSelection);
  app.get(prefix + "/letters/cc-candidates-selection", oauth2.protectedResource, api4.letter.ccCandidatesSelection);
  app.get(prefix + "/letters/reviewer-candidates-selection", oauth2.protectedResource, api4.letter.reviewerCandidatesSelection);
  app.post(prefix + "/letters/reject", oauth2.protectedResource, api4.letter.rejectLetter);
  app.get(prefix + "/letters/:id", oauth2.protectedResource, api4.letter.read);
  app.get(prefix + "/letters/:id/documents", oauth2.protectedResource, api4.letter.attachments);
  app.post(prefix + "/letters/:id/link", oauth2.protectedResource, api4.letter.linkLetter);
  app.post(prefix + "/letters/new", oauth2.protectedResource, api4.letter.sendLetter);


  // documents
  app.get(prefix + "/documents/:id", oauth2.protectedResource, api4.letter.attachment);
  app.get(prefix + "/documents/:id/stream", oauth2.protectedResource, api4.letter.attachmentStream);

  // agendas
  app.get(prefix + "/agendas/incomings", oauth2.protectedResource, api4.letter.agendaIncomings);
  app.get(prefix + "/agendas/outgoings", oauth2.protectedResource, api4.letter.agendaOutgoings);

  // dispositions
  app.get(prefix + "/dispositions/incomings", oauth2.protectedResource, api4.disposition.incomings);
  app.get(prefix + "/dispositions/outgoings", oauth2.protectedResource, api4.disposition.outgoings);
  app.get(prefix + "/dispositions/:id", oauth2.protectedResource, api4.disposition.read);

  // profile
  app.get(prefix + "/profile/view", oauth2.protectedResource, api4.profile.view);
  app.get(prefix + "/profile/avatar", oauth2.protectedResource, api4.profile.getAvatar);

  // calendar
  app.get(prefix + "/calendar", oauth2.protectedResource, api4.calendar.list);

  // notification
  app.get(prefix + "/notifications", oauth2.protectedResource, api4.notification.list);
  app.get(prefix + "/notifications/:id", oauth2.protectedResource, api4.notification.view);
  
  //contacts
  app.get(prefix + "/contacts/waiting", oauth2.protectedResource, api4.contacts.waiting);
  app.get(prefix + "/contacts/to-be-approved", oauth2.protectedResource, api4.contacts.toBeApproved);
  app.get(prefix + "/contacts", oauth2.protectedResource, api4.contacts.list);
  app.get(prefix + "/contacts/request", oauth2.protectedResource, api4.contacts.request);
  app.get(prefix + "/contacts/remove", oauth2.protectedResource, api4.contacts.remove);
  app.get(prefix + "/contacts/establish", oauth2.protectedResource, api4.contacts.establish);
}
