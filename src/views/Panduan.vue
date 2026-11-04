<script setup>
const langkah = [
  { judul: 'Siapkan data pendukung', isi: 'Siapkan NISN (10 digit, bisa dilihat di kartu pelajar, rapor, atau situs nisn.data.kemdikbud.go.id), Kartu Keluarga (KK), dan akta kelahiran. Sebaiknya didampingi orang tua/wali saat mengisi.', icon: 'bi-folder2-open' },
  { judul: 'Buka portal & masuk', isi: 'Buka halaman depan portal ini. Ketik NISN (termasuk angka 0 di depan), pilih tanggal, bulan, dan tahun lahir, lalu tekan "Lihat Data Saya".', icon: 'bi-box-arrow-in-right' },
  { judul: 'Periksa setiap isian', isi: 'Cocokkan Nama Lengkap & Tanggal Lahir dengan akta kelahiran; Alamat (Jalan/Dusun, RT, RW, Kelurahan/Desa, Kecamatan) dan nama orang tua dengan Kartu Keluarga; serta pastikan Nomor HP/WhatsApp masih aktif. Isian yang kosong atau janggal ditandai merah.', icon: 'bi-search' },
  { judul: 'Jika semua sudah benar', isi: 'Centang pernyataan di bagian bawah, lalu tekan tombol hijau "Data Sudah Benar". Status Anda berubah menjadi "Data Benar".', icon: 'bi-check2-circle' },
  { judul: 'Jika ada yang salah atau kurang', isi: 'Tekan tombol kuning "Ada yang Salah, Perbaiki". Ubah isian yang keliru — kolom yang Anda ubah akan berwarna kuning dan memperlihatkan data semula. Setelah selesai, centang pernyataan lalu tekan "Simpan Perbaikan".', icon: 'bi-pencil-square' },
  { judul: 'Selesai', isi: 'Halaman ringkasan menampilkan data yang Anda perbaiki. Tekan "Selesai & Keluar", terutama jika memakai HP/komputer bersama. Anda masih bisa masuk lagi untuk memperbaiki selama portal dibuka.', icon: 'bi-flag' }
]
const aturan = [
  ['Nama Lengkap', 'Sesuai akta kelahiran, huruf besar di awal kata, tanpa gelar. Contoh: Muhammad Rizky Pratama.'],
  ['Tanggal Lahir', 'Sesuai akta kelahiran. Jika diubah, gunakan tanggal yang baru untuk masuk berikutnya.'],
  ['Alamat Lengkap', 'Jalan/Dusun/Perumahan + nomor rumah, RT / RW, Kel./Desa, Kec. Contoh: Perumtas III Blok N5/30, RT 26 / RW 7, Kel. Kepuh Kemiri, Kec. Tulangan.'],
  ['No. HP / WhatsApp', 'Nomor aktif orang tua/wali yang bisa dihubungi sekolah, diawali 08 (contoh: 081234567890). Hanya angka, tanpa spasi atau tanda strip.'],
  ['Nama Ayah / Ibu', 'Nama lengkap sesuai Kartu Keluarga, tanpa gelar. Isi walaupun orang tua sudah meninggal.'],
  ['Pekerjaan Ayah / Ibu', 'Pilih dari daftar. Jika sudah meninggal pilih "Sudah Meninggal"; jika tidak bekerja pilih "Tidak Bekerja".']
]
const tanya = [
  ['Tidak bisa masuk: "Tanggal lahir tidak cocok"?', 'Artinya NISN Anda terdaftar tetapi tanggal lahir di data sekolah berbeda. Coba periksa kembali tanggal lahir. Jika sudah yakin benar, kemungkinan data sekolah yang keliru — hubungi wali kelas atau operator sekolah agar diperbaiki dari Panel Admin.'],
  ['"NISN tidak ditemukan"?', 'Pastikan NISN 10 digit dan angka 0 di depan ikut diketik. Jika tetap tidak ditemukan, laporkan ke wali kelas.'],
  ['NISN atau kelas saya salah, bagaimana?', 'NISN dan kelas tidak bisa diubah sendiri. Tulis di kolom "Catatan untuk sekolah" lalu simpan, atau laporkan ke wali kelas.'],
  ['Saya salah menyimpan, bisa diubah lagi?', 'Bisa. Masuk lagi lalu perbaiki kembali selama portal masih dibuka. Semua perubahan tercatat di sekolah.'],
  ['Apakah data saya aman?', 'Data hanya bisa dilihat oleh murid yang bersangkutan (dengan NISN + tanggal lahir) dan admin sekolah. Rekap data tidak bisa diunduh oleh umum.']
]
</script>

<template>
  <main class="container py-4" style="max-width: 900px">
    <div class="text-center mb-4">
      <img src="/logo.png" alt="" style="width:72px" class="mb-2" />
      <h1 class="h3 fw-bold mb-1">Panduan Pengisian Konfirmasi Data Murid</h1>
      <p class="text-secondary mb-0">Tahun Pelajaran 2026/2027 · SMP Negeri 2 Tulangan</p>
    </div>

    <div class="kartu p-3 p-md-4 mb-4">
      <h2 class="h5 fw-bold mb-3"><i class="bi bi-list-ol text-hijau me-2"></i>Langkah-langkah</h2>
      <div v-for="(l, i) in langkah" :key="i" class="d-flex gap-3 mb-3">
        <span class="langkah-nomor">{{ i + 1 }}</span>
        <div>
          <div class="fw-bold"><i class="bi me-1 text-hijau" :class="l.icon"></i>{{ l.judul }}</div>
          <div class="text-secondary">{{ l.isi }}</div>
        </div>
      </div>
      <div class="text-center mt-2">
        <RouterLink to="/" class="btn btn-primary"><i class="bi bi-box-arrow-in-right me-1"></i>Mulai Konfirmasi</RouterLink>
      </div>
    </div>

    <div class="kartu p-3 p-md-4 mb-4">
      <h2 class="h5 fw-bold mb-3"><i class="bi bi-rulers text-hijau me-2"></i>Aturan Penulisan</h2>
      <div class="table-responsive">
        <table class="table align-middle mb-0">
          <tbody>
            <tr v-for="a in aturan" :key="a[0]"><th class="text-nowrap" style="width:180px">{{ a[0] }}</th><td>{{ a[1] }}</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="kartu p-3 p-md-4">
      <h2 class="h5 fw-bold mb-3"><i class="bi bi-question-circle text-hijau me-2"></i>Pertanyaan Umum</h2>
      <details v-for="t in tanya" :key="t[0]" class="border-bottom py-2">
        <summary class="fw-semibold">{{ t[0] }}</summary>
        <div class="text-secondary mt-2">{{ t[1] }}</div>
      </details>
    </div>
  </main>
</template>
