<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import InputTanggal from '../components/InputTanggal.vue'
import { infoPortal, muridMasuk } from '../lib/api'
import { setMurid } from '../lib/store'

const router = useRouter()
const nisn = ref('')
const tgl = ref('')
const memuat = ref(false)
const galat = ref('')
const info = ref(null)

onMounted(async () => {
  try { info.value = await infoPortal() } catch { /* abaikan */ }
})

async function masuk() {
  galat.value = ''
  const n = nisn.value.replace(/\D/g, '')
  if (n.length !== 10) { galat.value = 'NISN harus 10 digit angka.'; return }
  if (!/^\d{2}-\d{2}-\d{4}$/.test(tgl.value) || tgl.value.includes('00-') || tgl.value.endsWith('0000')) {
    galat.value = 'Lengkapi tanggal, bulan, dan tahun lahir.'; return
  }
  memuat.value = true
  try {
    const data = await muridMasuk(n, tgl.value)
    setMurid(n, tgl.value, data)
    router.push({ name: 'konfirmasi' })
  } catch (e) {
    galat.value = e.message
  } finally {
    memuat.value = false
  }
}
</script>

<template>
  <section class="hero pt-4 pb-5">
    <div class="container text-center pt-3 pb-5 position-relative" style="z-index:1">
      <img src="/logo.png" alt="Logo SMP Negeri 2 Tulangan" class="hero-logo mb-3" />
      <div class="small text-uppercase fw-semibold opacity-75 mb-1" style="letter-spacing:.12em">SMP Negeri 2 Tulangan · Sidoarjo</div>
      <h1 class="mb-2">Konfirmasi Data Murid<br /><span class="tahun">Tahun Pelajaran 2026/2027</span></h1>
      <p class="mb-0 opacity-75 mx-auto" style="max-width:560px">
        Periksa data diri, alamat, nomor HP, dan data orang tua Anda. Jika sudah benar, konfirmasi. Jika ada yang salah atau kurang, perbaiki langsung di sini.
      </p>
    </div>
  </section>

  <main class="container pb-4">
    <div class="row justify-content-center">
      <div class="col-lg-5 col-md-7">
        <div class="kartu kartu-login p-4">
          <div v-if="info?.pengumuman" class="alert alert-warning small d-flex gap-2"><i class="bi bi-megaphone"></i><div>{{ info.pengumuman }}</div></div>
          <div v-if="info && !info.portal_dibuka" class="alert alert-secondary small d-flex gap-2">
            <i class="bi bi-lock"></i><div>Portal konfirmasi sedang <b>ditutup</b>. Anda masih bisa melihat data, tetapi belum bisa menyimpan perubahan.</div>
          </div>

          <h2 class="h5 fw-bold mb-1"><i class="bi bi-box-arrow-in-right text-hijau me-1"></i> Masuk Murid</h2>
          <p class="text-secondary small mb-3">Gunakan NISN dan tanggal lahir Anda.</p>

          <form @submit.prevent="masuk" novalidate>
            <div class="mb-3">
              <label for="nisn" class="form-label fw-semibold">NISN</label>
              <input id="nisn" v-model="nisn" type="text" inputmode="numeric" maxlength="10" autocomplete="off"
                class="form-control form-control-lg" placeholder="10 digit, contoh 0136138624" />
              <div class="form-text">Angka 0 di depan ikut diketik.</div>
            </div>
            <div class="mb-3">
              <label for="tgl" class="form-label fw-semibold">Tanggal Lahir</label>
              <InputTanggal id="tgl" v-model="tgl" />
            </div>
            <div v-if="galat" class="alert alert-danger small py-2" role="alert"><i class="bi bi-exclamation-triangle me-1"></i>{{ galat }}</div>
            <button class="btn btn-primary btn-lg w-100" :disabled="memuat">
              <span v-if="memuat" class="spinner-border spinner-border-sm me-2"></span>
              Lihat Data Saya
            </button>
          </form>
        </div>

        <div class="kartu p-4 mt-3">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h3 class="h6 fw-bold mb-0">Cara Singkat</h3>
            <RouterLink to="/panduan" class="small">Panduan lengkap <i class="bi bi-arrow-right"></i></RouterLink>
          </div>
          <div class="d-flex gap-3 mb-3"><span class="langkah-nomor">1</span><div><b>Masuk</b> dengan NISN dan tanggal lahir.</div></div>
          <div class="d-flex gap-3 mb-3"><span class="langkah-nomor">2</span><div><b>Periksa</b> nama, alamat, nomor HP, dan data orang tua. Kolom yang kosong atau janggal diberi tanda <span class="text-danger">merah</span>.</div></div>
          <div class="d-flex gap-3"><span class="langkah-nomor">3</span><div>Tekan <b>Data Sudah Benar</b>, atau <b>Perbaiki</b> lalu simpan.</div></div>
        </div>
      </div>
    </div>
  </main>
</template>
