# Surat #

 * *senderOrganization*: instansi pengirim
 * *sender*: atas nama
 * *receivingOrganizations*: array struktur penerimaan surat dengan kunci nama instansi
    * *status*: status surat dalam instansi penerima
    * *agenda*: nomor agenda masuk, diisi oleh TU penerima
    * *date*: nomor surat diterima masuk
 * *outgoingAgenda*: nomor agenda keluar, diisi oleh TU pengirim
 * *receivedDate*: tanggal surat diterima
 * *date*: tanggal surat sesuai tanggal di kertas
 * *creationDate*: tanggal surat dibuat
 * *mailId*: nomor surat
 * *recipients*: array nama login penerima
 * *ccList*: array nama login tembusan
 * *originator*: nama login pembuat surat pertama kali
 * *title*: perihal
 * *priority*: kecepatan sampai surat
    * 1: biasa
    * 2: segera
    * 3: amat segera
 * *classification*: tingkat keamanan surat
    * 1: biasa
    * 2: rahasia
    * 3: sangat rahasia
 * *comments*: catatan pembuat surat
 * *type*: jenis surat
    * 0: Peraturan
    * 1: Pedoman
    * 2: Petunjuk Pelaksanaan
    * 3: Instruksi
    * 4: Prosedur Tetap (SOP)
    * 5: Surat Edaran
    * 6: Keputusan
    * 7: Surat Perintah/Surat Tugas
    * 8: Nota Dinas
    * 9: Memorandum
    * 10: Surat Dinas
    * 11: Surat Undangan
    * 12: Surat Perjanjian
    * 13: Surat Kuasa
    * 14: Berita Acara
    * 15: Surat Keterangan
    * 16: Surat Pengantar
    * 17: Pengumuman
    * 18: Laporan
    * 19: Lain-lain
 * *body*: badan surat
 * *reviewers*: array nama login pemeriksa
 * *nextReviewer*: nama login pemeriksa berikutnya
 * *status*: status surat
    * 0: new, surat baru dibuat
    * 1: waiting, surat dalam pembuatan konsep
    * 2: reviewing, surat dalam proses pemeriksaan
    * 3: approved, surat sudah disetujui
    * 4: demoted, surat dibatalkan
    * 5: sent, surat terkirim
    * 6: received, surat sudah diterima seluruh daftar penerima dan tembusan
    * 7: rejected, surat ditolak oleh penerima
 * *log*: array struktur berikut 
    * *date*: tanggal log
    * *username*: nama login 
    * *action*: jenis kegiatan 
    * *message*: catatan kegiatan
 * *letterhead*: kode kop surat
 * *fileAttachments*: array struktur lampiran
    * *path*: kode berkas dalam sistem grid
    * *name*: nama berkas
    * *type*: jenis berkas
 * *creation*: jenis pembuatan surat dalam sistem
    * normal: TNDE
    * external: salinan surat kertas
 * *senderManual*: array struktur berikut, diisi jika *creation* bernilai **external**, jika ini diisi maka *sender*, dan *senderOrganization* tidak ada nilainya
    * *name*: atas nama
    * *organization*: instansi pengirim
    * *address*: alamat instansi
 * *_id*: kode surat di dalam sistem

# Disposisi #
 * *_id*: kode disposisi dalam sistem
 * *created_at*: tanggal disposisi dibuat dalam sistem
 * *letterId*: kode surat dalam sistem
 * *inReplyTo*: kode surat yang dibuatkan tanggapannya dalam bentuk disposisi
 * *sender*: pengirim disposisi
 * *letterTitle*: salinan perihal surat
 * *letterMailId*: salinan nomor surat
 * *letterDate*: salinan tanggal surat
 * *recipients*: array struktur berikut
    * *message*: pesan disposisi
    * *recipient*: nama penerima disposisi
    * *instruction*: instruksi disposisi
        * 1: Ditindak lanjuti
        * 2: Ditanggapi tertulis
        * 3: Disiapkan makalah/sambutan/presentasi sesuai tema
        * 4: Koordinasikan dengan
        * 5: Diwakili &amp; laporkan hasilnya
        * 6: Dihadiri &amp; dilaporkan hasilnya
        * 7: Disiapkan surat/memo dinas (internal)
        * 8: Arsip
        * 9: Lain-lain
    * *priority*: kecepatan penyampaian
        * 1: biasa
        * 2: segera
        * 3: amat segera
    * *security*: tingkat keamanan disposisi
        * 1: biasa
        * 2: rahasia
        * 3: amat rahasia