# Konfirmasi Data Murid Tahun Pelajaran 2026/2027
**SMP Negeri 2 Tulangan, Sidoarjo**

Website interaktif agar murid dapat memeriksa, mengonfirmasi, dan memperbaiki datanya (identitas, alamat, No. HP, data orang tua), dilengkapi **Panel Data Pusat Sekolah** untuk admin.

**Teknologi:** Vue.js 3 + Vite · Bootstrap 5 · Bootstrap Icons · Supabase (Database + Data API + Realtime) · Netlify

---

## Fitur

### Murid (User)
- Masuk dengan **NISN + tanggal lahir** — hanya bisa melihat datanya sendiri.
- Melihat nama, tanggal lahir, **alamat, No. HP, nama & pekerjaan ayah/ibu**.
- Kolom kosong/janggal (No. HP tidak valid, alamat tanpa RT/RW) ditandai merah.
- Tombol **Data Sudah Benar** atau **Perbaiki** → kolom yang diubah disorot kuning + tampil data semula.
- Catatan untuk sekolah (mis. NISN/kelas keliru), pernyataan persetujuan, ringkasan setelah simpan.
- Halaman **Panduan Pengisian** (langkah, aturan penulisan, FAQ).

### Admin — Panel Data Pusat Sekolah (`/admin`)
- Login: **username `administrator`**, **password `esdeweni`** (disimpan sebagai hash bcrypt; bisa diganti di menu Pengaturan).
- **Ringkasan**: total, data benar, diperbaiki, belum; progres per kelas.
- **Data Murid**: cari/saring (kelas, status, data belum lengkap), edit data, ubah kelas/status, reset, hapus.
- **Log Perbaikan Realtime**: perubahan dari murid muncul otomatis + tombol **Bersihkan Log**.
- **Unduh Excel** (hanya admin): sheet Rekap, Semua Murid (+status & catatan), Kelas VII/VIII/IX (format sama dengan file sumber), Log Perbaikan.
- **Pengaturan**: **Upload Data** Excel (mode tambah/perbarui atau ganti semua, pratinjau, NISN ganda otomatis digabung, template), buka/tutup portal + pengumuman, reset semua status, ganti password.

## Keamanan
- Semua tabel memakai **Row Level Security tanpa policy** → tidak bisa dibaca/diunduh langsung lewat Data API.
- Akses hanya lewat fungsi RPC `SECURITY DEFINER`:
  - murid: wajib NISN + tanggal lahir yang cocok;
  - admin: wajib token sesi (berlaku 12 jam) dari login username/password.
- Kunci `sb_publishable_...` memang aman di browser (bukan kunci rahasia).
- Sinyal realtime hanya berisi "ada perubahan" (tanpa data pribadi); panel admin lalu memuat ulang lewat RPC ber-token.

## Struktur
```
├── index.html
├── netlify.toml                 # build & redirect SPA untuk Netlify
├── public/logo.png, favicon.png # logo sekolah
├── supabase/migrations/001_skema_konfirmasi.sql   # skema + fungsi RPC
└── src/
    ├── main.js, App.vue, router.js, style.css
    ├── lib/   supabase.js · api.js · kolom.js · excel.js · store.js
    ├── components/  InputTanggal.vue · Dialog.vue · admin/EditMurid.vue · admin/Pengaturan.vue
    └── views/  Beranda.vue · Konfirmasi.vue · Panduan.vue · AdminLogin.vue · AdminPanel.vue
```

## Database Supabase
Proyek: **konfirmasi-data-murid** (`efdqgjgkcuvpqsulqyhg`, region Singapura). Skema sudah terpasang dan **652 murid** dari `Data_Siswa_SMPN_2_Tulangan_Lengkap.xlsx` sudah diimpor.

Untuk memasang ke proyek Supabase lain: buka **SQL Editor**, jalankan `supabase/migrations/001_skema_konfirmasi.sql`, ubah URL & kunci di `.env`, lalu unggah data dari menu **Pengaturan → Upload Data**.

## Menjalankan lokal
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # hasil di folder dist/
```

## Deploy ke GitHub + Netlify
1. Buat repository kosong di GitHub, mis. `konfirmasi-data-murid`.
2. Push kode:
   ```bash
   git remote add origin https://github.com/<akun>/konfirmasi-data-murid.git
   git push -u origin main
   ```
3. Di **Netlify → Add new site → Import an existing project → GitHub**, pilih repo tersebut.
   Build command `npm run build`, publish directory `dist` (sudah otomatis dari `netlify.toml`).
4. (Opsional) Netlify → Site configuration → Environment variables: `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`. Nilai bawaan sudah ada di `.env`.
5. Setiap `git push` ke `main` otomatis memicu deploy ulang.

## Catatan data
- Sheet "Kelas VII" pada file sumber berisi salinan 216 murid kelas VIII di bagian bawah; saat impor, NISN ganda digabung sehingga total **652 murid unik** (VII: 215, VIII: 216, IX: 221).
- Isian `-` pada file sumber disimpan sebagai kosong agar terdeteksi sebagai "belum diisi".
