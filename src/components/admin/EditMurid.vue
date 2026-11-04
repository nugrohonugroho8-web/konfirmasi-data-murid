<script setup>
import { reactive, ref } from 'vue'
import Dialog from '../Dialog.vue'
import InputTanggal from '../InputTanggal.vue'
import { KOLOM_EDIT, PEKERJAAN, STATUS, waktu } from '../../lib/kolom'
import { adminSimpanMurid, adminHapusMurid, adminResetStatus } from '../../lib/api'

const props = defineProps({ murid: Object, daftarKelas: Array })
const emit = defineEmits(['tutup', 'tersimpan'])
const form = reactive({ kelas: props.murid.kelas, status: props.murid.status })
KOLOM_EDIT.forEach(k => { form[k.key] = props.murid[k.key] || '' })
const sibuk = ref(false)
const galat = ref('')
const yakinHapus = ref(false)

function pilihan(n) { return n && !PEKERJAAN.includes(n) ? [n, ...PEKERJAAN] : PEKERJAAN }

async function simpan() {
  sibuk.value = true; galat.value = ''
  try {
    const data = { kelas: form.kelas, status: form.status }
    KOLOM_EDIT.forEach(k => { if ((form[k.key] || '').trim() !== (props.murid[k.key] || '')) data[k.key] = form[k.key].trim() })
    emit('tersimpan', await adminSimpanMurid(props.murid.nisn, data), 'Data murid disimpan.')
  } catch (e) { galat.value = e.message } finally { sibuk.value = false }
}
async function reset() {
  sibuk.value = true; galat.value = ''
  try { await adminResetStatus(props.murid.nisn); emit('tersimpan', null, 'Status konfirmasi direset.') } catch (e) { galat.value = e.message } finally { sibuk.value = false }
}
async function hapus() {
  if (!yakinHapus.value) { yakinHapus.value = true; return }
  sibuk.value = true; galat.value = ''
  try { await adminHapusMurid(props.murid.nisn); emit('tersimpan', null, 'Murid dihapus.') } catch (e) { galat.value = e.message } finally { sibuk.value = false }
}
</script>

<template>
  <Dialog :judul="`Edit Data — ${murid.nama}`" lebar="760px" @tutup="emit('tutup')">
    <div class="small text-secondary mb-3">
      NISN <b>{{ murid.nisn }}</b> · Status <span class="badge" :class="STATUS[murid.status]?.kelas">{{ STATUS[murid.status]?.label }}</span>
      <span v-if="murid.dikonfirmasi_at"> · dikonfirmasi {{ waktu(murid.dikonfirmasi_at) }}</span>
    </div>
    <div v-if="murid.catatan" class="alert alert-info small py-2"><i class="bi bi-chat-left-text me-1"></i><b>Catatan murid:</b> {{ murid.catatan }}</div>
    <div class="row g-3">
      <div v-for="k in KOLOM_EDIT" :key="k.key" :class="k.tipe === 'textarea' ? 'col-12' : 'col-md-6'">
        <label class="form-label small fw-semibold mb-1">{{ k.label }}</label>
        <InputTanggal v-if="k.tipe === 'tanggal'" v-model="form[k.key]" :tahun-awal="2000" :tahun-akhir="2020" />
        <textarea v-else-if="k.tipe === 'textarea'" v-model="form[k.key]" rows="2" class="form-control form-control-sm"></textarea>
        <select v-else-if="k.tipe === 'pekerjaan'" v-model="form[k.key]" class="form-select form-select-sm">
          <option value="">—</option>
          <option v-for="p in pilihan(murid[k.key])" :key="p">{{ p }}</option>
        </select>
        <input v-else v-model="form[k.key]" class="form-control form-control-sm" />
        <div v-if="murid.data_asli && (murid.data_asli[k.key] || '') !== (murid[k.key] || '')" class="small text-secondary mt-1">
          Data awal: <span class="lama">{{ murid.data_asli[k.key] || '(kosong)' }}</span>
        </div>
      </div>
      <div class="col-md-6">
        <label class="form-label small fw-semibold mb-1">Kelas</label>
        <input v-model="form.kelas" list="daftar-kelas" class="form-control form-control-sm" />
        <datalist id="daftar-kelas"><option v-for="k in daftarKelas" :key="k" :value="k" /></datalist>
      </div>
      <div class="col-md-6">
        <label class="form-label small fw-semibold mb-1">Status Konfirmasi</label>
        <select v-model="form.status" class="form-select form-select-sm">
          <option v-for="(s, k) in STATUS" :key="k" :value="k">{{ s.label }}</option>
        </select>
      </div>
    </div>
    <div v-if="galat" class="alert alert-danger small py-2 mt-3 mb-0">{{ galat }}</div>
    <template #kaki>
      <button class="btn btn-sm me-auto" :class="yakinHapus ? 'btn-danger' : 'btn-outline-danger'" :disabled="sibuk" @click="hapus">
        <i class="bi bi-trash me-1"></i>{{ yakinHapus ? 'Klik lagi untuk hapus' : 'Hapus' }}
      </button>
      <button class="btn btn-sm btn-outline-secondary" :disabled="sibuk" @click="reset"><i class="bi bi-arrow-counterclockwise me-1"></i>Reset Status</button>
      <button class="btn btn-sm btn-primary" :disabled="sibuk" @click="simpan"><span v-if="sibuk" class="spinner-border spinner-border-sm me-1"></span>Simpan</button>
    </template>
  </Dialog>
</template>
