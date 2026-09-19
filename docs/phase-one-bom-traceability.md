# Fase 1 — BOM historis dan traceability PO

Versi aplikasi: **2.0.0**. Tanggal pemeriksaan: 19 September 2026.

Implementasi menambahkan revisi BOM dengan persetujuan terpisah, snapshot permanen per PO/release, kasus NG material, pengeluaran pengganti bertahap, dan traceability tingkat dokumen/PO. Lot material tidak ditambahkan. Hubungan label dengan material tetap hubungan pada tingkat PO, bukan bukti konsumsi suatu material pada suatu box.

## Perubahan yang tersedia

| Area | Perilaku |
| --- | --- |
| BOM | Draft, edit dengan version check, submit, approve/activate, reject dengan alasan, cancel draft, copy, import baseline saat ini, comparison, approval history, daftar snapshot pemakai |
| Persetujuan | Pembuat dan editor terakhir tidak boleh approve, termasuk pengguna berhak luas. Draft dengan dasar revisi aktif yang berubah harus ditinjau/disimpan kembali. Comparison draft menggunakan BOM aktif saat ini. |
| Snapshot | Dibuat dalam transaksi release; amendment kuantitas menyimpan versi baru dengan revisi lama; PO tambahan memakai revisi aktif. Aktivitas shopping/assembly/scan mencegah penggantian struktur snapshot. |
| Operasional | Shopping, readiness assembly/Poka-Yoke, delivery, release requirements, dan MRP untuk PO dirilis memakai snapshot. Permintaan belum dirilis memakai proyeksi BOM aktif. |
| NG material | PO, tahap, dan alasan wajib. Material dipilih dari snapshot; pilihan set di FE diuraikan menjadi komponen dan dapat dikurangi saat peninjauan. Deklarasi NG tidak memotong rak. |
| Pengganti | Setiap issue memiliki request ID. Stok, ledger, shopping, command, audit, dan trace disimpan atomik. Pengganti tidak memenuhi kebutuhan standar atau membuat FG, target, label, maupun shopping completion tambahan. |
| Penutupan | Release tidak dapat ditutup selama ada kasus dengan kebutuhan pengganti terbuka. Cancel kasus hanya sebelum pengeluaran; setelah issue, sisa dapat ditutup dengan alasan. |
| Nonproduksi | Tanpa PO, tujuan dan alasan wajib; konsumsi tidak masuk tabel pemakaian PO. |
| Histori | Snapshot, baris snapshot, event revisi, dan trace event dilindungi trigger append-only. BOM approved tidak dapat diubah. Relasi historis memakai FK restrict. |
| Identitas | Nomor/nama/unit material dibekukan dalam snapshot. Hubungan pemakaian memakai snapshot line dan identitas material sehingga perubahan nomor material tidak menghapus kaitan historis. |
| Legacy | REGULER lama menjadi STANDARD tanpa snapshot palsu; ADDITIONAL lama menjadi LEGACY_UNCLASSIFIED. Tidak ada rekonstruksi BOM lama, lot awal, atau perubahan saldo stok. |

`ProductionReport.NgQty` tetap NG barang jadi. Nilainya tidak ditambahkan ke NG komponen. Rework FG selesai, pembongkaran, dan return pelanggan belum termasuk fase ini.

## FE dan kontrak API

Sidebar, shell aplikasi, breadcrumb, toolbar, tabel kecil Ant Design, dan alur scanner existing dipertahankan. Satu menu utama baru adalah **Traceability**. BOM mendapat halaman detail revisi; NG Replacement berada di bawah Shopping. Detail release mendapat panel PO & BOM, Materials, dan History di dalam layout existing. Shortcut ditambahkan pada Assembly, Production Report, Pre-delivery/Label, dan Delivery.

Daftar revisi, daftar kasus, pencarian traceability, dan timeline menggunakan pagination server. Semua akses bisnis FE melalui typed Redux thunk dan authenticated utility existing. Waktu pada halaman baru ditampilkan dalam Asia/Jakarta.

Endpoint tetap `/v1` dengan envelope existing dan DTO Swagger. Kelompok baru:

- `/master/bom-revisions`, detail, compare, submit, approve, reject, cancel.
- `/production/production-release/:id/bom-snapshots`.
- `/production/material-ng-cases`, candidates, detail, issue, close.
- `/traceability/search`, `/traceability/forecasts/:poId`, dan `/events`.

**Breaking change:** mutasi pada kedua jalur BOM lama (`/master/bill-of-materials` dan `/master/finish-good/bill-of-materials`) ditolak dengan `BOM_REVISION_REQUIRED`. GET lama tetap menjadi proyeksi revisi aktif. Komponen dan thunk mutasi BOM langsung lama dihapus dari FE.

Edit draft BOM membutuhkan `expectedVersion` serta `expectedActiveRevisionId` yang dilihat saat review (null untuk baseline pertama). Perubahan BOM aktif antara review dan save menghasilkan conflict, sehingga save tidak melakukan rebase diam-diam.

Shopping create membutuhkan `requestId` UUID dan `purpose`. STANDARD memakai REGULER dengan PO; NON_PRODUCTION memakai ADDITIONAL tanpa PO dengan destination/description. NG_REPLACEMENT hanya melalui endpoint issue kasus. Requirement dan status shopping memisahkan standardRequired, standardIssued, replacementIssued, materialNg, dan remainingReplacement. Client harus mempertahankan request ID ketika mengulang payload yang sama; perubahan payload membutuhkan ID baru.

## Cutover — belum dieksekusi pada database operasional

1. Selesaikan seluruh release aktif dan hentikan transaksi sementara. Ambil backup sesuai prosedur operasional. Pastikan tidak ada status RELEASED sebelum perpindahan; versi baru sengaja tidak merekonstruksi BOM release lama.
2. Terapkan dua migration baru dengan prosedur deployment repository: `20260919090000_bom_traceability` dan `20260919100000_bom_history_guards`. Generate Prisma client dari schema yang sesuai dan deploy API/web 2.0.0 bersama.
3. Sinkronkan katalog SSO, role lokal, dan API key secara terpisah. Seed permission lokal sudah memuat izin baru; belum dijalankan terhadap database operasional.
4. Melalui Bill of Materials, buat draft baseline dari BOM existing menggunakan **import current legacy BOM** dan alasan bertanggal saat ini. Periksa komponen, submit, lalu minta pengguna berbeda approve. Baseline bukan BOM historis PO lama.
5. Setelah seluruh FG yang akan diproduksi memiliki revisi aktif, jalankan uji penerimaan dengan akun operator, maker, dan approver. Baru buka kembali release/transaksi.
6. Setelah transaksi baru tersimpan, gunakan forward fix. Jangan menjalankan kembali aplikasi lama yang mengabaikan purpose dan snapshot.

Permission baru: `IPCS.BOM_REVISION_{READ,CREATE,UPDATE,SUBMIT,APPROVE}`, `IPCS.MATERIAL_NG_{READ,CREATE,ISSUE,CLOSE}`, dan `IPCS.TRACEABILITY_READ`.

Pemetaan role perlu menyertakan izin baca yang digunakan layar operasional: pengguna pembuat BOM juga memerlukan MASTER_READ untuk memilih FG/material; operator NG memerlukan MATERIAL_NG_READ dan izin shopping/release yang sesuai akses menu existing. Approval berbeda orang tetap diperiksa oleh service, bukan hanya tombol FE.

Tidak ada deployment, migration database operasional, pemberian hak akses SSO, pengiriman email, ataupun pengujian printer fisik yang dilakukan dalam pekerjaan ini.

## Bukti pemeriksaan

| Pemeriksaan | Hasil |
| --- | --- |
| `pnpm prisma:validate` | Lulus |
| `pnpm prisma:generate` | Lulus; client dihasilkan oleh Prisma, tidak diedit manual |
| `pnpm lint` | Exit 0; API, web, dan printer |
| `pnpm build` | Exit 0; API, web, dan printer |
| `pnpm --filter @ansei/api exec jest --runInBand --forceExit` dengan NODE_OPTIONS=--experimental-vm-modules | Suite penuh: 79 suite lulus, 757 tes lulus; 12 tes dilewati, termasuk 8 tes PostgreSQL yang membutuhkan opt-in |
| Suite terfokus: `phase-one.database.spec.ts` + `phase-one-permissions.spec.ts` + `phase-one-validation.spec.ts` | 16 tes lulus: 8 PostgreSQL, 4 akses HTTP langsung, dan 4 validasi input |
| Suite terfokus terakhir: `forecast.service.spec.ts` | 28 tes lulus; termasuk penolakan perubahan identitas PO setelah snapshot, sebelum mutasi label. Lint terfokus dan build API setelah perubahan ini juga lulus. |
| Fresh migration PostgreSQL 16 disposable | Seluruh 40 migration diterapkan berhasil |
| `pnpm --filter @ansei/api exec node test/phase-one-migration-check.cjs` | Upgrade dari schema lama dengan contoh data legacy lulus; saldo tetap, tujuan ADDITIONAL tidak ditebak, snapshot historis tidak dibuat |
| `git diff --check -- . ':(exclude)apps/api/src/generated/prisma/**'` | Lulus untuk perubahan source |
| `git diff --check` penuh | Menemukan whitespace pada komentar client keluaran generator Prisma; tidak diedit manual |

Uji PostgreSQL memakai `PHASE1_DATABASE_TEST=1`, DATABASE_URL database lokal disposable bernama `ansei_phase1`, dan flag Node di atas. Uji migration upgrade memakai `PHASE1_MIGRATION_DATABASE_URL` untuk database kosong lokal `ansei_phase1_upgrade`; script menolak database lain atau database yang sudah berisi tabel. Tidak menggunakan koneksi operasional dari `.env` untuk uji upgrade.

Skenario PostgreSQL meliputi: maker/editor dilarang approve, approval bersamaan pada revisi yang sama dan dua draft berbeda, PO lama tetap memakai revisi lama, PO tambahan memakai revisi baru, versi snapshot amendment, penolakan perubahan bukti historis, shopping standar dengan retry, NG tanpa potong stok, replacement bertahap dan konkurensi, target/FG/label/completion tidak bertambah, nonproduksi tanpa PO, perubahan nomor material, dan rollback snapshot bila ada PO tanpa BOM disetujui.

Tes HTTP langsung membuktikan request tanpa permission ditolak sebelum service dijalankan; pengguna trace reader dapat mencari trace tetapi tidak dapat approve BOM. Tes ini menguji guard lokal, bukan koneksi SSO live.

**UAT visual dan operasional masih diperlukan.** Pembukaan halaman lokal melalui browser diarahkan ke login SSO, sehingga form interaktif, layar operasional, dan alur akun nyata belum diverifikasi secara visual. Build/typecheck/lint FE lulus, namun tidak menggantikan UAT tersebut. Periksa khusus comparison banyak komponen, pemilihan BOM set, partial fulfillment, deep link label, pagination, serta role/API key setelah sinkronisasi SSO.
