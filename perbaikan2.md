# Perbaikan: dukungan token Web dan Mobile pada API IPCS

## Masalah

Aplikasi memiliki dua OIDC client yang sah untuk application `ipcs`:

```text
ipcs-web  → CONFIDENTIAL → web application
ipcs-app  → PUBLIC       → Android/Flutter native application dengan PKCE
```

Keduanya menerbitkan token dengan audience yang sama:

```text
https://apps.vuteq.co.id/api
```

Namun verifier API saat ini membandingkan `payload.client_id` dengan satu `metadata.clientId` dari bootstrap secret. Jika backend bootstrap memakai client `ipcs-web`, access token Flutter dengan `client_id=ipcs-app` ditolak sebagai HTTP 401 walaupun signature, issuer, audience, dan masa berlaku token valid.

## Standard yang dituju

Tetap gunakan dua client terpisah:

```text
Web     : ipcs-web (CONFIDENTIAL)
Mobile  : ipcs-app (PUBLIC, Authorization Code + PKCE)
API     : menerima token dari allowlist client untuk audience IPCS
```

API wajib tetap memvalidasi secara ketat:

- JWT signature melalui JWKS SSO (`RS256`)
- issuer: `https://sso.vuteq.co.id`
- audience: `https://apps.vuteq.co.id/api`
- `exp`, `iat`, `sub`, dan `grant_id`
- tipe claim yang diperlukan (`roles`, `email_verified`, `mfa_verified`)
- `client_id` harus berada di allowlist; **bukan menerima semua client SSO**

## Rekomendasi konfigurasi

Tambahkan konfigurasi allowlist di environment API, misalnya:

```env
VUTEQ_SSO_ALLOWED_CLIENT_IDS=ipcs-web,ipcs-app
```

Nilai default/fallback sebaiknya adalah `metadata.clientId` dari bootstrap agar aplikasi existing tidak berubah perilakunya tanpa konfigurasi eksplisit.

## Rekomendasi implementasi

Implementasi paling tepat berada di package SDK `@vuteq/sso-client-nest`, karena validasi token dilakukan di sana. API `ansei-full` hanya mengirim daftar client yang diizinkan melalui konfigurasi module/service.

Konsep validasi:

```ts
const allowedClientIds = new Set(
  configuredAllowedClientIds.length > 0
    ? configuredAllowedClientIds
    : [metadata.clientId],
);

if (
  typeof payload.client_id !== 'string' ||
  !allowedClientIds.has(payload.client_id)
) {
  throw new Error('Token was issued to an unauthorized client');
}
```

Jangan menghapus pemeriksaan berikut:

```ts
issuer: metadata.issuer
audience: metadata.resource
algorithms: ['RS256']
requiredClaims: ['sub', 'iat', 'exp', 'client_id', 'grant_id']
```

## Lokasi implementasi yang relevan

- API membuat service SSO:
  ```text
  apps/api/src/auth/sso-auth.service.ts
  ```
- API mengonversi kegagalan autentikasi ke 401:
  ```text
  apps/api/src/auth/guards/dual-auth.guard.ts
  ```
- Validasi token SDK saat ini membatasi satu client ID:
  ```text
  E:\Project EDITH\sso-sdk\packages\nest\src\verifier.ts
  ```

## Verifikasi setelah implementasi

1. Mulai/restart API dengan:

   ```env
   VUTEQ_SSO_ALLOWED_CLIENT_IDS=ipcs-web,ipcs-app
   ```

2. Login dari Flutter menggunakan:

   ```env
   OIDC_CLIENT_ID=ipcs-app
   OIDC_RESOURCE=https://apps.vuteq.co.id/api
   OIDC_SCOPES=openid profile email offline_access api
   ```

3. Pastikan token minimal memiliki:

   ```text
   iss       = https://sso.vuteq.co.id
   aud       = https://apps.vuteq.co.id/api
   client_id = ipcs-app
   grant_id  = present
   ```

4. Uji endpoint melalui URL mobile:

   ```text
   GET https://apps.vuteq.co.id/mobile/v1/auth/profile
   GET https://apps.vuteq.co.id/mobile/v1/production/production-release?status=RELEASED
   ```

5. Uji token web (`ipcs-web`) dan mobile (`ipcs-app`) keduanya berhasil autentikasi.

6. Pastikan client yang tidak masuk allowlist tetap menghasilkan `401`.

## Catatan keamanan

- Jangan menaruh secret confidential client di APK/Flutter.
- `ipcs-app` harus tetap `PUBLIC` dan memakai PKCE.
- Jangan mengganti validasi `client_id` menjadi menerima semua client tanpa allowlist.
- Jangan menonaktifkan validasi issuer, audience, signature, atau expiration.
- Jangan log access token atau client secret.
