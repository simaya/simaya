jQuery.fn.resolveLetterData = function() {
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

  var letterPriorities = ["Biasa", "Segera", "Amat Segera"];
  var letterPrioritiesClasses = ["success", "warning", "important"];
  var letterClassifications = ["Biasa", "Rahasia", "Sangat Rahasia"];
  var letterClassificationClasses = ["success", "warning", "important"];

  var letterStatus = [
    "Dalam proses penulisan",
    "Dalam proses pemeriksaan keluar",
    "Menunggu proses pengiriman",
    "Terkirim",
    "Belum dibaca",
    "Belum semua penerima telah membaca",
    "Penerima telah membaca",
    ];
  var letterStatusClasses = [
    "warning",
    "warning",
    "warning",
    "important",
    "warning",
    "success",
    ];

  var items = $(this);

  for (var i = 0; i < items.length; i ++) {
    var item = items[i];
    var value = $(item).attr("data-value");
    var type = $(item).attr("data-type");
    var index = parseInt(value);
    if (!isNaN(index)) {
      if (type == "type")
        $(item).text(letterTypes[value]);
      else if (type == "classification") {
        $(item).text(letterClassifications[value]);
        $(item).addClass("label label-" + letterClassificationClasses[value]);
      } else if (type == "priority") {
        $(item).text(letterPriorities[value]);
        $(item).addClass("label label-" + letterPrioritiesClasses[value]);
      } else if (type == "status") {
        $(item).text(letterStatus[value]);
        $(item).addClass("label label-" + letterStatusClasses[value]);
      }
    } else {
      $(item).text("Tidak diketahui");
    }
  }
}
function updateSearchDateVisibility(e) {
  var searchByDate = ($(e).attr("data-type") === "date");
  if (searchByDate) {
    $(".search-date").removeClass("hidden");
    $("#search-string").addClass("hidden");

  } else {
    $(".search-date").addClass("hidden");
    $("#search-string").removeClass("hidden");
  }
}

$(document).ready(function() {
  $(".resolve-letter-data").resolveLetterData();
  $("#search-type").change(function(){
    $("select[id='search-type'] option:selected").each(function(){
      updateSearchDateVisibility(this);
    });
  });
});
