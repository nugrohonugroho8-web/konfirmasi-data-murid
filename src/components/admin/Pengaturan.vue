<script setup>
import { ref, watch } from 'vue'
import Dialog from '../Dialog.vue'
import { bacaExcel, unduhTemplate } from '../../lib/excel'
import { adminUnggah, adminSimpanPengaturan, adminResetStatus, adminGantiPassword } from '../../lib/api'

const props = defineProps({ info: Object, jumlahMurid: Number })
const emit = defineEmits(['berubah', 'pesan'])

// ---- Upload data ----
const fileInput = ref(null)
const seret = ref(false)
const namaFile = ref('')
const hasilBaca = ref(null)
const galatBaca = ref('')
const mode = ref('gabung')
const mengunggah = ref(false)
const konfirmGanti = ref(false)
const ketikGanti = ref('')

async function pilihFile(file) {
  galatBaca.value = ''; hasilBaca.value = null; namaFile.value = ''
  if (!file) return
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) { galatBaca.value = 'Format file harus .xlsx, .xls, atau .csv'; return }
  namaFile.value = file.name
  try {
    const h = await bacaExcel(file)
    if (!h.rows.length) { galatBaca.value = 'Tidak ditemukan data murid. Pastikan ada baris judul kolom yang memuat "NISN" dan "Nama".'; return }
    hasilBaca.value = h
  } catch (e) { galatBaca.value = 'Gagal membaca file: ' + e.message }
}
function onDrop(e) { seret.value = false; pilihFile(e.dataTransfer.files[0]) }

async function unggah() {
  if (mode.value === 'ganti' && !konfirmGanti.value) { konfirmGanti.value = true; ketikGanti.value = ''; return }
  konfirmGanti.value = false
  mengunggah.value = true
  try {
    const rows = hasilBaca.value.rows
    let tot = { baru: 0, diperbarui: 0, dilewati: 0, total: 0 }
    // kirim bertahap agar aman untuk data besar
    for (let i = 0; i < rows.length; i += 400) {
      const r = await adminUnggah(rows.slice(i, i + 400), i === 0 ? mode.value : 'gabung')
      tot = { baru: tot.baru + r.baru, diperbarui: tot.diperbarui + r.diperbarui, dilewati: tot.dilewati + r.dilewati, total: r.total }
    }
    emit('pesan', `Unggah selesai: ${tot.baru} murid baru, ${tot.diperbarui} diperbarui. Total sekarang ${tot.total} murid.`)
    hasilBaca.value = null; namaFile.value = ''
    if (fileInput.value) fileInput.value.value = ''
    emit('berubah')
  } catch (e) { emit('pesan', e.message, 'danger') } finally { mengunggah.value = false }
}

// ---- Portal ----
const dibuka = ref(props.info?.portal_dibuka ?? true)
const pengumuman = ref(props.info?.pengumuman ?? '')
watch(() => props.info, v => { if (v) { dibuka.value = v.portal_dibuka; pengumuman.value = v.pengumuman } })
const simpanPortal = ref(false)
async function simpanPengaturan() {
  simpanPortal.value = true
  try { await adminSimpanPengaturan(dibuka.value, pengumuman.value); emit('pesan', 'Pengaturan portal disimpan.'); emit('berubah') }
  catch (e) { emit('pesan', e.message, 'danger') } finally { simpanPortal.value = false }
}

// ---- Reset semua ----
const dialogReset = ref(false)
const ketikReset = ref('')
async function resetSemua() {
  try { const n = await adminResetStatus(null); dialogReset.value = false; emit('pesan', `${n} status konfirmasi direset.`); emit('berubah') }
  catch (e) { emit('pesan', e.message, 'danger') }
}

// ---- Password ----
const pw = ref({ lama: '', baru: '', ulang: '' })
const galatPw = ref('')
async function gantiPw() {
  galatPw.value = ''
  if (pw.value.baru !== pw.value.ulang) { galatPw.value = 'Konfirmasi password tidak sama.'; return }
  try { await adminGantiPassword(pw.value.lama, pw.value.baru); pw.value = { lama: '', baru: '', ulang: '' }; emit('pesan', 'Password admin berhasil diganti.') }
  catch (e) { galatPw.value = e.message }
}
</script>

<template>
  <div class="row g-3">
    <!-- Upload -->
    <div class="col-12">
      <div class="kartu p-3 p-md-4">
        <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
          <div>
            <h2 class="h6 fw-bold mb-1"><i class="bi bi-cloud-arrow-up text-hijau me-2"></i>Upload Data Murid</h2>
            <div class="small text-secondary">Unggah file Excel data murid. Semua sheet yang memiliki kolom <b>NISN</b> dan <b>Nama</b> akan dibaca; NISN ganda otomatis digabung.</div>
          </div>
          <button class="btn btn-sm btn-outline-primary" @click="unduhTemplate"><i class="bi bi-file-earmark-spreadsheet me-1"></i>Unduh Template</button>
        </div>

        <div class="dropzone" :class="{ aktif: seret }" @click="fileInput.click()" @dragover.prevent="seret = true" @dragleave="seret = false" @drop.prevent="onDrop">
          <i class="bi bi-file-earmark-excel fs-1 text-hijau"></i>
          <div class="fw-semibold">{{ namaFile || 'Klik atau seret file Excel ke sini' }}</div>
          <div class="small text-secondary">Kolom: No, Nama Lengkap, NISN, Tanggal Lahir, Kelas, Alamat, No. HP, Nama Ayah, Pekerjaan Ayah, Nama Ibu, Pekerjaan Ibu</div>
          <input ref="fileInput" type="file" accept=".xlsx,.xls,.csv" class="d-none" @change="pilihFile($event.target.files[0])" />
        </div>
        <div v-if="galatBaca" class="alert alert-danger small mt-3 mb-0">{{ galatBaca }}</div>

        <div v-if="hasilBaca" class="mt-3">
          <div class="alert alert-success small">
            <b>{{ hasilBaca.rows.length }} murid unik</b> terbaca dari
            <span v-for="(r, i) in hasilBaca.ringkasan" :key="r.sheet">{{ i ? ', ' : '' }}sheet "{{ r.sheet }}" ({{ r.jumlah }} baris)</span>.
            <span v-if="hasilBaca.duplikat"> {{ hasilBaca.duplikat }} baris NISN ganda digabung.</span>
            <span v-if="hasilBaca.dilewati"> {{ hasilBaca.dilewati }} baris tanpa NISN/nama dilewati.</span>
          </div>
          <div class="table-responsive border rounded mb-3" style="max-height:260px">
            <table class="table table-sm table-data mb-0">
              <thead class="table-light sticky-top"><tr><th>NISN</th><th>Nama</th><th>Tgl Lahir</th><th>Kelas</th><th>Alamat</th><th>No. HP</th><th>Ayah</th><th>Ibu</th></tr></thead>
              <tbody>
                <tr v-for="r in hasilBaca.rows.slice(0, 15)" :key="r.nisn">
                  <td>{{ r.nisn }}</td><td>{{ r.nama }}</td><td>{{ r.tgl_lahir }}</td><td>{{ r.kelas }}</td><td class="text-truncate" style="max-width:220px">{{ r.alamat }}</td><td>{{ r.no_hp }}</td><td>{{ r.nama_ayah }}</td><td>{{ r.nama_ibu }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="small text-secondary mb-2" v-if="hasilBaca.rows.length > 15">Menampilkan 15 dari {{ hasilBaca.rows.length }} baris.</div>

          <div class="mb-3">
            <div class="form-check">
              <input id="m1" v-model="mode" class="form-check-input" type="radio" value="gabung" />
              <label for="m1" class="form-check-label"><b>Tambah &amp; perbarui</b> — murid baru ditambahkan, NISN yang sudah ada diperbarui (status konfirmasi tetap).</label>
            </div>
            <div class="form-check">
              <input id="m2" v-model="mode" class="form-check-input" type="radio" value="ganti" />
              <label for="m2" class="form-check-label text-danger"><b>Ganti semua</b> — hapus seluruh {{ jumlahMurid }} data murid &amp; log perbaikan, lalu isi dengan file ini.</label>
            </div>
          </div>
          <button class="btn btn-primary" :disabled="mengunggah" @click="unggah">
            <span v-if="mengunggah" class="spinner-border spinner-border-sm me-1"></span><i v-else class="bi bi-upload me-1"></i>Unggah {{ hasilBaca.rows.length }} Murid ke Database
          </button>
        </div>
      </div>
    </div>

    <!-- Portal -->
    <div class="col-lg-6">
      <div class="kartu p-3 p-md-4 h-100">
        <h2 class="h6 fw-bold mb-3"><i class="bi bi-toggles text-hijau me-2"></i>Status Portal Murid</h2>
        <div class="form-check form-switch mb-3">
          <input id="buka" v-model="dibuka" class="form-check-input" type="checkbox" role="switch" />
          <label for="buka" class="form-check-label">{{ dibuka ? 'Dibuka — murid dapat menyimpan konfirmasi/perbaikan' : 'Ditutup — murid hanya dapat melihat data' }}</label>
        </div>
        <label for="peng" class="form-label small fw-semibold">Pengumuman di halaman depan</label>
        <textarea id="peng" v-model="pengumuman" rows="2" maxlength="500" class="form-control mb-3" placeholder="Contoh: Batas konfirmasi data 30 November 2026."></textarea>
        <button class="btn btn-primary btn-sm" :disabled="simpanPortal" @click="simpanPengaturan"><i class="bi bi-save me-1"></i>Simpan Pengaturan</button>
      </div>
    </div>

    <!-- Password & reset -->
    <div class="col-lg-6">
      <div class="kartu p-3 p-md-4 h-100">
        <h2 class="h6 fw-bold mb-3"><i class="bi bi-key text-hijau me-2"></i>Ganti Password Admin</h2>
        <form @submit.prevent="gantiPw" class="row g-2">
          <div class="col-12"><input v-model="pw.lama" type="password" class="form-control form-control-sm" placeholder="Password lama" autocomplete="current-password" /></div>
          <div class="col-6"><input v-model="pw.baru" type="password" class="form-control form-control-sm" placeholder="Password baru" autocomplete="new-password" /></div>
          <div class="col-6"><input v-model="pw.ulang" type="password" class="form-control form-control-sm" placeholder="Ulangi password baru" autocomplete="new-password" /></div>
          <div v-if="galatPw" class="col-12"><div class="alert alert-danger small py-1 mb-0">{{ galatPw }}</div></div>
          <div class="col-12"><button class="btn btn-sm btn-outline-primary" :disabled="!pw.lama || !pw.baru">Ganti Password</button></div>
        </form>
        <hr />
        <h2 class="h6 fw-bold mb-2 text-danger"><i class="bi bi-arrow-counterclockwise me-2"></i>Reset Semua Status Konfirmasi</h2>
        <p class="small text-secondary mb-2">Mengembalikan status seluruh murid menjadi "Belum Konfirmasi" (data yang sudah diperbaiki tetap). Gunakan saat memulai periode konfirmasi baru.</p>
        <button class="btn btn-sm btn-outline-danger" @click="dialogReset = true; ketikReset = ''">Reset Semua Status</button>
      </div>
    </div>
  </div>

  <Dialog v-if="konfirmGanti" judul="Ganti seluruh data murid?" @tutup="konfirmGanti = false">
    <p>Tindakan ini akan <b class="text-danger">menghapus {{ jumlahMurid }} data murid beserta seluruh log perbaikan</b>, lalu menggantinya dengan {{ hasilBaca?.rows.length }} murid dari file <b>{{ namaFile }}</b>. Tindakan tidak dapat dibatalkan.</p>
    <p class="small mb-1">Sebaiknya unduh rekap Excel terlebih dahulu. Ketik <b>GANTI</b> untuk melanjutkan:</p>
    <input v-model="ketikGanti" class="form-control" />
    <template #kaki>
      <button class="btn btn-sm btn-outline-secondary" @click="konfirmGanti = false">Batal</button>
      <button class="btn btn-sm btn-danger" :disabled="ketikGanti !== 'GANTI'" @click="unggah">Ganti Semua Data</button>
    </template>
  </Dialog>

  <Dialog v-if="dialogReset" judul="Reset semua status konfirmasi?" @tutup="dialogReset = false">
    <p class="small mb-1">Ketik <b>RESET</b> untuk melanjutkan:</p>
    <input v-model="ketikReset" class="form-control" />
    <template #kaki>
      <button class="btn btn-sm btn-outline-secondary" @click="dialogReset = false">Batal</button>
      <button class="btn btn-sm btn-danger" :disabled="ketikReset !== 'RESET'" @click="resetSemua">Reset</button>
    </template>
  </Dialog>
</template>
