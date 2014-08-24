jQuery.fn.resolveLetterTypes = function() {
  var letterTypes = [];
  letterTypes.push("Peraturan");
  letterTypes.push("Pedoman");
  letterTypes.push("Petunjuk Pelaksanaan");
  letterTypes.push("Instruksi");
  letterTypes.push("Prosedur Tetap (SOP)");
  letterTypes.push("Surat Edaran");
  letterTypes.push("Keputusan");
  letterTypes.push("Surat Perintah/Surat Tugas");
  letterTypes.push("Nota Dinas");
  letterTypes.push("Memorandum");
  letterTypes.push("Surat Dinas");
  letterTypes.push("Surat Undangan");
  letterTypes.push("Surat Perjanjian");
  letterTypes.push("Surat Kuasa");
  letterTypes.push("Berita Acara");
  letterTypes.push("Surat Keterangan");
  letterTypes.push("Surat Pengantar");
  letterTypes.push("Pengumuman");
  letterTypes.push("Laporan");
  letterTypes.push("Lain-lain");

  var items = $(this);

  for (var i = 0; i < items.length; i ++) {
    var item = items[i];
    var value = $(item).attr("data-value");
    var index = parseInt(value);
    if (!isNaN(index)) {
      $(item).text(letterTypes[value]);
    } else {
      $(item).text("Tidak diketahui");
    }
  }
}

$(document).ready(function() {
  $(".resolve-letter-types").resolveLetterTypes();
});
