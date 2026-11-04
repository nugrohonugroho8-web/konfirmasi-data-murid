<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import Dialog from '../components/Dialog.vue'
import EditMurid from '../components/admin/EditMurid.vue'
import Pengaturan from '../components/admin/Pengaturan.vue'
import { STATUS, waktu, cekKolom } from '../lib/kolom'
import { unduhRekap } from '../lib/excel'
import { adminDataMurid, adminLog, adminBersihkanLog, adminKeluar, infoPortal, sesiAdmin, dengarPerubahan, adminDokumen, adminLihatDokumen, adminHapusDokumen, bukaTabBaru, formatUkuran, JENIS_DOKUMEN } from '../lib/api'

const router = useRouter()
const tab = ref('ringkasan')
const murid = ref([])
const log = ref([])
const dokumen = ref([])
const info = ref(null)
const memuat = ref(true)
const pesan = ref(null)
const live = ref(false)
const terakhir = ref(null)
const logBaru = ref(new Set())
const sesi = sesiAdmin()

// ---------- Muat data ----------
async function muat(diam = false) {
  if (!diam) memuat.value = true
  try {
    const lamaIds = new Set(log.value.map(l => l.id))
    const [m, l, i, dk] = await Promise.all([adminDataMurid(), adminLog(2000), infoPortal(), adminDokumen()])
    murid.value = m; info.value = i; dokumen.value = dk
    if (diam && lamaIds.size) logBaru.value = new Set(l.filter(x => !lamaIds.has(x.id)).map(x => x.id))
    log.value = l
    terakhir.value = new Date()
  } catch (e) {
    if (e.kode === 'SESI_TIDAK_VALID') { router.replace({ name: 'admin-login' }); return }
    tampil(e.message, 'danger')
  } finally { memuat.value = false }
}

let jeda = null, polling = null, berhenti = null
function muatTunda() { clearTimeout(jeda); jeda = setTimeout(() => muat(true), 600) }
onMounted(() => {
  muat()
  berhenti = dengarPerubahan(muatTunda, s => { live.value = s })
  // cadangan bila koneksi realtime terputus: muat ulang berkala hanya saat realtime mati
  polling = setInterval(() => { if (!live.value && document.visibilityState === 'visible') muat(true) }, 30000)
})
onBeforeUnmount(() => { berhenti && berhenti(); clearInterval(polling); clearTimeout(jeda) })

function tampil(teks, jenis = 'success') {
  pesan.value = { teks, jenis }
  setTimeout(() => { if (pesan.value?.teks === teks) pesan.value = null }, 5000)
}

async function keluar() { await adminKeluar(); router.replace('/') }

// ---------- Ringkasan ----------
const total = computed(() => murid.value.length)
const jml = s => murid.value.filter(m => m.status === s).length
const nBenar = computed(() => jml('benar'))
const nPerbaiki = computed(() => jml('diperbaiki'))
const nBelum = computed(() => jml('belum'))
const persen = computed(() => total.value ? Math.round(((nBenar.value + nPerbaiki.value) / total.value) * 100) : 0)
const urutTingkat = k => ({ VII: 7, VIII: 8, IX: 9 }[(k || '').split('-')[0]] || 99)
const daftarKelas = computed(() => [...new Set(murid.value.map(m => m.kelas))].sort((a, b) => urutTingkat(a) - urutTingkat(b) || a.localeCompare(b)))
const perKelas = computed(() => daftarKelas.value.map(k => {
  const d = murid.value.filter(m => m.kelas === k)
  const b = d.filter(m => m.status === 'benar').length, p = d.filter(m => m.status === 'diperbaiki').length
  return { kelas: k, total: d.length, benar: b, perbaiki: p, belum: d.length - b - p, persen: Math.round(((b + p) / d.length) * 100) }
}))
const nTidakLengkap = computed(() => murid.value.filter(m => ['alamat', 'no_hp', 'nama_ayah', 'nama_ibu'].some(k => cekKolom(k, m[k]))).length)

// ---------- Data murid ----------
const fKelas = ref(''), fStatus = ref(''), fCari = ref(''), fBermasalah = ref(false)
const hal = ref(1), PER = 50
const tersaring = computed(() => {
  const q = fCari.value.trim().toLowerCase()
  return murid.value
    .filter(m => (!fKelas.value || m.kelas === fKelas.value) && (!fStatus.value || m.status === fStatus.value))
    .filter(m => !fBermasalah.value || ['alamat', 'no_hp', 'nama_ayah', 'nama_ibu', 'pekerjaan_ayah', 'pekerjaan_ibu'].some(k => cekKolom(k, m[k])))
    .filter(m => !q || [m.nama, m.nisn, m.nama_ayah, m.nama_ibu, m.alamat, m.no_hp].some(v => (v || '').toLowerCase().includes(q)))
    .sort((a, b) => urutTingkat(a.kelas) - urutTingkat(b.kelas) || a.kelas.localeCompare(b.kelas) || a.nama.localeCompare(b.nama))
})
watch([fKelas, fStatus, fCari, fBermasalah], () => { hal.value = 1 })
const jmlHal = computed(() => Math.max(1, Math.ceil(tersaring.value.length / PER)))
const halaman = computed(() => tersaring.value.slice((hal.value - 1) * PER, hal.value * PER))
const diedit = ref(null)
function tersimpan(_, teks) { diedit.value = null; tampil(teks); muat(true) }
function lihatKelas(k) { fKelas.value = k; fStatus.value = ''; tab.value = 'data' }

// ---------- Log ----------
const fLog = ref('')
const logTersaring = computed(() => {
  const q = fLog.value.trim().toLowerCase()
  return q ? log.value.filter(l => [l.nama, l.nisn, l.kelas, l.label, l.nilai_baru].some(v => (v || '').toLowerCase().includes(q))) : log.value
})
const dialogBersih = ref(false)
const membersihkan = ref(false)
async function bersihkanLog() {
  membersihkan.value = true
  try { const n = await adminBersihkanLog(); dialogBersih.value = false; tampil(`${n} log perbaikan dibersihkan.`); muat(true) }
  catch (e) { tampil(e.message, 'danger') } finally { membersihkan.value = false }
}

// ---------- Dokumen ----------
const fDok = ref(''), fDokKelas = ref(''), fDokJenis = ref('')
const nMuridDok = computed(() => new Set(dokumen.value.map(d => d.nisn)).size)
const dokTersaring = computed(() => {
  const q = fDok.value.trim().toLowerCase()
  return dokumen.value
    .filter(d => (!fDokKelas.value || d.kelas === fDokKelas.value) && (!fDokJenis.value || d.jenis === fDokJenis.value))
    .filter(d => !q || [d.nama, d.nisn, d.nama_asli].some(v => (v || '').toLowerCase().includes(q)))
})
const hapusDokId = ref(null)
async function lihatDok(d, unduh = false) {
  try { await bukaTabBaru(() => adminLihatDokumen(d.id, unduh)) } catch (e) { tampil(e.message, 'danger') }
}
async function hapusDok(d) {
  if (hapusDokId.value !== d.id) { hapusDokId.value = d.id; return }
  try { await adminHapusDokumen(d.id); hapusDokId.value = null; tampil('Dokumen dihapus.'); muat(true) } catch (e) { tampil(e.message, 'danger') }
}

// ---------- Unduh ----------
const mengunduh = ref(false)
async function unduh() {
  mengunduh.value = true
  try { unduhRekap(murid.value, log.value, dokumen.value) }
  catch (e) { tampil('Gagal membuat Excel: ' + e.message, 'danger') } finally { mengunduh.value = false }
}
</script>

<template>
  <main class="container-xl py-4">
    <!-- Kepala -->
    <div class="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-3">
      <div class="d-flex align-items-center gap-3">
        <img src="/logo.png" alt="" style="width:48px" />
        <div>
          <h1 class="h5 fw-bold mb-0">Panel Data Pusat Sekolah</h1>
          <div class="small text-secondary">
            <span class="live-dot me-1" :class="{ mati: !live }"></span>{{ live ? 'Realtime aktif' : 'Menyambungkan…' }}
            · diperbarui {{ terakhir ? terakhir.toLocaleTimeString('id-ID') : '-' }} · login: {{ sesi?.username }}
          </div>
        </div>
      </div>
      <div class="d-flex gap-2">
        <button class="btn btn-sm btn-outline-secondary" :disabled="memuat" @click="muat()"><i class="bi bi-arrow-clockwise"></i><span class="d-none d-sm-inline ms-1">Muat Ulang</span></button>
        <button class="btn btn-sm btn-primary" :disabled="mengunduh || !total" @click="unduh"><span v-if="mengunduh" class="spinner-border spinner-border-sm me-1"></span><i v-else class="bi bi-file-earmark-excel me-1"></i>Unduh Excel</button>
        <button class="btn btn-sm btn-outline-danger" @click="keluar"><i class="bi bi-box-arrow-right"></i><span class="d-none d-sm-inline ms-1">Keluar</span></button>
      </div>
    </div>

    <div v-if="pesan" class="alert py-2 small" :class="'alert-' + pesan.jenis">{{ pesan.teks }}</div>

    <ul class="nav nav-pills gap-1 mb-3 flex-nowrap overflow-auto">
      <li class="nav-item"><button class="nav-link" :class="{ active: tab === 'ringkasan' }" @click="tab = 'ringkasan'"><i class="bi bi-speedometer2 me-1"></i>Ringkasan</button></li>
      <li class="nav-item"><button class="nav-link text-nowrap" :class="{ active: tab === 'data' }" @click="tab = 'data'"><i class="bi bi-table me-1"></i>Data Murid</button></li>
      <li class="nav-item"><button class="nav-link text-nowrap" :class="{ active: tab === 'log' }" @click="tab = 'log'"><i class="bi bi-activity me-1"></i>Log Perbaikan <span class="badge text-bg-warning ms-1">{{ log.length }}</span></button></li>
      <li class="nav-item"><button class="nav-link text-nowrap" :class="{ active: tab === 'dokumen' }" @click="tab = 'dokumen'"><i class="bi bi-folder2-open me-1"></i>Dokumen <span class="badge text-bg-secondary ms-1">{{ dokumen.length }}</span></button></li>
      <li class="nav-item"><button class="nav-link" :class="{ active: tab === 'pengaturan' }" @click="tab = 'pengaturan'"><i class="bi bi-gear me-1"></i>Pengaturan</button></li>
    </ul>

    <div v-if="memuat && !murid.length" class="text-center py-5"><div class="spinner-border text-success"></div></div>

    <!-- RINGKASAN -->
    <template v-else-if="tab === 'ringkasan'">
      <div class="row g-3 mb-3">
        <div class="col-6 col-lg-3"><div class="stat-kartu"><div class="ket">Total Murid</div><div class="angka">{{ total }}</div><div class="ket">{{ daftarKelas.length }} rombel</div></div></div>
        <div class="col-6 col-lg-3"><div class="stat-kartu"><div class="ket">Data Benar</div><div class="angka text-success">{{ nBenar }}</div><div class="ket">dikonfirmasi tanpa perubahan</div></div></div>
        <div class="col-6 col-lg-3"><div class="stat-kartu"><div class="ket">Diperbaiki</div><div class="angka" style="color:#b88a00">{{ nPerbaiki }}</div><div class="ket">{{ log.length }} kolom berubah</div></div></div>
        <div class="col-6 col-lg-3"><div class="stat-kartu"><div class="ket">Belum Konfirmasi</div><div class="angka text-secondary">{{ nBelum }}</div><div class="ket">{{ nTidakLengkap }} murid datanya belum lengkap</div></div></div>
      </div>
      <div class="alert alert-light border small mb-3"><i class="bi bi-folder2-open text-hijau me-1"></i><b>{{ dokumen.length }} dokumen</b> diunggah oleh <b>{{ nMuridDok }} murid</b>. <a href="#" @click.prevent="tab = 'dokumen'">Lihat dokumen</a></div>
      <div class="kartu p-3 p-md-4 mb-3">
        <div class="d-flex justify-content-between mb-1"><b>Progres Konfirmasi Sekolah</b><b>{{ persen }}%</b></div>
        <div class="progress progress-tipis" role="progressbar" :aria-valuenow="persen" aria-valuemin="0" aria-valuemax="100">
          <div class="progress-bar bg-success" :style="{ width: (total ? nBenar / total * 100 : 0) + '%' }"></div>
          <div class="progress-bar bg-warning" :style="{ width: (total ? nPerbaiki / total * 100 : 0) + '%' }"></div>
        </div>
        <div class="small text-secondary mt-1"><span class="me-3"><i class="bi bi-square-fill text-success"></i> Benar</span><span class="me-3"><i class="bi bi-square-fill text-warning"></i> Diperbaiki</span><span><i class="bi bi-square-fill text-secondary opacity-25"></i> Belum</span></div>
      </div>
      <div class="kartu p-0 overflow-hidden">
        <div class="table-responsive">
          <table class="table table-hover table-data align-middle mb-0">
            <thead class="table-light"><tr><th class="ps-3">Kelas</th><th class="text-center">Murid</th><th class="text-center">Benar</th><th class="text-center">Diperbaiki</th><th class="text-center">Belum</th><th style="min-width:160px">Progres</th><th></th></tr></thead>
            <tbody>
              <tr v-for="k in perKelas" :key="k.kelas">
                <td class="ps-3 fw-semibold">{{ k.kelas }}</td><td class="text-center">{{ k.total }}</td>
                <td class="text-center text-success">{{ k.benar }}</td><td class="text-center" style="color:#b88a00">{{ k.perbaiki }}</td><td class="text-center text-secondary">{{ k.belum }}</td>
                <td><div class="d-flex align-items-center gap-2"><div class="progress progress-tipis flex-fill"><div class="progress-bar bg-success" :style="{ width: k.persen + '%' }"></div></div><small>{{ k.persen }}%</small></div></td>
                <td class="text-end pe-3"><button class="btn btn-sm btn-link" @click="lihatKelas(k.kelas)">Lihat</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- DATA MURID -->
    <template v-else-if="tab === 'data'">
      <div class="kartu p-3 mb-3">
        <div class="row g-2 align-items-center">
          <div class="col-md-4"><div class="input-group input-group-sm"><span class="input-group-text"><i class="bi bi-search"></i></span><input v-model="fCari" class="form-control" placeholder="Cari nama, NISN, orang tua, alamat, HP…" /></div></div>
          <div class="col-6 col-md-2"><select v-model="fKelas" class="form-select form-select-sm"><option value="">Semua kelas</option><option v-for="k in daftarKelas" :key="k">{{ k }}</option></select></div>
          <div class="col-6 col-md-3"><select v-model="fStatus" class="form-select form-select-sm"><option value="">Semua status</option><option v-for="(s, k) in STATUS" :key="k" :value="k">{{ s.label }}</option></select></div>
          <div class="col-md-3"><div class="form-check form-switch mb-0"><input id="fb" v-model="fBermasalah" class="form-check-input" type="checkbox" /><label for="fb" class="form-check-label small">Hanya data belum lengkap</label></div></div>
        </div>
      </div>
      <div class="small text-secondary mb-2">{{ tersaring.length }} murid ditemukan</div>
      <div class="kartu p-0 overflow-hidden">
        <div class="table-responsive">
          <table class="table table-hover table-data align-middle mb-0">
            <thead class="table-light"><tr><th class="ps-3">No</th><th>Nama / NISN</th><th>Kelas</th><th>Tgl Lahir</th><th>Alamat</th><th>No. HP</th><th>Ayah</th><th>Ibu</th><th>Status</th><th></th></tr></thead>
            <tbody>
              <tr v-for="(m, i) in halaman" :key="m.nisn">
                <td class="ps-3 text-secondary">{{ (hal - 1) * PER + i + 1 }}</td>
                <td><div class="fw-semibold">{{ m.nama }}</div><small class="text-secondary">{{ m.nisn }}</small></td>
                <td>{{ m.kelas }}</td>
                <td class="text-nowrap">{{ m.tgl_lahir }}</td>
                <td class="sel-alamat"><span :class="{ 'text-danger': cekKolom('alamat', m.alamat) }">{{ m.alamat || '—' }}</span></td>
                <td class="text-nowrap"><span :class="{ 'text-danger': cekKolom('no_hp', m.no_hp) }">{{ m.no_hp || '—' }}</span></td>
                <td><div :class="{ 'text-danger': !m.nama_ayah }">{{ m.nama_ayah || '—' }}</div><small class="text-secondary">{{ m.pekerjaan_ayah }}</small></td>
                <td><div :class="{ 'text-danger': !m.nama_ibu }">{{ m.nama_ibu || '—' }}</div><small class="text-secondary">{{ m.pekerjaan_ibu }}</small></td>
                <td><span class="badge" :class="STATUS[m.status]?.kelas">{{ STATUS[m.status]?.label }}</span><div v-if="m.catatan" class="small text-info" :title="m.catatan"><i class="bi bi-chat-left-text"></i> catatan</div></td>
                <td class="pe-3"><button class="btn btn-sm btn-outline-primary" @click="diedit = m" :aria-label="'Edit ' + m.nama"><i class="bi bi-pencil"></i></button></td>
              </tr>
              <tr v-if="!halaman.length"><td colspan="10" class="text-center text-secondary py-4">Tidak ada data.</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <nav v-if="jmlHal > 1" class="d-flex justify-content-center align-items-center gap-2 mt-3">
        <button class="btn btn-sm btn-outline-secondary" :disabled="hal === 1" @click="hal--"><i class="bi bi-chevron-left"></i></button>
        <span class="small">Halaman {{ hal }} / {{ jmlHal }}</span>
        <button class="btn btn-sm btn-outline-secondary" :disabled="hal === jmlHal" @click="hal++"><i class="bi bi-chevron-right"></i></button>
      </nav>
    </template>

    <!-- LOG -->
    <template v-else-if="tab === 'log'">
      <div class="kartu p-3 mb-3 d-flex flex-wrap gap-2 align-items-center justify-content-between">
        <div class="d-flex align-items-center gap-2">
          <span class="live-dot" :class="{ mati: !live }"></span>
          <span class="small"><b>Log perbaikan realtime</b> — perubahan dari murid muncul otomatis tanpa memuat ulang.</span>
        </div>
        <div class="d-flex gap-2">
          <input v-model="fLog" class="form-control form-control-sm" style="max-width:220px" placeholder="Saring log…" />
          <button class="btn btn-sm btn-danger text-nowrap" :disabled="!log.length" @click="dialogBersih = true"><i class="bi bi-trash3 me-1"></i>Bersihkan Log</button>
        </div>
      </div>
      <div class="kartu p-0 overflow-hidden">
        <div class="table-responsive">
          <table class="table table-data align-middle mb-0">
            <thead class="table-light"><tr><th class="ps-3">Waktu</th><th>Murid</th><th>Kolom</th><th>Data Lama</th><th>Data Baru</th><th>Oleh</th></tr></thead>
            <tbody>
              <tr v-for="l in logTersaring" :key="l.id" :class="{ 'log-baru': logBaru.has(l.id) }">
                <td class="ps-3 text-nowrap small">{{ waktu(l.created_at) }}</td>
                <td><div class="fw-semibold">{{ l.nama }}</div><small class="text-secondary">{{ l.nisn }} · {{ l.kelas }}</small></td>
                <td class="text-nowrap">{{ l.label }}</td>
                <td class="small"><span class="lama">{{ l.nilai_lama || '(kosong)' }}</span></td>
                <td class="small fw-semibold text-success">{{ l.nilai_baru || '(kosong)' }}</td>
                <td><span class="badge" :class="l.sumber === 'admin' ? 'text-bg-dark' : 'text-bg-light border'">{{ l.sumber === 'admin' ? 'Admin' : 'Murid' }}</span></td>
              </tr>
              <tr v-if="!logTersaring.length"><td colspan="6" class="text-center text-secondary py-5"><i class="bi bi-inbox fs-3 d-block mb-1"></i>Belum ada log perbaikan.</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- DOKUMEN -->
    <template v-else-if="tab === 'dokumen'">
      <div class="kartu p-3 mb-3">
        <div class="row g-2 align-items-center">
          <div class="col-md-5"><div class="input-group input-group-sm"><span class="input-group-text"><i class="bi bi-search"></i></span><input v-model="fDok" class="form-control" placeholder="Cari nama murid, NISN, nama file…" /></div></div>
          <div class="col-6 col-md-3"><select v-model="fDokKelas" class="form-select form-select-sm"><option value="">Semua kelas</option><option v-for="k in daftarKelas" :key="k">{{ k }}</option></select></div>
          <div class="col-6 col-md-4"><select v-model="fDokJenis" class="form-select form-select-sm"><option value="">Semua jenis dokumen</option><option v-for="j in JENIS_DOKUMEN" :key="j">{{ j }}</option></select></div>
        </div>
      </div>
      <div class="small text-secondary mb-2">{{ dokTersaring.length }} dokumen · tautan lihat/unduh berlaku 5 menit</div>
      <div class="kartu p-0 overflow-hidden">
        <div class="table-responsive">
          <table class="table table-hover table-data align-middle mb-0">
            <thead class="table-light"><tr><th class="ps-3">Waktu</th><th>Murid</th><th>Jenis</th><th>File</th><th>Ukuran</th><th class="pe-3"></th></tr></thead>
            <tbody>
              <tr v-for="d in dokTersaring" :key="d.id">
                <td class="ps-3 text-nowrap small">{{ waktu(d.created_at) }}</td>
                <td><div class="fw-semibold">{{ d.nama }}</div><small class="text-secondary">{{ d.nisn }} · {{ d.kelas }}</small></td>
                <td class="text-nowrap">{{ d.jenis }}</td>
                <td class="small"><i class="bi me-1" :class="d.mime === 'application/pdf' ? 'bi-file-earmark-pdf text-danger' : 'bi-file-earmark-image text-primary'"></i>{{ d.nama_asli }}</td>
                <td class="text-nowrap small">{{ formatUkuran(d.ukuran) }}</td>
                <td class="pe-3 text-nowrap text-end">
                  <button class="btn btn-sm btn-outline-primary me-1" title="Lihat" @click="lihatDok(d)"><i class="bi bi-eye"></i></button>
                  <button class="btn btn-sm btn-outline-secondary me-1" title="Unduh" @click="lihatDok(d, true)"><i class="bi bi-download"></i></button>
                  <button class="btn btn-sm" :class="hapusDokId === d.id ? 'btn-danger' : 'btn-outline-danger'" title="Hapus" @click="hapusDok(d)"><i class="bi bi-trash"></i><span v-if="hapusDokId === d.id" class="ms-1">Yakin?</span></button>
                </td>
              </tr>
              <tr v-if="!dokTersaring.length"><td colspan="6" class="text-center text-secondary py-5"><i class="bi bi-inbox fs-3 d-block mb-1"></i>Belum ada dokumen.</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- PENGATURAN -->
    <Pengaturan v-else-if="tab === 'pengaturan'" :info="info" :jumlah-murid="total" @berubah="muat(true)" @pesan="tampil" />

    <EditMurid v-if="diedit" :murid="diedit" :daftar-kelas="daftarKelas" :dokumen="dokumen.filter(d => d.nisn === diedit.nisn)" @lihat-dok="lihatDok" @tutup="diedit = null" @tersimpan="tersimpan" />

    <Dialog v-if="dialogBersih" judul="Bersihkan log perbaikan?" @tutup="dialogBersih = false">
      <p class="mb-2">Seluruh <b>{{ log.length }} catatan log perbaikan</b> akan dihapus permanen.</p>
      <p class="small text-secondary mb-0">Data murid yang sudah diperbaiki dan status konfirmasinya <b>tidak</b> berubah. Disarankan unduh Excel terlebih dahulu karena sheet "Log Perbaikan" ikut tersimpan di sana.</p>
      <template #kaki>
        <button class="btn btn-sm btn-outline-primary me-auto" @click="unduh"><i class="bi bi-file-earmark-excel me-1"></i>Unduh Excel dulu</button>
        <button class="btn btn-sm btn-outline-secondary" @click="dialogBersih = false">Batal</button>
        <button class="btn btn-sm btn-danger" :disabled="membersihkan" @click="bersihkanLog"><span v-if="membersihkan" class="spinner-border spinner-border-sm me-1"></span>Ya, Bersihkan</button>
      </template>
    </Dialog>
  </main>
</template>
