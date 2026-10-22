# Pemeriksaan paket

Tanggal: 22 Oktober 2026.

- `npm run check`: lulus; sintaks JavaScript, konfigurasi JSON, dan aset antarmuka tersedia.
- `npm test`: 28 pengujian lulus, mencakup domain kuota, peran server, underlying, pembatalan, pencadangan, idempotensi, request bersamaan, serta kontrak HTTP Auth/Data API.
- Browser: tema terang dan demo browser termuat. Mode sistem diuji melalui login Teller, pengajuan underlying, login Pemeriksa, empat checklist persetujuan, kembali ke Teller, dan penyelesaian USD3.000 yang menghasilkan akumulasi USD11.000.
- Layanan Supabase pada pengujian browser/API menggunakan fixture, bukan project database nyata. Fixture hanya di folder `test/` dan tidak diimpor aplikasi.
- Uji lokal menggunakan Node.js 24; konfigurasi target Vercel Node.js 22.x.
- Tidak ada database eksternal yang dibuat atau diubah, dan belum ada deployment Vercel. SQL, keys, peran pengguna, dan akses database aktual perlu diverifikasi pada setup milik pengguna sesuai README.
