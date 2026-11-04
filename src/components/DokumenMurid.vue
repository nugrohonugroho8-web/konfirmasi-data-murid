<script setup>
// Menu unggah dokumen pendukung untuk murid (JPG/JPEG/PDF, maks. 1 MB)
import { ref, onMounted } from 'vue'
import { JENIS_DOKUMEN, MAKS_UKURAN, mimeFile, muridDokumen, muridUnggahDokumen, muridLihatDokumen, muridHapusDokumen, bukaTabBaru, formatUkuran } from '../lib/api'
import { waktu } from '../lib/kolom'

const props = defineProps({ nisn: String, tgl: String, portalDibuka: { type: Boolean, default: true } })

const daftar = ref([])
const memuat = ref(true)
const jenis = ref('')
const file = ref(null)
const input = ref(null)
const mengunggah = ref(false)
const galat = ref('')
const sukses = ref('')
const hapusId = ref(null)

async function muat() {
  memuat.value = true
  try { daftar.value = await muridDokumen(props.nisn, props.tgl) } catch (e) { galat.value = e.message } finally { memuat.value = false }
}
onMounted(muat)

function pilih(e) {
  galat.value = ''; sukses.value = ''
  const f = e.target.files[0]
  file.value = null
  if (!f) return
  if (!['image/jpeg', 'application/pdf'].includes(mimeFile(f))) { galat.value = 'Tipe file harus JPG, JPEG, atau PDF.'; e.target.value = ''; return }
  if (f.size > MAKS_UKURAN) { galat.value = `Ukuran file ${formatUkuran(f.size)} melebihi batas 1 MB. Perkecil/kompres file terlebih dahulu.`; e.target.value = ''; return }
  file.value = f
}

async function unggah() {
  galat.value = ''; sukses.value = ''
  if (!jenis.value) { galat.value = 'Pilih jenis dokumen terlebih dahulu.'; return }
  if (!file.value) { galat.value = 'Pilih file yang akan diunggah.'; return }
  mengunggah.value = true
  try {
    await muridUnggahDokumen(props.nisn, props.tgl, jenis.value, file.value)
    sukses.value = `${jenis.value} berhasil diunggah.`
    file.value = null; jenis.value = ''
    if (input.value) input.value.value = ''
    await muat()
  } catch (e) { galat.value = e.message } finally { mengunggah.value = false }
}

async function lihat(d) {
  galat.value = ''
  try { await bukaTabBaru(() => muridLihatDokumen(props.nisn, props.tgl, d.id)) } catch (e) { galat.value = e.message }
}
async function hapus(d) {
  if (hapusId.value !== d.id) { hapusId.value = d.id; return }
  galat.value = ''; sukses.value = ''
  try { await muridHapusDokumen(props.nisn, props.tgl, d.id); hapusId.value = null; sukses.value = 'Dokumen dihapus.'; await muat() } catch (e) { galat.value = e.message }
}
</script>

<template>
  <div id="unggah-dokumen" class="kartu p-3 p-md-4 mb-3">
    <h2 class="h6 fw-bold mb-1 text-hijau"><i class="bi bi-cloud-arrow-up me-2"></i>Unggah Dokumen Pendukung</h2>
    <p class="small text-secondary mb-3">Unggah bukti data, misalnya <b>Kartu Keluarga</b> atau <b>Akta Kelahiran</b>, terutama jika Anda memperbaiki data. Format <b>JPG, JPEG, atau PDF</b>, ukuran <b>maksimal 1 MB</b> per file. Dokumen hanya dapat dilihat oleh Anda dan admin sekolah.</p>

    <div v-if="portalDibuka" class="row g-2 align-items-end mb-2">
      <div class="col-md-4">
        <label for="jenis-dok" class="form-label small fw-semibold mb-1">Jenis dokumen</label>
        <select id="jenis-dok" v-model="jenis" class="form-select">
          <option value="">— pilih —</option>
          <option v-for="j in JENIS_DOKUMEN" :key="j">{{ j }}</option>
        </select>
      </div>
      <div class="col-md-5">
        <label for="file-dok" class="form-label small fw-semibold mb-1">File (JPG/JPEG/PDF, maks. 1 MB)</label>
        <input id="file-dok" ref="input" type="file" class="form-control" accept=".jpg,.jpeg,.pdf,image/jpeg,application/pdf" @change="pilih" />
      </div>
      <div class="col-md-3 d-grid">
        <button class="btn btn-primary" :disabled="mengunggah || !file || !jenis" @click="unggah">
          <span v-if="mengunggah" class="spinner-border spinner-border-sm me-1"></span><i v-else class="bi bi-upload me-1"></i>{{ mengunggah ? 'Mengunggah…' : 'Unggah' }}
        </button>
      </div>
      <div v-if="file" class="col-12 small text-secondary"><i class="bi bi-paperclip"></i> {{ file.name }} · {{ formatUkuran(file.size) }}</div>
    </div>
    <div v-else class="alert alert-secondary small py-2">Portal ditutup — unggah dokumen tidak tersedia.</div>

    <div v-if="galat" class="alert alert-danger small py-2 mb-2"><i class="bi bi-exclamation-triangle me-1"></i>{{ galat }}</div>
    <div v-if="sukses" class="alert alert-success small py-2 mb-2"><i class="bi bi-check-circle me-1"></i>{{ sukses }}</div>

    <div class="fw-semibold small mt-3 mb-2">Dokumen terunggah ({{ daftar.length }}/10)</div>
    <div v-if="memuat" class="small text-secondary"><span class="spinner-border spinner-border-sm me-1"></span>Memuat…</div>
    <div v-else-if="!daftar.length" class="small text-secondary fst-italic">Belum ada dokumen.</div>
    <ul v-else class="list-group">
      <li v-for="d in daftar" :key="d.id" class="list-group-item d-flex flex-wrap gap-2 align-items-center">
        <i class="bi fs-4" :class="d.mime === 'application/pdf' ? 'bi-file-earmark-pdf text-danger' : 'bi-file-earmark-image text-primary'"></i>
        <div class="flex-fill" style="min-width:0">
          <div class="fw-semibold">{{ d.jenis }}</div>
          <div class="small text-secondary text-truncate">{{ d.nama_asli }} · {{ formatUkuran(d.ukuran) }} · {{ waktu(d.created_at) }}</div>
        </div>
        <button class="btn btn-sm btn-outline-primary" @click="lihat(d)"><i class="bi bi-eye me-1"></i>Lihat</button>
        <button v-if="portalDibuka" class="btn btn-sm" :class="hapusId === d.id ? 'btn-danger' : 'btn-outline-danger'" @click="hapus(d)">
          <i class="bi bi-trash"></i><span v-if="hapusId === d.id" class="ms-1">Yakin hapus?</span>
        </button>
      </li>
    </ul>
  </div>
</template>
