import { reactive } from 'vue'

// Sesi murid disimpan di sessionStorage (hilang saat tab ditutup)
const KUNCI = 'kdm_murid'
function muat() {
  try { return JSON.parse(sessionStorage.getItem(KUNCI) || 'null') } catch { return null }
}
const awal = muat()

export const sesiMurid = reactive({
  nisn: awal?.nisn || '',
  tgl: awal?.tgl || '',
  data: awal?.data || null
})

export function setMurid(nisn, tgl, data) {
  sesiMurid.nisn = nisn; sesiMurid.tgl = tgl; sesiMurid.data = data
  try { sessionStorage.setItem(KUNCI, JSON.stringify({ nisn, tgl, data })) } catch { /* abaikan */ }
}
export function keluarMurid() {
  sesiMurid.nisn = ''; sesiMurid.tgl = ''; sesiMurid.data = null
  try { sessionStorage.removeItem(KUNCI) } catch { /* abaikan */ }
}
