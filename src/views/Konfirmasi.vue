<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import InputTanggal from '../components/InputTanggal.vue'
import { KOLOM_EDIT, GRUP, PEKERJAAN, STATUS, cekKolom, tglPanjang, waktu } from '../lib/kolom'
import { muridSimpan, infoPortal, muridMasuk } from '../lib/api'
import { sesiMurid, setMurid, keluarMurid } from '../lib/store'

const router = useRouter()
const mode = ref('lihat') // lihat | edit | selesai
const form = reactive({})
const catatan = ref('')
const setuju = ref(false)
const menyimpan = ref(false)
const galat = ref('')
const hasil = ref(null)
const portalDibuka = ref(true)

const d = computed(() => sesiMurid.data || {})
function isiForm() { KOLOM_EDIT.forEach(k => { form[k.key] = d.value[k.key] || '' }) }
isiForm()
catatan.value = d.value.catatan || ''

onMounted(async () => {
  try { portalDibuka.value = (await infoPortal())?.portal_dibuka !== false } catch { /* abaikan */ }
  // segarkan data terbaru dari server
  try { setMurid(sesiMurid.nisn, sesiMurid.tgl, await muridMasuk(sesiMurid.nisn, sesiMurid.tgl)); isiForm() } catch (e) {
    if (e.kode === 'TGL_TIDAK_COCOK' || e.kode === 'NISN_TIDAK_DITEMUKAN') { keluarMurid(); router.replace('/') }
  }
})

const peringatan = computed(() => KOLOM_EDIT.map(k => ({ ...k, pesan: cekKolom(k.key, d.value[k.key]) })).filter(k => k.pesan))
const perubahan = computed(() => KOLOM_EDIT.filter(k => (form[k.key] || '').trim() !== (d.value[k.key] || '').trim()))
const grupList = Object.entries(GRUP).map(([id, g]) => ({ id, ...g, kolom: KOLOM_EDIT.filter(k => k.grup === id) }))

function pilihanPekerjaan(nilai) { return nilai && !PEKERJAAN.includes(nilai) ? [nilai, ...PEKERJAAN] : PEKERJAAN }

function mulaiPerbaiki() { galat.value = ''; mode.value = 'edit'; window.scrollTo({ top: 0, behavior: 'smooth' }) }
function batal() { isiForm(); mode.value = 'lihat'; galat.value = '' }

function validasi() {
  for (const k of KOLOM_EDIT) {
    const v = (form[k.key] || '').trim()
    if (k.wajib && !v) return `${k.label} wajib diisi.`
    if (k.key === 'tgl_lahir' && !/^(0[1-9]|[12]\d|3[01])-(0[1-9]|1[0-2])-\d{4}$/.test(v)) return 'Tanggal lahir belum lengkap.'
    if (k.key === 'no_hp') {
      const n = v.replace(/[^0-9]/g, '')
      if (n.length < 10 || n.length > 14 || !/^(08|628)/.test(n)) return 'No. HP harus diawali 08 atau 628 dan berisi 10–14 digit.'
    }
  }
  return ''
}

async function kirim(jenis) {
  galat.value = ''
  if (!setuju.value) { galat.value = 'Centang pernyataan terlebih dahulu.'; return }
  let data = {}
  if (jenis === 'perbaiki') {
    const v = validasi()
    if (v) { galat.value = v; return }
    if (!perubahan.value.length && !catatan.value.trim()) { galat.value = 'Belum ada data yang diubah.'; return }
    perubahan.value.forEach(k => { data[k.key] = form[k.key].trim() })
    if (data.no_hp) data.no_hp = data.no_hp.replace(/[^0-9]/g, '')
  }
  const daftarUbah = perubahan.value.map(k => ({ label: k.label, lama: d.value[k.key], baru: data[k.key] }))
  menyimpan.value = true
  try {
    const res = await muridSimpan(sesiMurid.nisn, sesiMurid.tgl, data, catatan.value)
    const tglBaru = data.tgl_lahir || sesiMurid.tgl
    setMurid(sesiMurid.nisn, tglBaru, res)
    isiForm()
    hasil.value = { jenis, daftarUbah: jenis === 'perbaiki' ? daftarUbah : [], tglBerubah: !!data.tgl_lahir }
    mode.value = 'selesai'
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (e) {
    galat.value = e.message
  } finally {
    menyimpan.value = false
  }
}

function keluar() { keluarMurid(); router.push('/') }
</script>

<template>
  <main class="container py-4" style="max-width: 860px">
    <!-- Kepala -->
    <div class="kartu p-3 p-md-4 mb-3">
      <div class="d-flex flex-wrap gap-3 align-items-center justify-content-between">
        <div class="d-flex gap-3 align-items-center">
          <div class="rounded-circle bg-hijau-muda text-hijau d-flex align-items-center justify-content-center fs-3" style="width:56px;height:56px"><i class="bi bi-person"></i></div>
          <div>
            <div class="small text-secondary">Konfirmasi Data Murid Tahun Pelajaran 2026/2027</div>
            <h1 class="h5 fw-bold mb-1">{{ d.nama }}</h1>
            <div class="small"><span class="me-3"><i class="bi bi-upc me-1"></i>NISN {{ d.nisn }}</span><span><i class="bi bi-door-open me-1"></i>Kelas {{ d.kelas }}</span></div>
          </div>
        </div>
        <div class="text-md-end">
          <span class="badge rounded-pill fs-6" :class="STATUS[d.status]?.kelas"><i class="bi me-1" :class="STATUS[d.status]?.icon"></i>{{ STATUS[d.status]?.label }}</span>
          <div v-if="d.dikonfirmasi_at" class="small text-secondary mt-1">Terakhir: {{ waktu(d.dikonfirmasi_at) }}</div>
        </div>
      </div>
    </div>

    <!-- Selesai -->
    <div v-if="mode === 'selesai'" class="kartu p-4 mb-3 text-center">
      <div class="display-5 text-success mb-2"><i class="bi bi-check-circle-fill"></i></div>
      <h2 class="h4 fw-bold">Terima kasih, data berhasil dikirim!</h2>
      <p class="text-secondary mb-3" v-if="hasil?.jenis === 'benar'">Anda telah mengonfirmasi bahwa data Anda <b>sudah benar</b>.</p>
      <p class="text-secondary mb-3" v-else>Perbaikan Anda sudah tersimpan dan tercatat di sekolah.</p>
      <div v-if="hasil?.daftarUbah?.length" class="text-start mx-auto mb-3" style="max-width:520px">
        <div class="fw-semibold mb-2">Data yang diperbaiki:</div>
        <ul class="list-group small">
          <li v-for="u in hasil.daftarUbah" :key="u.label" class="list-group-item">
            <div class="fw-semibold">{{ u.label }}</div>
            <div class="lama">{{ u.lama || '(kosong)' }}</div>
            <div class="text-success"><i class="bi bi-arrow-return-right me-1"></i>{{ u.baru }}</div>
          </li>
        </ul>
      </div>
      <div v-if="hasil?.tglBerubah" class="alert alert-warning small text-start mx-auto" style="max-width:520px">
        <i class="bi bi-info-circle me-1"></i> Tanggal lahir Anda berubah. Untuk masuk berikutnya, gunakan <b>tanggal lahir yang baru: {{ tglPanjang(d.tgl_lahir) }}</b>.
      </div>
      <div class="d-flex flex-wrap gap-2 justify-content-center">
        <button class="btn btn-outline-primary" @click="mode = 'lihat'; setuju = false"><i class="bi bi-eye me-1"></i>Lihat Data Lagi</button>
        <button class="btn btn-primary" @click="keluar"><i class="bi bi-box-arrow-right me-1"></i>Selesai &amp; Keluar</button>
      </div>
    </div>

    <template v-else>
      <div v-if="!portalDibuka" class="alert alert-secondary"><i class="bi bi-lock me-1"></i> Portal sedang ditutup admin. Anda hanya dapat melihat data.</div>

      <div v-if="mode === 'lihat' && peringatan.length" class="alert alert-warning">
        <div class="fw-semibold mb-1"><i class="bi bi-exclamation-triangle me-1"></i>Ada {{ peringatan.length }} isian yang perlu Anda periksa:</div>
        <ul class="mb-0 small ps-3">
          <li v-for="p in peringatan" :key="p.key"><b>{{ p.label }}</b>: {{ p.pesan }}</li>
        </ul>
      </div>
      <div v-if="mode === 'edit'" class="alert alert-info small"><i class="bi bi-pencil me-1"></i>Mode perbaikan: ubah isian yang salah atau kosong, lalu tekan <b>Simpan Perbaikan</b> di bawah. Kolom yang Anda ubah akan berwarna kuning.</div>

      <!-- Kartu per grup -->
      <div v-for="g in grupList" :key="g.id" class="kartu p-3 p-md-4 mb-3">
        <h2 class="h6 fw-bold mb-2 text-hijau"><i class="bi me-2" :class="g.icon"></i>{{ g.judul }}</h2>
        <div v-for="k in g.kolom" :key="k.key" class="baris-data px-2" :class="{ berubah: mode === 'edit' && (form[k.key] || '').trim() !== (d[k.key] || '').trim() }">
          <label :for="'f-' + k.key" class="label-data d-block mb-1"><i class="bi me-1" :class="k.icon"></i>{{ k.label }}</label>

          <template v-if="mode === 'lihat'">
            <div class="nilai-data">
              <span v-if="!d[k.key]" class="nilai-kosong">— belum diisi —</span>
              <template v-else>{{ k.key === 'tgl_lahir' ? tglPanjang(d[k.key]) : d[k.key] }}</template>
            </div>
            <div v-if="d[k.key] && cekKolom(k.key, d[k.key])" class="small text-danger mt-1"><i class="bi bi-exclamation-circle me-1"></i>{{ cekKolom(k.key, d[k.key]) }}</div>
          </template>

          <template v-else>
            <InputTanggal v-if="k.tipe === 'tanggal'" :id="'f-' + k.key" v-model="form[k.key]" />
            <textarea v-else-if="k.tipe === 'textarea'" :id="'f-' + k.key" v-model="form[k.key]" rows="2" class="form-control" :placeholder="k.placeholder"></textarea>
            <select v-else-if="k.tipe === 'pekerjaan'" :id="'f-' + k.key" v-model="form[k.key]" class="form-select">
              <option value="">— pilih —</option>
              <option v-for="p in pilihanPekerjaan(d[k.key])" :key="p" :value="p">{{ p }}</option>
            </select>
            <input v-else :id="'f-' + k.key" v-model="form[k.key]" :type="k.tipe === 'tel' ? 'tel' : 'text'" :inputmode="k.tipe === 'tel' ? 'numeric' : undefined" class="form-control" :placeholder="k.placeholder" />
            <div v-if="(form[k.key] || '').trim() !== (d[k.key] || '').trim()" class="small mt-1">
              <span class="lama">Semula: {{ d[k.key] || '(kosong)' }}</span>
            </div>
            <div v-if="k.key === 'tgl_lahir'" class="form-text">Jika tanggal lahir diubah, gunakan tanggal baru saat masuk berikutnya.</div>
          </template>
        </div>
      </div>

      <!-- Aksi -->
      <div class="kartu p-3 p-md-4 mb-3">
        <div class="mb-3">
          <label for="catatan" class="form-label fw-semibold">Catatan untuk sekolah <span class="text-secondary fw-normal">(opsional)</span></label>
          <textarea id="catatan" v-model="catatan" rows="2" class="form-control" maxlength="1000"
            placeholder="Misalnya: NISN atau kelas saya keliru, nama ayah sudah almarhum, dll."></textarea>
        </div>
        <div class="form-check mb-3">
          <input id="setuju" v-model="setuju" class="form-check-input" type="checkbox" />
          <label for="setuju" class="form-check-label small">Saya (bersama orang tua/wali) sudah memeriksa data di atas dan menyatakan isian yang saya kirim adalah <b>benar</b>.</label>
        </div>
        <div v-if="galat" class="alert alert-danger small py-2"><i class="bi bi-exclamation-triangle me-1"></i>{{ galat }}</div>

        <div v-if="mode === 'lihat'" class="d-grid gap-2 d-md-flex">
          <button class="btn btn-primary btn-lg flex-md-fill" :disabled="menyimpan || !portalDibuka" @click="kirim('benar')">
            <span v-if="menyimpan" class="spinner-border spinner-border-sm me-2"></span><i v-else class="bi bi-check2-circle me-1"></i>Data Sudah Benar
          </button>
          <button class="btn btn-emas btn-lg flex-md-fill" :disabled="menyimpan || !portalDibuka" @click="mulaiPerbaiki">
            <i class="bi bi-pencil-square me-1"></i>Ada yang Salah, Perbaiki
          </button>
        </div>
        <div v-else class="d-grid gap-2 d-md-flex">
          <button class="btn btn-primary btn-lg flex-md-fill" :disabled="menyimpan || !portalDibuka" @click="kirim('perbaiki')">
            <span v-if="menyimpan" class="spinner-border spinner-border-sm me-2"></span><i v-else class="bi bi-save me-1"></i>Simpan Perbaikan
            <span v-if="perubahan.length" class="badge text-bg-light ms-1">{{ perubahan.length }} perubahan</span>
          </button>
          <button class="btn btn-outline-secondary btn-lg" :disabled="menyimpan" @click="batal">Batal</button>
        </div>
      </div>

      <div class="text-center">
        <button class="btn btn-link text-secondary" @click="keluar"><i class="bi bi-box-arrow-left me-1"></i>Keluar</button>
      </div>
    </template>
  </main>
</template>
