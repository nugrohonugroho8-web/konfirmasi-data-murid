import { supabase } from './supabase'

const PESAN = {
  TGL_TIDAK_COCOK: 'Tanggal lahir tidak cocok dengan data sekolah. Jika Anda yakin tanggal lahir sudah benar, kemungkinan data di sekolah keliru — silakan hubungi wali kelas/operator sekolah.',
  NISN_TIDAK_DITEMUKAN: 'NISN tidak ditemukan. Periksa kembali 10 digit NISN Anda (termasuk angka 0 di depan).',
  AKSES_DITOLAK: 'Sesi tidak valid. Silakan masuk ulang.',
  PORTAL_DITUTUP: 'Portal konfirmasi sedang ditutup oleh admin. Silakan coba lagi nanti.',
  LOGIN_GAGAL: 'Username atau password admin salah.',
  SESI_TIDAK_VALID: 'Sesi admin berakhir. Silakan login ulang.',
  PASSWORD_LAMA_SALAH: 'Password lama salah.',
  PASSWORD_TERLALU_PENDEK: 'Password baru minimal 6 karakter.',
  FORMAT_DATA_SALAH: 'Format data unggahan tidak valid.',
  UKURAN_TERLALU_BESAR: 'Ukuran file melebihi 1 MB. Perkecil/kompres file terlebih dahulu.',
  TIPE_TIDAK_DIDUKUNG: 'Tipe file harus JPG, JPEG, atau PDF.',
  JENIS_TIDAK_VALID: 'Pilih jenis dokumen terlebih dahulu.',
  BATAS_DOKUMEN: 'Batas maksimal 10 dokumen per murid tercapai. Hapus dokumen lama terlebih dahulu.',
  FILE_BELUM_ADA: 'File gagal terunggah. Silakan coba lagi.',
  DOKUMEN_TIDAK_ADA: 'Dokumen tidak ditemukan (mungkin sudah dihapus).',
  KHUSUS_MURID: 'Aksi ini khusus untuk murid.'
}
function terjemah(kode, cadangan) {
  return PESAN[kode] ? new ApiError(kode, PESAN[kode]) : new ApiError('LAIN', cadangan || 'Terjadi kesalahan.')
}

export class ApiError extends Error {
  constructor(kode, pesan) { super(pesan); this.kode = kode }
}

async function rpc(nama, args = {}) {
  const { data, error } = await supabase.rpc(nama, args)
  if (error) {
    const kode = Object.keys(PESAN).find(k => (error.message || '').includes(k))
    if (kode) throw new ApiError(kode, PESAN[kode])
    if (/fetch|network/i.test(error.message)) throw new ApiError('JARINGAN', 'Gagal terhubung ke server. Periksa koneksi internet Anda.')
    throw new ApiError('LAIN', error.message || 'Terjadi kesalahan.')
  }
  return data
}

// ---------- Murid ----------
export const infoPortal = () => rpc('info_portal')
export const muridMasuk = (nisn, tgl) => rpc('murid_masuk', { p_nisn: nisn, p_tgl_lahir: tgl })
export const muridSimpan = (nisn, tgl, data, catatan) =>
  rpc('murid_simpan', { p_nisn: nisn, p_tgl_lahir: tgl, p_data: data, p_catatan: catatan || '' })

// ---------- Admin ----------
const KUNCI = 'kdm_admin_sesi'
export function sesiAdmin() {
  try {
    const s = JSON.parse(sessionStorage.getItem(KUNCI) || 'null')
    if (s && new Date(s.expires_at) > new Date()) return s
  } catch { /* abaikan */ }
  return null
}
function simpanSesi(s) { try { s ? sessionStorage.setItem(KUNCI, JSON.stringify(s)) : sessionStorage.removeItem(KUNCI) } catch { /* abaikan */ } }

export async function adminMasuk(user, pass) {
  const s = await rpc('admin_masuk', { p_username: user, p_password: pass })
  simpanSesi(s)
  return s
}
export async function adminKeluar() {
  const s = sesiAdmin()
  simpanSesi(null)
  if (s) { try { await rpc('admin_keluar', { p_token: s.token }) } catch { /* abaikan */ } }
}
function token() {
  const s = sesiAdmin()
  if (!s) throw new ApiError('SESI_TIDAK_VALID', PESAN.SESI_TIDAK_VALID)
  return s.token
}
async function adminRpc(nama, args = {}) {
  try {
    return await rpc(nama, { p_token: token(), ...args })
  } catch (e) {
    if (e.kode === 'SESI_TIDAK_VALID') simpanSesi(null)
    throw e
  }
}

export const adminCek = () => adminRpc('admin_cek')
export const adminDataMurid = () => adminRpc('admin_data_murid')
export const adminLog = (batas = 1000) => adminRpc('admin_log', { p_batas: batas })
export const adminBersihkanLog = () => adminRpc('admin_bersihkan_log')
export const adminSimpanMurid = (nisn, data) => adminRpc('admin_simpan_murid', { p_nisn: nisn, p_data: data })
export const adminHapusMurid = (nisn) => adminRpc('admin_hapus_murid', { p_nisn: nisn })
export const adminUnggah = (rows, mode) => adminRpc('admin_unggah_data', { p_rows: rows, p_mode: mode })
export const adminResetStatus = (nisn = null) => adminRpc('admin_reset_status', { p_nisn: nisn })
export const adminSimpanPengaturan = (dibuka, pengumuman) =>
  adminRpc('admin_simpan_pengaturan', { p_portal_dibuka: dibuka, p_pengumuman: pengumuman })
export const adminGantiPassword = (lama, baru) => adminRpc('admin_ganti_password', { p_lama: lama, p_baru: baru })

// ---------- Dokumen (Supabase Storage via Edge Function "dokumen-murid") ----------
export const MAKS_UKURAN = 1024 * 1024
export const JENIS_DOKUMEN = ['Kartu Keluarga', 'Akta Kelahiran', 'KTP Ayah', 'KTP Ibu', 'KTP Wali', 'Ijazah / SKL', 'KIP / PIP / PKH', 'Foto Murid', 'Lainnya']

async function fnDokumen(body) {
  const { data, error } = await supabase.functions.invoke('dokumen-murid', { body })
  if (error) {
    let kode = ''
    try { kode = (await error.context.json()).error } catch { /* abaikan */ }
    if (!kode && /fetch|network/i.test(error.message)) throw new ApiError('JARINGAN', 'Gagal terhubung ke server. Periksa koneksi internet Anda.')
    throw terjemah(kode, 'Gagal memproses dokumen.')
  }
  return data
}
const kred = () => (sesiAdmin() ? { token: sesiAdmin().token } : {})

/** Tentukan MIME dari file (beberapa HP tidak mengisi file.type) */
export function mimeFile(file) {
  if (file.type === 'image/jpeg' || file.type === 'application/pdf') return file.type
  if (/\.(jpe?g)$/i.test(file.name)) return 'image/jpeg'
  if (/\.pdf$/i.test(file.name)) return 'application/pdf'
  return file.type || ''
}

export const muridDokumen = (nisn, tgl) => rpc('murid_dokumen', { p_nisn: nisn, p_tgl_lahir: tgl })
export async function muridUnggahDokumen(nisn, tgl, jenis, file) {
  const mime = mimeFile(file)
  if (!['image/jpeg', 'application/pdf'].includes(mime)) throw terjemah('TIPE_TIDAK_DIDUKUNG')
  if (file.size > MAKS_UKURAN) throw terjemah('UKURAN_TERLALU_BESAR')
  const s = await fnDokumen({ aksi: 'siapkan', nisn, tgl, jenis, mime, ukuran: file.size })
  // bungkus ulang agar tipe MIME selalu terkirim benar (beberapa HP mengirim tipe kosong)
  const berkas = new File([file], file.name, { type: mime })
  const { error } = await supabase.storage.from('dokumen-murid').uploadToSignedUrl(s.path, s.token, berkas, { contentType: mime })
  if (error) {
    if (/size|large/i.test(error.message)) throw terjemah('UKURAN_TERLALU_BESAR')
    if (/mime|type/i.test(error.message)) throw terjemah('TIPE_TIDAK_DIDUKUNG')
    throw new ApiError('UNGGAH', 'Gagal mengunggah file: ' + error.message)
  }
  return fnDokumen({ aksi: 'selesai', nisn, tgl, jenis, path: s.path, nama: file.name })
}
export const muridLihatDokumen = (nisn, tgl, id) => fnDokumen({ aksi: 'lihat', nisn, tgl, id }).then(r => r.url)
export const muridHapusDokumen = (nisn, tgl, id) => fnDokumen({ aksi: 'hapus', nisn, tgl, id })

export const adminDokumen = () => adminRpc('admin_dokumen')
export const adminLihatDokumen = (id, unduh = false) => fnDokumen({ aksi: 'lihat', id, unduh, ...kred() }).then(r => r.url)
export const adminHapusDokumen = (id) => fnDokumen({ aksi: 'hapus', id, ...kred() })

/** Buka URL bertanda tangan di tab baru tanpa diblokir pop-up blocker */
export async function bukaTabBaru(ambilUrl) {
  const w = window.open('about:blank', '_blank')
  try {
    const url = await ambilUrl()
    if (w) w.location.href = url; else window.location.href = url
  } catch (e) { if (w) w.close(); throw e }
}

export function formatUkuran(b) {
  return b >= 1024 * 1024 ? (b / 1024 / 1024).toFixed(2) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'
}

// Realtime: sinyal tanpa data pribadi dari trigger database (kanal broadcast publik)
export function dengarPerubahan(cb, onStatus = () => {}) {
  const ch = supabase.channel('log-perbaikan')
    .on('broadcast', { event: 'berubah' }, cb)
    .subscribe(status => onStatus(status === 'SUBSCRIBED'))
  return () => supabase.removeChannel(ch)
}
