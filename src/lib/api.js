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
  FORMAT_DATA_SALAH: 'Format data unggahan tidak valid.'
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

// Realtime: sinyal tanpa data pribadi dari trigger database (kanal broadcast publik)
export function dengarPerubahan(cb, onStatus = () => {}) {
  const ch = supabase.channel('log-perbaikan')
    .on('broadcast', { event: 'berubah' }, cb)
    .subscribe(status => onStatus(status === 'SUBSCRIBED'))
  return () => supabase.removeChannel(ch)
}
