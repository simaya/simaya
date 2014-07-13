# JENJANG ESELON

Eselon ditentukan dengan pengkodean kombinasi angka dan huruf. 

XY

 * X merupakan kode angka eselon. Dari 1 sampai 5. Semakin tinggi angkanya semakin rendah tingkatannya dalam jenjang eselon.
 * Y merupakan kode huruf tingkat eselon. Dari A sampai E. Semakin awal hurufnya, maka semakin tinggi tingkatannya dalam jenjang eselon dalam kode angka yang sama.

Kode eselon disimpan dalam kolom "profile.echelon" dalam koleksi "user".

# DISPOSISI
## Penerima disposisi

Penerima disposisi dapat terdiri dari dua kelompok:
 * Tata Usaha (TU): Seseorang dapat memberi disposisi ke TU dalam instansi yang persis sama dan memiliki kode angka eselon *persis satu tingkat di atas* pengirim (satu eselon di *bawah* pemberi diposisi).
 * Staf lain: Seseorang dapat memberi disposisi ke staf dalam instansi atau sub-instansi dan memiliki kode angka eselon *persis satu tingkat di atas* pengirim *ATAU* dalam eselon yang sama namun memiliki kode huruf eselon yang lebih tinggi.

Proses pemilihan penerima disposisi ada di fungsi "controller/disposition.js::getRecipient". 

# ORGANISASI 

## Koleksi-koleksi yang terkait

- `user` [`profile.organization`]
- `letter` [`senderOrganization`, `receivingOrganization`]
- `deputy` [`organization`]
- `template` [`sharedTo`]
- `diskUsage` [`organization`]

# ADMIN LOKAL

## Dasbor: Koleksi-koleksi yang terkait

- `user`: total, total online, per organisasi
- `letter`: total, total hari ini, per organisasi, histori surat masuk dan keluar
- `diskUsage`: total, distribusi penggunaan, per organisasi
- `instansi`: total, per-organisasi



