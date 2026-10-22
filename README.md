# Quota Guard — Paket Vercel

Project web dengan tampilan terang untuk monitoring akumulasi bulanan pembelian banknotes, riwayat antar-cabang, pencadangan kuota, pemeriksaan underlying, dan pembatalan transaksi.

**Status:** source siap di-deploy. Belum ada deployment Vercel atau database Supabase yang dibuat untuk paket ini. Semua pelaku transaksi dan data transaksi adalah fiktif. Parameter USD10.000/bulan dan kurs merupakan parameter demonstrasi.

## Dua mode

| Mode | Cara mengaktifkan | Penyimpanan dan akses |
|---|---|---|
| Demo browser | Deploy tanpa environment variable Supabase | Data di browser masing-masing, ganti peran untuk simulasi |
| Sistem demonstrasi bersama | Konfigurasikan Supabase, jalankan SQL, buat pengguna dan peran | Database terpusat, login akun, kewenangan diperiksa di server |

Memindahkan hosting saja tidak menyinkronkan data. Aktifkan mode sistem untuk mencoba antar-browser/perangkat. Jika sebagian environment variable terisi, aplikasi menampilkan kesalahan konfigurasi dan tidak beralih diam-diam ke demo.

## 1. Deploy ke Vercel

1. Ekstrak ZIP ini. Direktori project adalah folder yang berisi `package.json`, `vercel.json`, `api/`, `lib/`, dan `public/`.
2. Upload seluruh isi folder project ke repository GitHub. Jangan hanya upload `index.html`, `public/`, atau `vercel.json`.
3. Pada Vercel, pilih **Add New → Project → Import Git Repository**, lalu pilih repository tersebut.
4. Framework Preset: **Other**. Root Directory: folder project tadi; kosong jika file berada di akar repository.
5. Build Command: `npm run check`. Output Directory: `public`. Install Command: default (`npm install`). Konfigurasi juga tersedia di `vercel.json`. Runtime Node.js: **22.x**.
6. Klik **Deploy**. Tanpa konfigurasi Supabase, halaman utama menjalankan demo browser.
7. Untuk mengaktifkan sistem bersama, lanjutkan langkah berikut dan redeploy setelah menambahkan environment variable.

Alternatif CLI, dari folder project:

```sh
npx vercel
```

Ikuti pemilihan akun/project. Setelah konfigurasi dan pengujian pada preview selesai, deployment production dapat dijalankan dengan `npx vercel --prod`.

## 2. Aktifkan database dan login

1. Buat project Supabase milik Anda. Anda dapat menggunakan project Supabase dari Marketplace Vercel atau dashboard Supabase.
2. Buka **SQL Editor** pada project Supabase, lalu jalankan seluruh isi `database/schema.sql`. Script bisa dijalankan kembali dan tidak menghapus data.
3. Di **Authentication → Users**, gunakan **Add user/Create user** untuk membuat dua pengguna dengan email dan password berbeda. Untuk akun demonstrasi, pastikan pengguna sudah dikonfirmasi agar dapat masuk. Tidak ada halaman pendaftaran publik di aplikasi ini.
4. Beri peran melalui SQL Editor. Ganti alamat email contoh dengan email pengguna yang dibuat:

```sql
insert into public.qg_members(user_id,role)
select id,'teller' from auth.users where email='EMAIL_TELLER_ANDA'
on conflict (user_id) do update set role=excluded.role;

insert into public.qg_members(user_id,role)
select id,'checker' from auth.users where email='EMAIL_PEMERIKSA_ANDA'
on conflict (user_id) do update set role=excluded.role;
```

5. Pastikan setiap akun tercatat pada `qg_members` dengan peran yang benar. Akun tanpa peran akan ditolak.
6. Di Vercel **Project → Settings → Environment Variables**, tambahkan:

| Variable | Nilai |
|---|---|
| `SUPABASE_URL` | Project URL HTTPS, misalnya `https://PROJECT_REF.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable API key dengan awalan `sb_publishable_` |
| `SUPABASE_SECRET_KEY` | Secret API key dengan awalan `sb_secret_`; hanya di server |
| `APP_ORIGIN` | Opsional; origin production persis, misalnya `https://nama-project.vercel.app`, tanpa slash akhir |

Gunakan **Publishable dan Secret API keys** dari pengaturan API Keys Supabase. Backend juga menerima nama legacy `SUPABASE_ANON_KEY` dan `SUPABASE_SERVICE_ROLE_KEY` untuk kompatibilitas jika masih aktif. Jangan menggunakan database password, access token akun Supabase, atau JWT milik pengguna. Jangan menaruh key server di HTML, JavaScript browser, GitHub, atau chat. Isi langsung di pengaturan Vercel. Tidak ada prefix `NEXT_PUBLIC_` untuk secret.

Untuk preview yang URL-nya berubah, biarkan `APP_ORIGIN` kosong di environment Preview; server mencocokkan Origin dengan host deployment. Pisahkan project database atau dataset Preview dan Production bila keduanya dipakai bersamaan.

7. Tambahkan variable pada environment yang dipakai (Production dan/atau Preview), lalu **Redeploy**. Halaman utama sekarang menampilkan login.
8. Masuk menggunakan akun Teller. Data simulasi awal dibuat otomatis saat workspace pertama kali dibaca.

## 3. Coba alur sistem bersama

1. Browser/profil A: masuk sebagai **Teller**, pilih **Lintas cabang**. Akumulasi USD8.000 dan pengajuan USD3.000 akan tertahan.
2. Ajukan underlying. Klik **Gunakan dokumen contoh**, gunakan nomor dokumen yang belum pernah dialokasikan, lalu kirim.
3. Browser/profil B: masuk sebagai **Pemeriksa**. Buka Persetujuan, periksa pengajuan, centang empat checklist, kemudian setujui. Bisa juga keluar dan berganti akun pada browser yang sama.
4. Kembali ke Teller. Tunggu pembaruan (setiap 5 detik saat tidak mengedit dan tidak ada modal terbuka), atau klik waktu pembaruan. Buka pengajuan yang disetujui, klik **Lanjutkan di Teller**, lalu proses.
5. Akumulasi menjadi USD11.000. Riwayat dan jejak audit tersimpan terpusat. Pembatalan hanya dapat dilakukan akun Pemeriksa dengan alasan.
6. Untuk skenario pencadangan, pilih **Kuota tersedia**, lalu cadangkan kuota. Sisa kuota pada browser lain berkurang setelah pembaruan. Teller pemilik atau Pemeriksa dapat melepas pencadangan. Setelah 10 menit pencadangan tidak lagi dihitung, meskipun halaman tidak terbuka; status kedaluwarsa dicatat pada mutasi berikutnya.

Hak akun tidak bisa diganti dengan dropdown pada mode sistem. Pengubahan request browser juga tidak memberikan kewenangan Pemeriksa. Metadata dokumen (nama file, nomor, nilai) disimpan; isi file PDF/gambar belum diunggah atau ditampilkan. Nomor dokumen dialokasikan satu kali dalam dataset demo untuk mencegah pemakaian ulang.

## Menjalankan lokal

Gunakan Node.js 22.12+ atau Node.js 24. Untuk demo browser:

```sh
npm install
npm run dev
```

Buka `http://localhost:3000`. Untuk mode sistem, salin `.env.example` menjadi `.env`, isi tiga variable Supabase, dan jalankan kembali. Untuk lokal biarkan `APP_ORIGIN` kosong atau isi `http://localhost:3000`. `.env` diabaikan Git. Aplikasi tidak memiliki dependency runtime eksternal yang perlu diunduh untuk logika utamanya.

## Isi paket

- `public/index.html`, `styles.css`, `app.js`: antarmuka terang.
- `public/domain.js`: perhitungan kuota dalam satuan sen USD.
- `public/system.js`: penghubung UI dengan API sistem bersama.
- `public/demo.html`: demo satu file yang tetap bisa dibuka offline.
- `api/gateway.js`: Vercel Function untuk sesi, data, dan tindakan.
- `lib/engine.cjs`: validasi server, kewenangan, persetujuan, pencadangan, dan audit.
- `lib/supabase.cjs`: koneksi server ke Supabase Auth/Data API.
- `database/schema.sql`: tabel dan fungsi pembaruan atomik.
- `vercel.json`, `package.json`, `.env.example`: konfigurasi deploy.
- `test/`: pengujian logika, API, idempotensi, dan request bersamaan.

## Cara data dijaga konsisten

Keputusan transaksi diperiksa ulang di backend. Backend membaca versi data, menghitung ulang kuota dan pencadangan, lalu menyimpan hanya jika versi database belum berubah. Jika request lain mendahului, backend membaca data terbaru dan mengulang evaluasi. PostgreSQL menjalankan pemeriksaan versi dan pembaruan sebagai satu pernyataan atomik. Referensi mutasi mencegah retry jaringan membukukan transaksi yang sama dua kali.

Tabel dan fungsi data tidak dapat diakses langsung oleh role `anon` atau `authenticated`; hanya backend dengan secret key (role database `service_role`) yang memanggilnya. Supabase memverifikasi sesi pengguna. Cookie sesi HttpOnly, SameSite=Strict, dan Secure pada Vercel; request perubahan juga memeriksa Origin. Sesi berakhir mengikuti masa access token Supabase, kemudian pengguna masuk kembali. Tidak ada refresh sesi otomatis pada versi ini.

## Batas penerapan

Paket ini adalah **sistem demonstrasi untuk project improvement**, belum aplikasi operasional BRI. Dataset terdiri dari empat identitas fiktif dan periode September–November 2026; belum ada pendaftaran identitas baru, validasi Dukcapil/KYC, kurs produksi, integrasi pembukuan bank, maupun pengunggahan isi dokumen. Hak akses dibagi menurut Teller/Pemeriksa, belum dibatasi cabang masing-masing.

Data demonstrasi disimpan dalam satu workspace JSONB dengan kontrol versi. Batas 2.000 mutasi mencegah dataset demo terus membesar. Perlu model transaksi terstruktur, pengarsipan audit, manajemen identitas dan dokumen, serta pengujian beban dan integrasi sebelum pengembangan operasional. Parameter produk dan ketentuan banknotes perlu disahkan pemilik produk/kepatuhan.

## Pemeriksaan

```sh
npm run check
npm test
```

Pengujian otomatis memeriksa logika transaksi, pemisahan peran, persetujuan satu kali, pembatalan, pencadangan, retry/idempotensi, CAS bersamaan, serta batas autentikasi/Origin API. Pengujian adapter memakai layanan tiruan; deployment Vercel dan koneksi ke database Supabase Anda perlu diuji setelah konfigurasi selesai.

Jika halaman tetap menampilkan demo browser, ketiga variable belum diisi atau deployment belum diulang. Jika login ditolak, periksa password, konfirmasi akun, dan `qg_members`. Jika database tidak siap, periksa bahwa SQL dijalankan pada project yang sama dengan URL dan keys yang dipasang.

## Rujukan teknis

- https://vercel.com/docs/functions/runtimes/node-js
- https://vercel.com/docs/project-configuration
- https://supabase.com/docs/guides/auth
- https://supabase.com/docs/guides/database/functions
- https://github.com/supabase/auth/blob/master/openapi.yaml
