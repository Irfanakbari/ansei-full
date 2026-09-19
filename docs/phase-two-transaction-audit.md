# Fase 2 — Pengulangan transaksi dan audit tindakan

Implementasi kode: **3.0.0**. Database operasional, deployment, dan katalog SSO belum diubah.

Tujuan perubahan ini adalah mencegah pengulangan mutasi karena respons hilang atau permintaan dikirim ulang, serta menyediakan bukti perubahan data yang terhubung ke proses dan permintaan. Pola desain FE tetap menggunakan halaman, toolbar, tabel kecil, dan modal terpusat yang ada. Tidak ada perubahan tema, sidebar utama, atau alur scanner utama.

## Kontrak transaksi

| Operasi | Identitas dan perilaku |
| --- | --- |
| Transfer gudang ke rak | `requestId` UUID wajib dalam body. Command, dua ledger, cache stok, dan penyelesaian proses berada dalam satu transaksi. Replay mengembalikan saldo hasil transaksi pertama. Kuantitas harus integer positif; cache kedua lokasi diperiksa terhadap ledger. |
| Receive incoming | Header `Idempotency-Key` UUID wajib. Receipt yang sudah ditutup tetap dapat di-replay dengan identitas, payload, dan actor yang sama tanpa menambah stok lagi. |
| Create/edit/submit/approve/reject/cancel BOM revision | Header `Idempotency-Key` UUID wajib. Replay tidak membuat revisi atau approval event baru. Pemeriksaan versi dan pemisahan maker/approver tetap berlaku untuk tindakan baru. |
| Create production report | Header `Idempotency-Key` UUID wajib. Report, trace event, command, dan audit penyelesaian tersimpan bersama. Endpoint sekarang membutuhkan autentikasi dan `IPCS.PRODUCTION_REPORT_CREATE`. |
| Shopping dan kasus NG | Fondasi command Fase 1 dipertahankan; replay kini dicatat dalam audit. Identitas body dipertahankan oleh transport FE bahkan ketika form dimuat ulang setelah respons hilang. |
| Assembly, Poka-Yoke, delivery, release, forecast, stock opname | Pengamanan identitas dokumen/status/locking existing tetap berlaku. Perubahan datanya mendapat audit baru. Perubahan ini tidak mengganti seluruh endpoint tersebut menjadi kontrak replay HTTP dengan hasil tersimpan. |

`BusinessCommand` tetap unik menurut scope dan request ID. Penggunaan ulang untuk payload atau actor berbeda ditolak. Hasil yang telah selesai tidak boleh diganti atau dihapus melalui DML biasa. Command lama yang tidak mempunyai hasil tidak dieksekusi ulang secara spekulatif: perlu rekonsiliasi.

Retry transaksi inventory hanya dilakukan untuk konflik serialisasi Prisma `P2034`, maksimal tiga percobaan. Error bisnis, koneksi ambigu, atau kegagalan side effect tidak memicu retry generik. Percobaan serialisasi yang gagal dicatat sebagai `RETRY` beserta nomor percobaan dan apakah akan dicoba lagi. Total kuantitas penerimaan direset setiap percobaan agar tidak terakumulasi.

Pada browser, session storage menyimpan hash payload dan UUID command, bukan isi payload. Identitas dipertahankan sampai respons sukses berhasil dibaca. Setelah sukses, tindakan baru mendapat identitas baru. Tidak ada loop retry otomatis untuk POST/PATCH. Identitas ini berlaku pada tab/browser yang sama; pemulihan lintas perangkat tetap membutuhkan identitas command asli dari pemanggil.

## Audit yang ditambahkan

Model `ActionAuditEvent` menyimpan sumber dokumen, ID sumber, tindakan, actor, asal atribusi, request ID, process ID, nilai sebelum/sesudah yang diizinkan, dan waktu. `LogProcess` mempunyai relasi ke event audit tersebut.

Trigger PostgreSQL mencatat INSERT/UPDATE/DELETE pada:

- InventoryLedger, Material, FinishGood.
- Incoming dan IncomingMaterial.
- Forecast, ProductionRelease, LabelData, AssemblySession, DeliveryHistory.
- ProductionReport, Shopping, MaterialNgCase, MaterialNG.
- BomRevision dan BomRevisionLine.
- StockOpname dan StockOpnameDetail.
- LogProcess dan BusinessCommand.

Trigger hanya menyalin kolom operasional yang dipilih dalam migration: kuantitas, saldo, status, versi, dan referensi. Nama, kredensial, signature, payload lengkap, dan catatan bebas tidak disalin ke event baru. Alasan BOM/NG tetap disimpan pada dokumen dan histori domain Fase 1, bukan ditebak dari audit baru. LogProcessDetail lama tetap dapat dibaca; perubahan ini tidak membersihkan atau menulis ulang pesan historisnya.

Penulisan melalui transaksi dan penulisan tunggal layanan operasional membawa konteks request menggunakan AsyncLocalStorage dan pengaturan PostgreSQL lokal transaksi. Pengaturan tersebut tidak dibiarkan menempel pada koneksi pool setelah commit/rollback. Untuk INSERT tanpa konteks, actor hanya diambil dari creator yang benar-benar tersimpan. UPDATE/DELETE tanpa konteks diberi `UNATTRIBUTED`; creator lama tidak dianggap sebagai pelaku perubahan baru.

Audit perubahan data ikut rollback ketika perubahan sumber gagal. Event audit dan LogProcessDetail dilindungi dari UPDATE/DELETE. Proses yang sudah selesai tidak dapat diubah kembali menjadi gagal karena error yang terjadi kemudian. ID proses dan pesan menggunakan UUID agar tidak bergantung pada counter satu proses aplikasi.

Filter error API mencatat kegagalan mutasi serta penolakan akses dengan route template dan status. Query string, body, dan exception mentah tidak disalin. Kegagalan penyimpanan audit error saat database tidak tersedia dicatat sebagai kegagalan storage dan tidak menutupi error asli. Ini berbeda dari audit perubahan data melalui trigger: bila trigger gagal, mutasinya ikut gagal.

Perlindungan database ini berlaku untuk DML normal. Ini bukan tanda tangan kriptografis atau perlindungan terhadap administrator database yang dapat menonaktifkan trigger.

## API, permission, dan FE

Endpoint baru: `GET /v1/system-log/actions`, menggunakan envelope dan pagination existing serta permission `IPCS.SYSTEM_LOG_READ`.

Filter: `processId`, `requestId`, `sourceType`, `sourceId`, `action`, `from`, `to`, `page`, `limit`. Urutan stabil berdasarkan waktu dan ID. Tidak ada endpoint edit/delete audit.

System Log mendapat tab **Process Logs** dan **Action Audit**. Tab audit menampilkan waktu Jakarta, tindakan, sumber, referensi, actor, serta modal nilai sebelum/sesudah. Filter request, process, referensi dokumen, dan jenis tindakan menggunakan API. Loading, error, pagination, dan perlindungan terhadap respons pencarian yang terlambat tersedia.

Form laporan produksi dan operator station memakai thunk Redux serta authenticated utility existing. Tombol simpan stasiun menawarkan login jika sesi belum tersedia dan memeriksa permission dari provider SSO. Pemilihan operator dalam laporan tidak diklaim sebagai bukti bahwa operator tersebut adalah pemilik sesi SSO: actor mencatat akun/stasiun yang mengirim.

Katalog permission dalam repository ditambah `IPCS.PRODUCTION_REPORT_CREATE`. Pengalokasian permission tersebut pada role/stasiun dan API key, serta sinkronisasi katalog SSO, merupakan langkah rollout terpisah. Tidak ada bypass untuk endpoint laporan produksi anonim.

## Migrasi dan rollout

Migration additive: `apps/api/prisma/migrations/20260919110000_transaction_action_audit/migration.sql`.

1. Jadwalkan pembaruan bersama API/web karena kontrak transfer, BOM, receive, dan laporan produksi berubah.
2. Persiapkan permission pembuatan laporan pada role/stasiun yang diperlukan; verifikasi login stasiun.
3. Terapkan migration melalui prosedur deployment pada database yang telah diverifikasi dan dibackup.
4. Deploy API/web 3.0.0 bersama, kemudian uji transaksi dan replay menggunakan akun berizin.
5. Verifikasi Action Audit, penolakan akses, serta hasil stok dan dokumen.

Tidak ada backfill audit, perubahan saldo awal, atau rekonstruksi actor/histori lama. Command/proses lama yang sudah selesai ikut terlindungi. Jangan menghapus command untuk mencoba ulang transaksi yang hasilnya belum jelas. Gunakan rekonsiliasi dan forward fix setelah transaksi versi baru masuk.

## Bukti pemeriksaan

Seluruh PostgreSQL berikut menggunakan container disposable lokal, bukan `.env` database operasional.

| Pemeriksaan | Hasil |
| --- | --- |
| `pnpm prisma:generate` | Lulus; client dihasilkan oleh Prisma, tidak diedit manual. |
| `pnpm prisma:validate` | Lulus. |
| `pnpm --filter @ansei/api exec prisma migrate deploy` | Lulus pada database kosong; seluruh 41 migration diterapkan. |
| `pnpm --filter @ansei/api exec node test/phase-two-migration-check.cjs` | Lulus upgrade dari skema Fase 1, saldo/hasil lama tetap, tanpa audit historis buatan. Menggunakan `PHASE2_MIGRATION_DATABASE_URL` khusus disposable. |
| `pnpm --filter @ansei/api exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` | Exit 0, tidak ada perbedaan. |
| `pnpm --filter @ansei/api exec jest --runInBand --forceExit` dengan `NODE_OPTIONS=--experimental-vm-modules` | 80 suite / 763 test lulus pada run regresi; suite DB opt-in dijalankan terpisah. |
| `jest src/system-log/phase-two.database.spec.ts --runInBand --forceExit` dengan `PHASE2_DATABASE_TEST=1` | 9 test PostgreSQL lulus: transfer, concurrency/overdraw, rollback, BOM replay, histori immutable, filter audit, lost response, receive, dan report concurrent. |
| `jest src/traceability/phase-one.database.spec.ts --runInBand --forceExit` dengan `PHASE1_DATABASE_TEST=1` | 8 test PostgreSQL regresi Fase 1 lulus dengan migration baru. |
| `jest src/system-log/phase-two-api.spec.ts --runInBand --forceExit` | 5 test akses langsung, validation, key, dan minimisasi data audit lulus; termasuk dalam run regresi. |
| `pnpm --filter @ansei/web exec node scripts/test-command-identity.mjs` | Lulus: key stabil, recovery setelah reload, identitas tindakan baru, tidak menyimpan payload, GET tanpa command, tidak ada blind retry. |
| `pnpm lint` | API, web, printer lulus. |
| `pnpm build` | API, web, printer lulus; build web diulang setelah penyesuaian transport/form. |
| `git diff --check -- . ':(exclude)apps/api/src/generated/prisma/**'` | Lulus. Generated Prisma mempunyai whitespace komentar hasil generator yang tidak diedit manual. |

Warning existing yang muncul: Next.js middleware convention, Node experimental VM modules, dan pg concurrent-query deprecation. Test menggunakan `--forceExit` karena pool/test handles existing. Tidak ada klaim bahwa SSO live, printer, email, ataupun UAT visual dengan sesi login telah diuji. Deployment dan migration database operasional belum dilakukan.
