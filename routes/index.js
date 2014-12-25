module.exports = function(app) {
  var session = require('../sinergis/controller/session.js')(app)
    , utils = require('../sinergis/controller/utils.js')(app)
    , cUtils = require('../simaya/controller/utils.js')(app)
    , forgotPassword = require('../sinergis/controller/forgot-password.js')(app)
    , captcha = require('../sinergis/controller/captcha.js')(app)
    , adminRoutes = require('./admin.js')(app)
    , letter = require('../simaya/controller/letter.js')(app)
    , disposition = require('../simaya/controller/disposition.js')(app)
    , notification = require('../simaya/controller/notification.js')(app)
    , org = require('../simaya/controller/organization.js')(app)
    , template = require('../simaya/controller/template.js')(app)
    , search = require('../simaya/controller/search.js')(app)
    , localAdminRoutes = require('./localadmin.js')(app)
    , profile = require('../simaya/controller/profile.js')(app)
    , deputy = require('../simaya/controller/deputy.js')(app)
    , calendar = require('../simaya/controller/calendar.js')(app)
    , contacts = require('../simaya/controller/contacts.js')(app)
    , apiRoutes = require('./api')(app)
    , ob = require('../simaya/controller/ob.js')(app)
    , adminSimaya = require('../simaya/controller/admin.js')(app)
    , announcement = require('../simaya/controller/announcement.js')(app)
    , timeline = require('../simaya/controller/timeline.js')(app)
    , box = require('../simaya/controller/box.js')(app)
    , printControl = require('../simaya/controller/print-control.js')(app)
    , api2 = require('./api2')(app)
    , api4 = require('./api4')(app)
    , nodeRoutes = require('./node.js')(app)
    , errorPage = require('../simaya/controller/errorPage.js')(app)

  app.get('/', utils.requireLogin, session.isAdmin);
  app.get('/', utils.requireLogin, timeline.index);
  app.get('/signout', session.logout);
  app.get('/login', session.login);
  app.post('/login', session.login);

  app.all('/forgot-password', forgotPassword.start);
  app.all('/forgot-password/activate', forgotPassword.activate);

  app.get('/captcha/:id', captcha.display);
  app.all('/restricted', utils.requireLogin, utils.restricted);

  app.get('/incoming', utils.requireLogin, letter.listIncoming);
  app.all('/incoming/external', utils.requireLogin, letter.createExternal);
  app.all('/incoming/cc', utils.requireLogin, letter.listCc);
  app.all('/incoming/review', utils.requireLogin, letter.listReview);
  
  app.get('/outgoing', utils.requireLogin, letter.listOutgoing);
  app.all('/outgoing/new', utils.requireLogin, letter.createNormal);
  app.all('/outgoing/external', utils.requireLogin, letter.createOutgoindExternal);
  app.all('/outgoing/draft', utils.requireLogin, letter.listOutgoingDraft);
  app.all('/outgoing/cancel', utils.requireLogin, letter.listOutgoingCancel);
  
  app.all('/letter/review/:id', utils.requireLogin, notification.updateState, letter.review);
  app.get('/letter/review-incoming/:id', utils.requireLogin, letter.reviewIncoming);
  app.all('/letter/review', utils.requireLogin, letter.review);

  app.post('/letter', utils.requireLogin, letter.postLetter);

  app.get('/letter/check/:id', utils.requireLogin, notification.updateState,letter.checkLetter);

  app.post('/letter/reject', utils.requireLogin, letter.reject);
  
  app.get('/letter/read/:id', utils.requireLogin, notification.updateState,  letter.viewLetter);
  app.get('/letter/single/:id', utils.requireLogin, letter.viewSingleLetter);
  app.get('/letter/attachment/:id', utils.requireLogin, letter.downloadAttachment);
  app.all('/letter/receive/:id', utils.requireLogin, letter.receive);
  app.post('/letter/preview', utils.requireLogin, letter.preview);

  app.get('/letter/getNames/:id', utils.requireLoginWithoutUpdate, cUtils.getNames);
  app.get('/letter/getReviewer', utils.requireLoginWithoutUpdate, letter.getReviewerCandidates);
  app.get('/letter/getCc', utils.requireLoginWithoutUpdate, letter.getCcCandidates);
  app.get('/letter/getRecipients', utils.requireLoginWithoutUpdate, letter.getRecipientCandidates);
  app.get('/letter/getRecipientsExternal', utils.requireLoginWithoutUpdate, letter.getRecipientExternalCandidates);
  app.get('/letter/getSenderExternal', utils.requireLoginWithoutUpdate, letter.getSenderExternalCandidates);
  app.post('/letter/demote', utils.requireLogin, letter.demoteLetter);
 
  
  app.get('/disposition/new', utils.requireLogin, disposition.create);
  app.post('/disposition/new/:id', utils.requireLogin, disposition.create);
  app.get('/dispositions', utils.requireLogin, disposition.list);
  app.get('/dispositions/cc', utils.requireLogin, disposition.listCc);
  app.get('/dispositions/outgoing', utils.requireLogin, disposition.listOutgoing);
  app.get('/disposition/read/:id', utils.requireLogin, notification.updateState, disposition.view);
  app.get('/disposition/getRecipients', utils.requireLoginWithoutUpdate, disposition.getRecipientCandidates);
  app.get('/disposition/getShareRecipients', utils.requireLoginWithoutUpdate, disposition.getShareRecipientCandidates);
  app.post('/disposition/decline', utils.requireLogin, disposition.decline);
  app.post('/disposition/addComments', utils.requireLogin, disposition.addComments);
  app.post('/disposition/attachments', utils.requireLogin, disposition.uploadAttachment);
  app.get('/disposition/attachment/:id', utils.requireLogin, disposition.downloadAttachment);
  app.get('/disposition/redispositioned', utils.requireLogin, disposition.isReDispositioned);
  app.get('/disposition/findSuperiors', utils.requireLogin, disposition.findSuperiors);
  app.post('/disposition/share', utils.requireLogin, disposition.share);

  app.get('/notification/count', utils.requireLoginWithoutUpdate, notification.count);
  app.get('/notification', utils.requireLogin, notification.list);
  app.get('/notification/list', utils.requireLoginWithoutUpdate, notification.listJson);
  app.get('/notification/readAll', utils.requireLoginWithoutUpdate, notification.readAll);
  app.get('/notification/removeAll', utils.requireLoginWithoutUpdate, notification.removeAll);
  app.get('/notification/:id', utils.requireLogin, notification.view);
  app.get('/notification/setViewed/:id', utils.requireLoginWithoutUpdate, notification.setViewed);

  app.post('/organization/new', utils.requireLogin, org.create);
  app.post('/organization/edit', utils.requireLogin, org.edit);
  app.get('/titleInOrganization/listTitles/:path', utils.requireLoginWithoutUpdate, org.listTitles);
  app.get('/titleInOrganization/listMyTitles', utils.requireLoginWithoutUpdate, org.listMyTitles);
  app.get('/organization/view/', utils.requireLogin, org.view);
  app.get('/organization/jview/', utils.requireLoginWithoutUpdate, org.jview);
  app.get('/organization/view', utils.requireLogin, org.view);
  app.get('/findOrg/:id', utils.requireLoginWithoutUpdate, org.findLeaf);
  app.all('/organization/remove/:path', utils.requireLogin, org.remove);
  app.post('/organization/remove', utils.requireLogin, org.remove);
  app.get('/findOrg', utils.requireLoginWithoutUpdate, org.list);
  
  app.get('/templates', utils.requireLogin, template.list);
  app.all('/template/new', utils.requireLogin, template.create);
  app.all('/template/edit/:id', utils.requireLogin, template.edit);
  app.get('/template/view/:id', utils.requireLogin, template.view);
  app.get('/template/delete/:id', utils.requireLogin, template.remove);
  app.get('/template/_modal', utils.requireLogin, template.listModal);
  app.get('/template/letterhead/:id', utils.requireLogin, template.viewLogo);
  
  app.post('/search', utils.requireLogin, search.simple);
  app.get('/search', utils.requireLogin, letter.listIncoming);
  app.all('/search/advanced', utils.requireLogin, search.advanced);
  
  app.get('/agenda/incoming', utils.requireLogin, letter.listIncomingAgenda);
  app.get('/agenda/outgoing', utils.requireLogin, letter.listOutgoingAgenda);

  app.all('/profile/change-password', utils.requireLogin, profile.changePassword);
  app.all('/profile', utils.requireLogin, profile.modifyProfile);
  app.all('/profile/view', utils.requireLogin, profile.viewProfile);
  app.all('/profile/presence/status', utils.requireLogin, profile.updateStatusJSON);
  app.all('/profile/presence/getstatus', utils.requireLogin, profile.getStatusJSON);
  app.all('/profile/get-avatar', utils.requireLogin, profile.getAvatarStream);
  app.all('/contacts', utils.requireLogin, contacts.list);
  app.all('/contacts/waiting', utils.requireLogin, contacts.waiting);
  app.all('/contacts/to-be-approved', utils.requireLogin, contacts.toBeApproved);
  app.all('/contacts/request-connection', utils.requireLogin, contacts.requestConnection);
  app.all('/contacts/remove-connection', utils.requireLogin, contacts.removeConnection);
  app.all('/contacts/check-connection', utils.requireLogin, contacts.checkConnection);
  app.all('/contacts/get-online-state', utils.requireLogin, contacts.getOnlineState);

  app.all('/letter/view-pdf', utils.requireLogin, letter.viewPDF);
  app.get('/letter/view-pdf-stub/*', utils.requireLogin, letter.viewPDFStub);
  app.get('/letter/metadata/:id', utils.requireLogin, letter.getDocumentMetadata);
  app.get('/letter/render-page/*', utils.requireLogin, letter.renderDocumentPage);
  app.all('/deputy', utils.requireLogin, deputy.showAndUpdate);

  app.get('/letter/preview-html-provider', utils.requireLogin, letter.previewHTMLProvider);
  app.get('/letter/preview-pdf-stream', utils.requireLogin, letter.previewPDFStream);
  app.get('/letter/attachments/:id', utils.requireLogin, letter.attachments);
  app.del('/letter/attachments/:letterId/:attachmentId', utils.requireLogin, letter.deleteAttachment);
  app.post('/letter/attachments', utils.requireLogin, letter.uploadAttachment);
  app.post('/letter/content', utils.requireLogin, letter.uploadContent);
  app.get('/letter/content/:id', utils.requireLogin, letter.getContent);
  app.get('/letter/content/:id/:index', utils.requireLogin, letter.getContent);
  app.get('/letter/content-pdf/:id', utils.requireLogin, letter.contentPdf);

  app.get("/letter/reviewers-by-letter/:id", utils.requireLogin, letter.getReviewersByLetterJSON);
  app.get("/letter/all-reviewers", utils.requireLogin, letter.allReviewers);

  app.all('/calendar/day', utils.requireLogin, calendar.dayView);
  app.all('/calendar/week', utils.requireLogin, calendar.weekView);
  app.all('/calendar/new', utils.requireLogin, calendar.newJSON);
  app.all('/calendar/day/list', utils.requireLogin, calendar.listDayJSON);
  app.all('/calendar/dates-in-month', utils.requireLogin, calendar.listDatesInMonthJSON);
  app.all('/calendar/list', utils.requireLogin, calendar.list);
  app.all('/calendar/month', utils.requireLogin, calendar.monthView);
  app.all('/calendar/attachment/:id', utils.requireLogin, calendar.downloadAttachment);
  app.all('/calendar/invitation/cancel/:id', utils.requireLogin, calendar.cancelInvitationJSON);
  app.all('/calendar/invitation/accept/:id', utils.requireLogin, calendar.acceptInvitationJSON);
  app.all('/calendar/invitation/decline/:id', utils.requireLogin, calendar.declineInvitationJSON);
  app.all('/calendar/invitation/remove/:id', utils.requireLogin, calendar.removeInvitationJSON);
  app.get('/calendar/getRecipients', utils.requireLoginWithoutUpdate, calendar.getRecipientCandidatesJSON);
  app.get('/calendar/getAlarm', utils.requireLoginWithoutUpdate, calendar.getAlarmJSON);
  app.get('/calendar/removeAlarm/:id', utils.requireLoginWithoutUpdate, calendar.removeAlarmJSON);
  app.get('/calendar/getAlarmData/:id', utils.requireLoginWithoutUpdate, calendar.getAlarmDataJSON);

  app.post("/ob/simpleUpload", utils.requireLogin, ob.simpleUpload);
  app.get("/ob/get/:id", utils.requireLogin, ob.simpleDownload);

  app.get('/user-list/:id', utils.requireLogin, adminSimaya.userListJSON);

  app.get('/help', utils.requireLogin, cUtils.help);
  app.get('/announcement', utils.requireLoginWithoutUpdate, announcement.getActiveJSON);
  app.get('/timeline', utils.requireLogin, timeline.index);
  app.get('/timeline/json', utils.requireLogin, timeline.list);
  app.post('/timeline', utils.requireLogin, timeline.post);
  app.post('/timeline/comment', utils.requireLogin, timeline.postComment);
  app.post('/timeline/love', utils.requireLogin, timeline.love);
  app.post('/timeline/unlove', utils.requireLogin, timeline.unlove);
  app.post('/timeline/media', utils.requireLogin, timeline.uploadMedia);
  app.get('/timeline/media/:id', utils.requireLogin, timeline.downloadMedia);

  app.get("/box/dir", utils.requireLogin, box.readDir);
  app.get("/box/dir/*", utils.requireLogin, box.readDir);
  app.get("/box/file/*", utils.requireLogin, box.readFile);
  app.get("/box/users", utils.requireLogin, box.findUser);
  app.get("/box/users/org", utils.requireLogin, box.findUserOrg);
  app.post("/box/file", utils.requireLogin, box.writeFile);
  app.post("/box/dir", utils.requireLogin, box.createDir);
  app.post("/box/revisions", utils.requireLogin, box.revisions);

  app.post("/box/share/file", utils.requireLogin, box.shareFile);
  app.post("/box/share/dir", utils.requireLogin, box.shareDir);

  app.post("/box/delete/file", utils.requireLogin, box.deleteFile);
  app.post("/box/delete/dir", utils.requireLogin, box.deleteDir);
  
  app.get('/print-control/:id', utils.requireLogin, printControl.view);
  app.get('/err404', utils.requireLogin, errorPage.err404);

  app.get('*',function(req, res){
    res.redirect("/err404");
  });
}
