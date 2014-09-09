jQuery.fn.resolveNotificationMessage = function() {

  // https://github.com/simaya/simaya/wiki/Daftar-Notifikasi
  var maps = {
    "@letter-sent-sender": "Surat Anda sudah dikirim",
    "@letter-sent-recipient": "Ada surat yang perlu diterima",
    "@letter-rejected-sender": "Surat dari Anda ditolak penerima",
    "@letter-rejected-originator": "Surat yang Anda tulis ditolak",
    "@letter-rejected-administration-sender": "Surat yang Anda kirimkan ditolak",
    "@letter-received-sender": "Surat dari Anda sudah diterima",
    "@letter-received-recipient": "Ada surat baru",
    "@letter-review-declined": "Surat Anda ditolak dalam pemeriksaan",
    "@letter-outgoing": "Ada surat yang perlu diperiksa",
    "@letter-review-approved-originator": "Surat Anda lolos dalam tahapan pemeriksaan",
    "@letter-review-approved-next-reviewer": "Ada surat yang perlu diperiksa",
    "@letter-review-finally-approved-originator": "Surat yang Anda tulis telah disetujui dan siap dikirim",
    "@letter-review-finally-approved-reviewers": "Surat Anda telah disetujui dan siap dikirim",
    "@letter-review-finally-approved-administration-sender": "Ada surat yang siap dikirim",
    
    "@disposition-shared-sender": "Disposisi Anda telah dibagikan ke orang lain",
    "@disposition-shared-recipients": "Ada disposisi yang dibagikan ke Anda",
  }

  var translate = function(text, truncate) {
    var text = maps[text];

    if (truncate) {
      return text.substring(0, 50) + " ...";
    } else {
      return text;
    }
  }

  var items = $(this);

  for (var i = 0; i < items.length; i ++) {
    var item = items[i];
    var text = $(item).attr("data-value") || $(item).text();
    console.log(text);
    if (text[0] == "@") {
      $(item).text(translate(text), $(item).attr("data-truncate"));
    }
  }
}

$(document).ready(function() {
  $(".notification-message").resolveNotificationMessage();
});
