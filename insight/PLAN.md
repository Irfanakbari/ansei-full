# ANSEI Management Insight dan "ANSEI dalam 1 Bulan"

Tanggal penyimpanan: 18 September 2026.

Status: **belum diimplementasikan; ditunda atas permintaan pengguna**.

## 1. Tujuan dan keputusan yang sudah disepakati

Bangun dashboard BI untuk pemantauan operasional dan PDF bulanan bergaya ebook untuk manajemen operasional. Keduanya menggunakan definisi dan perhitungan KPI yang sama.

Laporan menjawab: apa yang tercapai, apa yang berubah, bagian mana yang membutuhkan perhatian, dan tindakan apa yang disarankan untuk bulan berikutnya.

Keputusan pengguna:

- Pengembangan bertahap dari data ANSEI yang sudah tersedia.
- Pembaca utama adalah manajemen operasional.
- PDF sekitar 10-14 halaman; contoh awal dibuat 12 halaman.
- Laporan nantinya diterbitkan otomatis langsung final dengan bantuan GPT untuk narasi.
- GPT hanya menerima agregat yang diizinkan, tanpa identitas orang, nama supplier, atau rincian transaksi. Agregasi tetap harus diperiksa agar tidak membocorkan data sensitif.
- Angka dihitung ANSEI. Jika GPT gagal atau narasinya tidak lolos validasi, gunakan narasi template.
- Saat ini hanya menyimpan rencana dan contoh; jangan mengimplementasikan, menjadwalkan, atau mengirim laporan.

Default rancangan yang belum merupakan aktivasi: tanggal 1 pukul 06.00 WIB, untuk bulan kalender sebelumnya; publikasi ke arsip aplikasi. Distribusi email merupakan konfigurasi terpisah yang membutuhkan penetapan penerima.

## 2. Klarifikasi bisnis yang wajib dipertahankan

### Checksheet manpower bukan output fisik

Pengguna menegaskan bahwa `ProductionReport` menyimpan checksheet pekerjaan manpower (manpower pcs) sebagai dasar penggajian.

Contoh:

- Sepuluh barang dikerjakan dua orang: masing-masing membuat record 10, sehingga ada 20 pcs pekerjaan tetapi hanya 10 barang fisik.
- Sepuluh barang dikerjakan satu orang: ada 10 pcs pekerjaan dan 10 barang fisik.
- Kedua record pada contoh pertama sah. Jangan menghapusnya sebagai duplikasi, membagi jumlahnya berdasarkan perkiraan pekerja, atau menganggap jumlah checksheet sebagai output fisik.

Usulan awal yang memakai `ProductionReport.Qty` sebagai good output dan `NgQty / (Qty + NgQty)` sebagai NG rate produksi **dicabut**.

`NgQty` dan `StopMinute` pada checksheet juga tidak boleh otomatis dijumlahkan sebagai cacat fisik atau downtime line: beberapa pekerja dapat mencatat barang atau kejadian yang sama. Validasi checksheet tidak mengubah maknanya menjadi output produksi fisik.

### Poka-Yoke mewakili barang good selesai

Pengguna mengonfirmasi bahwa satu label/box sukses Poka-Yoke mewakili barang good yang sudah selesai, dengan qty aktual sesuai `QtyThisBox`.

| Informasi | Sumber konsep | Makna |
| --- | --- | --- |
| Pcs pekerjaan manpower | `ProductionReport` | Kredit pekerjaan tercatat/tervalidasi untuk dasar penggajian |
| Output good terverifikasi | Label unik sukses Poka-Yoke dan `LabelData.QtyThisBox` | Barang fisik selesai yang telah diverifikasi |
| Stok tercatat | `InventoryLedger` | Saldo administrasi persediaan |
| Pengiriman tercatat | `DeliveryHistory` | Kejadian pengiriman di sistem, bukan bukti penerimaan pelanggan |
| Rencana | `Forecast`, `ProductionRelease` | Kebutuhan pengiriman dan target release |

Waktu sukses Poka-Yoke pertama menentukan bulan output terverifikasi. Barang selesai Juli tetapi baru sukses scan Agustus dihitung sebagai output **terverifikasi Agustus**. Jangan mengklaim ini sebagai tanggal selesai fisik sebenarnya.

Label belum dipindai disebut "belum terverifikasi", bukan otomatis "belum diproduksi". Scan gagal adalah kejadian pemeriksaan, bukan jumlah barang NG.

## 3. Temuan kode dan batas pemeriksaan

Pemeriksaan dilakukan pada schema dan kode, bukan database operasional. Kelengkapan data aktual serta integrasi belum diverifikasi. Periksa ulang implementasi terkini sebelum mulai bekerja karena proyek dapat berubah.

Sumber yang sudah diperiksa:

- `apps/api/prisma/schema.prisma`: model transaksi, label, manpower, ledger, dan pengiriman.
- `apps/api/src/production/production-report/production-report.service.ts`: validasi checksheet.
- `apps/api/src/production/pokayoke/pokayoke.service.ts`: sukses scan mengklaim label yang belum scanned, menyimpan histori, dan menambah rekap release secara transaksional.
- `apps/api/src/production/production-release/production-release.service.ts`: progres good menggunakan label scanned dan `QtyThisBox`.
- `apps/api/src/production/shopping/shopping.service.ts`: stok FG/ledger `PRODUCTION_RESULT` dapat bertambah ketika shopping material lengkap, memakai qty forecast.
- `apps/api/src/production/delivery/delivery.service.ts`: pengiriman per label dan pengurangan saldo FG.
- `apps/api/src/frontend/entities/dashboard-response.entity.ts`: dashboard yang diperiksa berisi ringkasan master dan tren transaksi.
- `apps/api/src/report/report.controller.ts`: ekspor Excel dan rekonsiliasi yang tersedia saat pemeriksaan.

Konsekuensi: saldo FG tidak sama dengan barang siap kirim. Ledger tetap sumber kebenaran **stok tercatat**, tetapi bukan sumber KPI output fisik terverifikasi. Rencana BI tidak mengubah alur stok atau payroll secara diam-diam.

## 4. Dashboard yang direncanakan

### A. Ringkasan manajemen

Enam KPI awal:

1. Output good terverifikasi bulan ini.
2. Pencapaian target kelompok release yang dijadwalkan bulan tersebut.
3. Kuantitas pengiriman tercatat.
4. Backlog pengiriman sampai akhir bulan.
5. Jumlah material di bawah minimum yang sudah dikonfigurasi.
6. Persentase checksheet manpower tervalidasi.

Tampilkan perubahan bulanan, tren enam bulan, cakupan data, dan tautan ke transaksi sumber. Tidak ada penilaian merah/hijau berbasis target yang belum disepakati.

### B. Produksi dan kesiapan pengiriman

- Tren output good terverifikasi per hari/part.
- Target release dibandingkan qty label terverifikasi dari release yang sama.
- Label belum terverifikasi pada release aktif, diprioritaskan menurut tenggat.
- Qty label terverifikasi belum dikirim sampai cutoff.
- Kelengkapan shopping per kebutuhan material BOM.

Output bulanan mencakup semua sukses verifikasi pada bulan tersebut. Capaian release memakai kelompok release yang direncanakan bulan tersebut dan verifikasi sampai cutoff; tampilkan kontribusi release bulan sebelumnya secara terpisah.

Progres material dinilai per item: surplus satu material tidak menutup kekurangan item lain. Jangan menjadikan penjumlahan qty lintas material sebagai persentase kesiapan.

### C. Persediaan dan pengiriman

- Stok tercatat akhir bulan per part/lokasi.
- Material di bawah minimum atau di atas maksimum yang sudah dikonfigurasi.
- Material tanpa pemakaian tercatat selama periode pengamatan; bukan umur batch fisik.
- Selisih opname dan temuan rekonsiliasi.
- Kebutuhan jatuh tempo, pemenuhan sampai tenggat, backlog dan umur keterlambatan.
- Saldo FG dan qty terverifikasi belum dikirim ditampilkan terpisah. Selisihnya adalah temuan untuk ditelusuri, bukan otomatis WIP atau kehilangan.

Ketepatan pengiriman awal disebut "pemenuhan pengiriman tercatat sesuai jadwal". Jangan menyebutnya OTIF pelanggan tanpa bukti penerimaan pelanggan.

### D. Administrasi manpower

- Pcs pekerjaan tercatat dan tervalidasi, dengan satuan eksplisit **pcs pekerjaan**.
- Checksheet belum divalidasi dan umur antrean validasinya.
- Jumlah manpower dengan checksheet pada periode tersebut.
- Distribusi pekerjaan per part tanpa menyimpulkan produktivitas fisik individu.

PDF menggunakan agregat; rincian orang mengikuti hak akses. Nilai upah memerlukan aturan tarif/kerja bersama yang belum ditetapkan dalam rencana ini.

### E. Poka-Yoke dan kualitas data

- Percobaan scan sukses/gagal.
- Label unik pernah gagal, kemudian berhasil, atau masih belum berhasil sampai cutoff.
- Histori sukses tanpa hubungan/waktu verifikasi yang andal.
- Checksheet belum tervalidasi, relasi data tidak lengkap, parameter stok belum diisi.

NG rate fisik, yield, Pareto cacat produksi, dan OEE ditunda sampai ada data yang tepat.

## 5. Aturan lintas KPI

- Periode kalender menggunakan Asia/Jakarta; query rentang awal inklusif dan awal bulan berikutnya eksklusif.
- Sukses verifikasi dihitung sekali per identitas label, bukan per jumlah percobaan scan.
- Qty box parsial memakai `QtyThisBox`, bukan kapasitas standar box.
- Label scanned tanpa histori waktu sukses yang andal menjadi pengecualian; jangan mengarang tanggalnya.
- Snapshot menjaga qty, identitas/dimensi yang diperlukan, definisi KPI, cutoff, dan versi perhitungan agar perubahan master tidak mengubah laporan terbit.
- Stok akhir direkonstruksi dari ledger sampai cutoff dengan pemeriksaan saldo pembuka dan rekonsiliasi; jangan memakai cache stok sekarang untuk bulan lampau.
- Transfer internal tidak dihitung sebagai konsumsi total perusahaan.
- Backlog memperhitungkan kebutuhan jatuh tempo yang belum terpenuhi, termasuk tunggakan sebelumnya. Pengiriman harus dialokasikan ke kebutuhan/forecast terkait, bukan sekadar total bulan.
- Qty berbeda satuan tidak dijumlahkan. Rasio agregat memakai total pembilang/penyebut, bukan rata-rata persentase.
- Data tidak tersedia atau penyebut nol ditampilkan sebagai N/A dengan penjelasan, bukan nol palsu.
- Perubahan persen dibedakan dari perubahan poin persentase.
- Filter bulan/part/lokasi hanya diterapkan pada metrik yang mendukung dimensi tersebut. Histori line/shift menunggu snapshot penugasan saat transaksi.

## 6. Susunan PDF

Default 12 halaman, opsional lampiran hingga total 14 halaman.

| Halaman | Isi |
| --- | --- |
| 1 | Sampul, periode, tanggal terbit, sorotan |
| 2 | Ringkasan eksekutif: enam KPI, tiga temuan, tiga prioritas |
| 3 | Perbandingan bulan lalu dan tren enam bulan |
| 4 | Output good terverifikasi per hari/part |
| 5 | Pencapaian release dan sisa belum terverifikasi |
| 6 | Pengiriman, pemenuhan jadwal, backlog |
| 7 | Stok tercatat dan risiko material |
| 8 | Kesiapan material, incoming, additional shopping |
| 9 | Poka-Yoke dan pengecualian pemeriksaan |
| 10 | Checksheet manpower dan kesiapan administrasi penggajian |
| 11 | Opname, rekonsiliasi, kualitas data dan definisi penting |
| 12 | Prioritas berikutnya dan tindak lanjut |
| Opsional | Kamus KPI, cutoff, cakupan dan rincian pengecualian |

Tiap halaman analisis menggabungkan grafik/tabel ringkas, interpretasi, dan tindakan. Hindari tabel transaksi panjang. Gunakan desain navy-teal, tipografi jelas, footer, nomor halaman, serta grafik yang tetap tajam saat dicetak.

### Contoh yang sudah dibuat

[ANSEI dalam 1 Bulan - Agustus 2026, 12 halaman](../output/pdf/ANSEI-dalam-1-Bulan-Contoh-Agustus-2026.pdf)

Seluruh angka, part, temuan, PIC dan tenggat pada PDF tersebut adalah **simulasi**. File sudah dirender dan diperiksa secara visual pada seluruh halaman. Contoh ini adalah referensi bentuk, bukan template aplikasi yang sudah terintegrasi dan bukan bukti data operasional.

Contoh rekonsiliasi angkanya: output terverifikasi 48.600 = 48.000 dari release Agustus + 600 dari release sebelumnya; target release 50.000; capaian 96%; backlog 4.000 + kebutuhan baru 47.200 - pemenuhan 46.800 = 4.400.

## 7. Tambahan data dan fitur bertahap

| Tahap | Tambahan | Manfaat |
| --- | --- | --- |
| Awal | Snapshot bulanan, versi laporan, target KPI dan definisi metrik | Konsistensi historis dan audit |
| Awal | Tindak lanjut: masalah, PIC bagian, tenggat, status, hasil | Penyelesaian masalah antarbulan |
| Berikutnya | Waktu selesai fisik per batch/box, terhubung label | Pisahkan selesai produksi dari waktu verifikasi |
| Berikutnya | Kejadian cacat unik: batch/part, qty, jenis, scrap/rework, hasil | NG fisik dan analisis kualitas tanpa hitung ganda |
| Berikutnya | Downtime unik per line/mesin: mulai/selesai, alasan, planned/unplanned | Waktu kehilangan operasional yang sah |
| Berikutnya | Snapshot line/shift, jam kerja, ideal cycle time | Produktivitas dan OEE |
| Berikutnya | Penugasan proses/batch dan standar pekerjaan manpower | Analisis beban kerja sesuai proses |
| Lanjutan | Tarif efektif, aturan kerja bersama, koreksi/persetujuan | Estimasi dan rekonsiliasi upah |
| Lanjutan | Janji supplier, penerimaan aktual dan inspeksi | Kinerja supplier |
| Lanjutan | Pengiriman fisik, penerimaan pelanggan, qty diterima/ditolak | OTIF pelanggan |
| Lanjutan | Harga/biaya historis dan metode valuasi | Nilai persediaan dan biaya kualitas |
| Lanjutan | Batch/lot, tanggal penerimaan dan jejak pemakaian | Umur fisik stok dan traceability |

Data selesai fisik baru harus dihubungkan ke label agar tidak menghitung barang dua kali. Harga FG sekarang belum cukup untuk menyatakan omzet, laba, atau kerugian aktual.

## 8. Alur publikasi otomatis dan GPT

1. Scheduler menyiapkan periode bulan sebelumnya pada waktu yang dikonfigurasi.
2. ANSEI menghitung KPI deterministik dan menjalankan pemeriksaan kualitas data.
3. Simpan snapshot konsisten beserta versi definisi dan cutoff.
4. Kirim hanya agregat yang diizinkan ke GPT untuk sorotan, perubahan, dan rekomendasi.
5. Validasi narasi terhadap angka sumber. GPT tidak menghitung ulang KPI, mengubah angka, atau mengarang akar masalah.
6. Gunakan template jika GPT gagal atau validasi narasi gagal.
7. Render PDF, simpan versi terbit, tampilkan pada arsip aplikasi.

Pisahkan fakta, hipotesis yang perlu diperiksa, dan rekomendasi. Jangan mengaitkan perubahan output dengan kinerja individu tanpa bukti.

KPI yang tidak andal ditandai tidak tersedia beserta sebabnya. Laporan final tidak berubah diam-diam; koreksi membuat revisi baru. Retry harus idempoten agar tidak menerbitkan laporan ganda. Kegagalan pembuatan PDF ditampilkan sebagai kegagalan proses, bukan keberhasilan publikasi.

## 9. Arah implementasi nanti

Urutan: **definisi KPI dan kualitas data -> dashboard -> PDF otomatis dan GPT -> pencatatan BI lanjutan**.

Tambahan antarmuka: Management Insight, arsip PDF, konfigurasi target, tindak lanjut, serta status proses pembuatan laporan.

Backend menyediakan perhitungan KPI bersama, snapshot, status pembuatan, dan unduhan sesuai hak akses. Frontend mengikuti typed Redux thunks dan utilitas autentikasi yang sudah ada. Ikuti audit convention untuk setiap write dan jangan mengubah stok sebagai efek samping perhitungan BI.

Belum menetapkan route, DTO, model/migrasi, provider/model GPT, library renderer aplikasi, atau worker/scheduler final. Tentukan detail teknis tersebut setelah membaca ulang repository dan skills ketika implementasi diminta. Script pembuat contoh PDF bukan pilihan arsitektur produksi.

Patuhi AGENTS.md serta skills API, response, Prisma, inventory, security, frontend, quality, dan versioning yang berlaku pada lingkup implementasi. Perubahan schema harus menjadi lingkup eksplisit; tidak ada migrasi atau perubahan schema yang dilakukan untuk menyimpan rencana ini.

## 10. Skenario penerimaan

- 10 barang / 2 manpower: 20 pcs pekerjaan, 10 output terverifikasi setelah sukses scan.
- 10 barang / 1 manpower: 10 pcs pekerjaan, 10 output terverifikasi.
- Label gagal lalu sukses: kegagalan tersimpan, output dihitung sekali.
- Sukses scan berulang/concurrent tidak menambah output.
- Shopping lengkap tanpa sukses Poka-Yoke tidak menambah KPI output terverifikasi.
- Box parsial menggunakan qty aktual label.
- Scan, pengiriman, dan release lintas bulan masuk kelompok/periode yang benar.
- Label scanned tanpa waktu sukses yang andal masuk pengecualian.
- NG/stop minute checksheet tidak menjadi KPI cacat/downtime fisik.
- Uji batas bulan WIB, backlog lama, pengiriman parsial, pembanding kosong, penyebut nol, serta satuan berbeda.
- Stok akhir dapat direkonsiliasi tanpa menggandakan transfer internal.
- Dashboard dan PDF cocok pada snapshot/filter yang sama.
- Histori tetap konsisten setelah master/transaksi berubah; koreksi menghasilkan versi baru.
- Retry tidak menghasilkan publikasi ganda; kegagalan GPT memakai template.
- Narasi tidak mengarang angka, sebab, nama, atau komitmen PIC.
- Hak akses mengontrol rincian manpower, laporan, dan unduhan.
- PDF diperiksa visual: tidak terpotong, grafik terbaca, periode/footer/nomor halaman benar.

## 11. Referensi konsep

- ASCM, pemahaman OTIF dan KPI warehouse: https://www.ascm.org/ascm-insights/8-kpis-for-an-efficient-warehouse/
- OEE, kebutuhan planned production time dan ideal cycle time: https://www.oee.com/calculating-oee/

Referensi eksternal memberi konteks metrik; klarifikasi bisnis pengguna dan kode ANSEI tetap menentukan makna data sistem.
