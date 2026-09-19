# Fase 3 — Keandalan integrasi dan pemulihan transaksi

Versi: **4.0.0**. Implementasi API, web, dan worker printer selesai di workspace; deployment operasional belum dijalankan. Pola sidebar, halaman, toolbar, tabel, modal terpusat, dan scanner tetap dipertahankan. Monitoring ditambahkan sebagai tab **System Administration → System Logs → Integrations**.

## Hasil dan batas jaminan

- Niat pengiriman disimpan di PostgreSQL. Dispatcher mengunci perubahan status sebelum menerbitkan pekerjaan ke Redis, sehingga worker yang sangat cepat tidak melewatkan pekerjaan karena status belum siap.
- Identitas pekerjaan adalah event + nomor percobaan. Pembaruan status memeriksa status, nomor percobaan, timestamp, dan penanda tahap sebelumnya. Respons lama tidak boleh menyelesaikan percobaan yang lebih baru, termasuk saat timestamp sama hingga milidetik.
- Cetak otomatis dari shopping dan cetak manual Forecast menggunakan outbox. Cetak manual memerlukan `Idempotency-Key` UUID yang dipertahankan browser ketika respons hilang.
- Worker printer melakukan transaksi PostgreSQL sebelum mengirim ke perangkat: status pengiriman, LogProcess/LogProcessDetail, dan ActionAuditEvent dicatat atomik. Dua worker yang memproses pekerjaan sama tidak boleh sama-sama melewati batas pengiriman.
- Status cetak tidak menjadi SUCCEEDED hanya karena masuk antrean. Worker mencatat hasil transport setelah pengiriman selesai. Respons IPP yang tidak sukses ditolak; komunikasi IPP dan SMTP memiliki timeout.
- Gangguan sebelum pengiriman dapat dicoba ulang otomatis, dengan backoff 5 detik yang meningkat sampai 5 menit dan batas per event. Percobaan tidak direset ketika dipulihkan.
- Setelah pengiriman dimulai, hasil yang hilang/timeout/worker terputus menjadi **uncertain** dan tidak dikirim ulang otomatis. Operator harus memeriksa hasil eksternal dan menghentikan worker lama sebelum memutuskan retry.
- Retry manual memberikan izin **satu percobaan tambahan**. Alasan, actor, request ID, nomor percobaan yang diharapkan, hasil, serta perubahan status tercatat. Request pemulihan yang sama menghasilkan replay, bukan izin tambahan.
- Keberhasilan berarti transport menerima pengiriman. RAW TCP hanya membuktikan penyerahan byte ke koneksi; tidak membuktikan kertas tercetak. SMTP acceptance tidak membuktikan email dibaca atau terkirim ke seluruh mailbox. Tidak ada klaim exactly-once pada perangkat/provider eksternal.
- SUCCEEDED lama tanpa penanda hasil transport ditampilkan sebagai `LEGACY_UNVERIFIED`; tidak diberi bukti historis buatan.

## API dan akses

Semua endpoint berada di `/v1`, memakai envelope, validation dan autentikasi existing.

| Endpoint | Permission | Hasil |
| --- | --- | --- |
| `GET /system-log/integrations` | `IPCS.SYSTEM_LOG_READ` | Pagination server; filter status, tipe, reference ID; tidak mengembalikan payload/email recipients. |
| `GET /system-log/integrations/summary` | `IPCS.SYSTEM_LOG_READ` | Pending/queued/processing/failed/uncertain/exhausted, waktu event terbuka tertua, serta keterjangkauan kedua antrean Redis. |
| `POST /system-log/integrations/:id/recover` | `IPCS.INTEGRATION_RECOVER` | `RETRY`, `CONFIRM_DELIVERED`, atau `CLOSE`, dengan requestId UUID, expectedAttempts, alasan, dan konfirmasi rekonsiliasi bila diperlukan. |
| `POST /production/forecast/:id/print-tag` | `IPCS.FORECAST_UPDATE` | Memerlukan header `Idempotency-Key`; mengembalikan integrationId untuk pelacakan. |
| `POST /transfer-material/:id/send-dn/retry` | Permission existing | Ditolak dengan 409 `INTEGRATION_RECOVERY_REQUIRED`; arahkan pengguna ke pemulihan yang diaudit. |

Alasan tidak boleh hanya spasi; maksimal 500 karakter. Jangan memasukkan password, kredensial, penerima email, atau isi dokumen ke alasan. Gunakan referensi tiket/bukti pemeriksaan. Izin baru ada dalam katalog repository; pemetaan role/API key dan sinkronisasi SSO live belum dilakukan.

Tab Integrations menggunakan typed Redux thunks dan transport authenticated existing, dengan refresh, filter, pagination, loading/error/empty state, audit detail, serta dialog pemulihan terpusat. Tampilan sukses form email berarti permintaan telah dicatat, bukan klaim email sudah terkirim. Subject dan message form tersimpan dalam payload pengiriman; teks dimasukkan ke HTML dengan escaping.

## Penyimpanan dan audit

Tidak ada perubahan schema atau saldo stok pada Fase 3. Implementasi menggunakan OutboxEvent, BusinessCommand, LogProcess, LogProcessDetail dan ActionAuditEvent dari fase sebelumnya. Semua 41 migration existing tetap menjadi prasyarat.

`Attempts` menjadi jumlah percobaan kumulatif, termasuk claim yang gagal menerbitkan pekerjaan. `MaxAttempts` adalah batas kumulatif yang dapat diperluas melalui pemulihan berizin. `LastErrorCode` juga menyimpan penanda tahap internal, tanpa payload:

| Penanda | Perilaku |
| --- | --- |
| `OUTBOX_PREPARING` | Persiapan sebelum pengiriman eksternal. |
| `OUTBOX_PRINT_READY` | Worker printer boleh mengambil batas pengiriman atomik. |
| `OUTBOX_SENDING` | Batas pengiriman sudah tercatat; tidak boleh diulang otomatis. |
| `OUTBOX_SAFE_RETRY` | Gagal sebelum pengiriman; tunduk pada jadwal dan batas percobaan. |
| `OUTBOX_DELIVERY_UNCERTAIN` | Wajib rekonsiliasi. |
| `OUTBOX_DOCUMENT_CHANGED` | DN berbeda dari versi permintaan; buat permintaan baru setelah pemeriksaan. |
| `OUTBOX_TRANSPORT_ACCEPTED` | Hasil transport tercatat oleh pelaksana pengiriman. |
| `OUTBOX_MANUALLY_CONFIRMED` | Hasil dikonfirmasi operator berdasarkan bukti eksternal. |
| `OUTBOX_CLOSED` | Ditutup tanpa pengiriman lanjutan; status storage tetap FAILED, histori dipertahankan. |

Dispatcher memeriksa pekerjaan terputus setelah 10 menit. Pekerjaan yang masih aktif/menunggu di Redis tidak dipindahkan secara membabi buta. Nomor percobaan lama selalu ditolak worker baru. Kedua antrean diperiksa sebelum pemulihan manual. Redis yang tidak tersedia membuat tindakan pemulihan gagal aman, bukan mengabaikan pemeriksaan pekerjaan aktif.

Action Audit per event memuat perubahan status, jumlah/batas percobaan, penanda tahap, actor dan LogProcess. CREATE menghubungkan request awal; tahap worker dapat ditelusuri melalui SourceId event yang sama. Identitas actor worker adalah `SYSTEM:OUTBOX` atau `SYSTEM:PRINTER`, terpisah dari pembuat permintaan dan operator pemulihan. Histori audit tetap append-only sesuai perlindungan Fase 2.

Email DN diverifikasi terhadap fingerprint dokumen sebelum dan sesudah rendering. Ini tidak menyimpan arsip PDF immutable atau membuktikan master/template tidak berubah; snapshot berkas dan delivery receipt dari provider berada di luar klaim Fase 3. Perubahan DN yang terdeteksi menghentikan pengiriman versi lama.

## Panduan pemulihan

1. Buka Integrations dan refresh. Catat event ID, referensi dokumen, status, jumlah percobaan, serta auditnya. Ringkasan Redis hanya membuktikan akses antrean, bukan kesehatan printer/SMTP ataupun keberadaan worker yang memprosesnya.
2. Untuk antrean tidak tersedia, pulihkan Redis/jaringan lebih dahulu. Untuk pending/queued yang menua, periksa proses API dispatcher dan worker printer. Jangan menghapus event DB, command, atau mereset Attempts.
3. Untuk safe retry yang habis, perbaiki konfigurasi/template/koneksi, lalu pilih Retry dan isi alasan. Sistem mengizinkan satu percobaan tambahan; kegagalan berikutnya perlu keputusan baru.
4. Untuk uncertain, periksa spool/perangkat atau catatan SMTP/provider. Hentikan worker lama dan pastikan tidak ada pengiriman berjalan. Bila terbukti terkirim, pilih Confirm delivered. Bila diputuskan tidak akan dilanjutkan, pilih Close. Bila tidak terkirim atau bisnis menyetujui risiko pengiriman ulang, pilih Retry dan catat bukti/keputusan. Konfirmasi UI bukan pengganti pemeriksaan eksternal.
5. Jika pekerjaan masih active/waiting/delayed, pemulihan ditolak. Operasi TI perlu menyelesaikan/menghentikan pekerjaan tersebut sesuai kondisi sebenarnya, kemudian refresh dan ulangi keputusan. Jangan memaksa perubahan status lewat SQL.
6. Periksa hasil pada daftar dan audit. Pencetakan/email ulang tidak menjalankan ulang shopping, stok, FG, label generation, atau target PO.

Ambang awal pemeriksaan operasional: setiap uncertain perlu investigasi; exhausted perlu pemeriksaan konfigurasi; event terbuka lebih dari 10 menit perlu pemeriksaan worker/dependensi. Panel bersifat pull/refresh; pengiriman alert ke email/Slack atau sistem paging eksternal belum dikonfigurasi. Tetapkan PIC operasional pada deployment.

## Cutover dan pemulihan infrastruktur

1. Pada jeda produksi, inventarisasi antrean dan hasil lama. Hentikan penerbitan pekerjaan baru; selesaikan atau rekonsiliasi pekerjaan lama sebelum mengganti worker. Worker baru menolak pekerjaan legacy tanpa identitas outbox; jangan menjalankan worker lama dan baru bersamaan.
2. Pastikan migration Fase 1–2 sudah diterapkan melalui prosedur deployment dan backup yang diverifikasi. Fase 3 tidak mempunyai migration baru dan tidak menulis saldo awal.
3. Deploy API, web dan printer **4.0.0** bersama. Versi major diperlukan karena kontrak cetak manual, penghentian blind retry lama, dan protokol worker berubah.
4. Worker printer wajib memiliki DATABASE_URL yang benar dan izin transaksi pada OutboxEvent serta tabel audit/log. Jangan memakai account read-only. Redis harus memakai persistence dan kebijakan memori yang sesuai antrean; jangan membersihkan key sebagai langkah retry.
5. Sinkronkan permission `IPCS.INTEGRATION_RECOVER` ke katalog SSO dan role/API key yang tepat, lalu lakukan UAT dengan akun berizin dan tidak berizin.
6. Setelah transaksi baru masuk, gunakan forward fix. Jangan rollback ke worker yang mengabaikan tanda pengiriman atau menganggap queue enqueue sebagai sukses.
7. Setelah restore PostgreSQL/Redis, hentikan worker terlebih dahulu dan rekonsiliasi semua pengiriman yang mungkin terjadi setelah waktu backup. Restore dapat menghilangkan send fence yang dibuat setelah backup; jangan langsung memutar ulang antrean. RPO/RTO dan bukti restore infrastruktur produksi masih perlu ditetapkan/diuji oleh operasi TI.

Tidak ada deployment, migration database operasional, pengiriman email eksternal, cetak fisik, atau perubahan SSO live dalam pekerjaan ini.

## Bukti validasi

| Perintah / pemeriksaan | Hasil |
| --- | --- |
| `pnpm --filter @ansei/api exec prisma migrate deploy` pada PostgreSQL 16 disposable | 41 migration diterapkan pada database kosong. |
| `PHASE3_DATABASE_TEST=1 pnpm --filter @ansei/api exec jest src/common/outbox/phase-three.database.spec.ts --runInBand --forceExit` | 12 test PostgreSQL/Redis lulus: concurrent dispatcher, worker cepat, rollback, uncertain, replay pemulihan, konflik, manual print, stale timestamp/attempt, legacy, antrean hilang, active job, monitoring. |
| `PHASE3_DATABASE_TEST=1 pnpm --filter @ansei/printer exec jest src/phase-three.database.spec.ts --runInBand` | 4 test PostgreSQL lulus: competing workers, crash fence, stale receipt, ambiguous failure. |
| `pnpm --filter @ansei/api exec jest --runInBand --forceExit` dengan `NODE_OPTIONS=--experimental-vm-modules` | 83 suite / 776 test lulus. Suite database opt-in dijalankan terpisah; Fase 1–2 database tidak diulang pada Fase 3. |
| `pnpm --filter @ansei/api exec jest src/common/outbox src/common/printer --runInBand --forceExit` | 19 test terarah lulus setelah penyesuaian audit replay terakhir; 12 test database juga diulang dan lulus. |
| `pnpm --filter @ansei/printer exec jest --runInBand` | 4 suite / 9 test lulus; database opt-in terpisah. Termasuk socket TCP lokal dan IPP rejection simulasi. |
| SMTP transport dalam suite API | Dua test memakai SMTP sink localhost: accepted dan disconnect setelah DATA. Tidak memakai SMTP perusahaan. |
| `pnpm --filter @ansei/web exec node scripts/test-command-identity.mjs` | Lulus: key stabil setelah kehilangan respons, cetak manual, recovery thunk, tindakan baru, tanpa payload di storage dan tanpa blind HTTP retry. |
| `pnpm lint` | API, web, printer lulus. |
| `pnpm build` | API, web, printer lulus; API dan printer dibangun ulang setelah penyesuaian audit terakhir. |
| `pnpm --filter @ansei/web exec tsc --noEmit --pretty false` | Lulus. |
| `pnpm prisma:validate` | Lulus; schema tidak diubah pada Fase 3. |
| `pnpm --filter @ansei/api exec prettier ../../.github/workflows/ci-and-publish.yml --check` | Lulus parsing/format. Workflow diperbarui dengan service PostgreSQL/Redis disposable dan tes pemulihan; belum dijalankan di GitHub. |
| `git diff --check -- . ':(exclude)apps/api/src/generated/prisma/**'` | Lulus. Generated Prisma dari fase sebelumnya tidak diedit. |

Pengujian API permission memakai guard sebenarnya dengan identitas fixture; tidak membuktikan integrasi SSO live. UAT visual dengan sesi aplikasi nyata, provider SMTP perusahaan, dan printer fisik belum dijalankan. Warning existing Node experimental VM, Next.js middleware convention dan pool/test handles tetap dibedakan dari kegagalan. Pemeriksaan `tsc --noEmit` menyeluruh API sebelumnya menemukan ketidaksesuaian tipe pada fixture test existing; build API dan Jest adalah pemeriksaan executable yang lulus.
