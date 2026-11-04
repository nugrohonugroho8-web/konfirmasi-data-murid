import * as XLSX from 'xlsx'
import { STATUS, waktu } from './kolom'

// ---------- Baca file Excel unggahan ----------
const POLA = [
  ['nisn', /\bnisn\b/i],
  ['pekerjaan_ayah', /pekerjaan\s*ayah/i],
  ['pekerjaan_ibu', /pekerjaan\s*ibu/i],
  ['nama_ayah', /nama\s*ayah|^ayah$/i],
  ['nama_ibu', /nama\s*ibu|^ibu$/i],
  ['tgl_lahir', /tanggal\s*lahir|tgl\.?\s*lahir/i],
  ['alamat', /alamat/i],
  ['no_hp', /\bhp\b|no\.?\s*hp|telepon|telp|whatsapp|\bwa\b/i],
  ['kelas', /kelas|rombel/i],
  ['nama', /nama\s*(lengkap|murid|siswa|peserta)|^nama$/i]
]

function petakanHeader(row) {
  const peta = {}
  row.forEach((sel, i) => {
    const teks = String(sel ?? '').trim()
    if (!teks) return
    for (const [key, re] of POLA) {
      if (peta[key] === undefined && re.test(teks)) { peta[key] = i; break }
    }
  })
  return peta
}

function pad2(n) { return String(n).padStart(2, '0') }
function formatTanggal(v) {
  if (v === null || v === undefined || v === '') return ''
  if (v instanceof Date && !isNaN(v)) return `${pad2(v.getDate())}-${pad2(v.getMonth() + 1)}-${v.getFullYear()}`
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v)
    if (d) return `${pad2(d.d)}-${pad2(d.m)}-${d.y}`
  }
  const s = String(v).trim()
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s)
  if (m) return `${pad2(m[3])}-${pad2(m[2])}-${m[1]}`
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s)
  if (m) return `${pad2(m[1])}-${pad2(m[2])}-${m[3]}`
  return s
}
function bersih(v) {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim()
  return s === '-' ? '' : s
}
function formatNisn(v) {
  let s = String(v ?? '').replace(/\D/g, '')
  if (s && s.length < 10) s = s.padStart(10, '0') // nol di depan hilang bila sel bertipe angka
  return s
}
function formatHp(v) {
  return String(v ?? '').replace(/[^0-9+]/g, '')
}

/**
 * Membaca semua sheet yang memiliki kolom NISN.
 * Hasil: { rows, ringkasan: [{sheet, jumlah}], duplikat, dilewati }
 */
export async function bacaExcel(file) {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })
  const peta = new Map()
  const ringkasan = []
  let duplikat = 0, dilewati = 0

  for (const nama of wb.SheetNames) {
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets[nama], { header: 1, raw: true, defval: '' })
    const idxHeader = aoa.slice(0, 20).findIndex(r => r.some(c => /\bnisn\b/i.test(String(c))))
    if (idxHeader < 0) continue
    const h = petakanHeader(aoa[idxHeader])
    if (h.nisn === undefined || h.nama === undefined) continue
    let jumlah = 0
    for (const r of aoa.slice(idxHeader + 1)) {
      const nisn = formatNisn(r[h.nisn])
      const namaMurid = bersih(r[h.nama])
      if (!nisn || !namaMurid) { if (r.some(c => String(c).trim())) dilewati++; continue }
      const row = {
        nisn,
        nama: namaMurid,
        tgl_lahir: h.tgl_lahir !== undefined ? formatTanggal(r[h.tgl_lahir]) : '',
        kelas: h.kelas !== undefined ? bersih(r[h.kelas]) : '',
        alamat: h.alamat !== undefined ? bersih(r[h.alamat]) : '',
        no_hp: h.no_hp !== undefined ? formatHp(r[h.no_hp]) : '',
        nama_ayah: h.nama_ayah !== undefined ? bersih(r[h.nama_ayah]) : '',
        pekerjaan_ayah: h.pekerjaan_ayah !== undefined ? bersih(r[h.pekerjaan_ayah]) : '',
        nama_ibu: h.nama_ibu !== undefined ? bersih(r[h.nama_ibu]) : '',
        pekerjaan_ibu: h.pekerjaan_ibu !== undefined ? bersih(r[h.pekerjaan_ibu]) : ''
      }
      if (peta.has(nisn)) duplikat++
      jumlah++
      peta.set(nisn, row)
    }
    ringkasan.push({ sheet: nama, jumlah })
  }
  return { rows: [...peta.values()], ringkasan, duplikat, dilewati }
}

// ---------- Ekspor ----------
const HEADER = ['No', 'Nama Lengkap', 'NISN', 'Tanggal Lahir', 'Kelas', 'Alamat Lengkap (RT, RW, Kelurahan, Kecamatan)', 'No. HP', 'Nama Ayah', 'Pekerjaan Ayah', 'Nama Ibu', 'Pekerjaan Ibu']
const LEBAR = [5, 34, 13, 13, 8, 60, 16, 28, 18, 28, 18]

function sheetDariAoa(aoa, lebar) {
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = lebar.map(w => ({ wch: w }))
  return ws
}

function urutKelas(a, b) {
  const t = k => ({ VII: 7, VIII: 8, IX: 9 }[(k || '').split('-')[0]] || 99)
  return t(a.kelas) - t(b.kelas) || a.kelas.localeCompare(b.kelas) || a.nama.localeCompare(b.nama)
}

export function unduhRekap(murid, log) {
  const wb = XLSX.utils.book_new()
  const data = [...murid].sort(urutKelas)

  // 1. Rekap per kelas
  const kelasList = [...new Set(data.map(m => m.kelas))]
  const rekap = [
    ['REKAP KONFIRMASI DATA MURID TAHUN PELAJARAN 2026/2027'],
    ['SMP NEGERI 2 TULANGAN'],
    [`Diunduh: ${waktu(new Date())}`],
    [],
    ['No', 'Kelas', 'Jumlah Murid', 'Data Benar', 'Diperbaiki', 'Belum Konfirmasi', 'Persentase Selesai']
  ]
  kelasList.forEach((k, i) => {
    const d = data.filter(m => m.kelas === k)
    const benar = d.filter(m => m.status === 'benar').length
    const perbaiki = d.filter(m => m.status === 'diperbaiki').length
    rekap.push([i + 1, k, d.length, benar, perbaiki, d.length - benar - perbaiki, `${Math.round(((benar + perbaiki) / d.length) * 100)}%`])
  })
  const tb = data.filter(m => m.status === 'benar').length
  const tp = data.filter(m => m.status === 'diperbaiki').length
  rekap.push(['', 'TOTAL', data.length, tb, tp, data.length - tb - tp, data.length ? `${Math.round(((tb + tp) / data.length) * 100)}%` : '0%'])
  const wsR = sheetDariAoa(rekap, [5, 12, 14, 12, 12, 18, 18])
  wsR['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } }]
  XLSX.utils.book_append_sheet(wb, wsR, 'Rekap')

  // 2. Semua murid + status
  const semua = [[...HEADER, 'Status Konfirmasi', 'Jumlah Perbaikan', 'Catatan Murid', 'Waktu Konfirmasi']]
  data.forEach((m, i) => semua.push([i + 1, m.nama, m.nisn, m.tgl_lahir, m.kelas, m.alamat, m.no_hp, m.nama_ayah, m.pekerjaan_ayah, m.nama_ibu, m.pekerjaan_ibu,
    STATUS[m.status]?.label || m.status, m.jumlah_perbaikan || 0, m.catatan || '', m.dikonfirmasi_at ? waktu(m.dikonfirmasi_at) : '']))
  XLSX.utils.book_append_sheet(wb, sheetDariAoa(semua, [...LEBAR, 18, 10, 40, 20]), 'Semua Murid')

  // 3. Per tingkat — format sama dengan file sumber (bisa diunggah ulang)
  for (const t of ['VII', 'VIII', 'IX']) {
    const d = data.filter(m => (m.kelas || '').split('-')[0] === t)
    if (!d.length) continue
    const aoa = [[`DATA PESERTA DIDIK KELAS ${t} - SMP NEGERI 2 TULANGAN`], ['Tahun Ajaran 2026/2027'], [], HEADER]
    d.forEach((m, i) => aoa.push([i + 1, m.nama, m.nisn, m.tgl_lahir, m.kelas, m.alamat, m.no_hp, m.nama_ayah, m.pekerjaan_ayah, m.nama_ibu, m.pekerjaan_ibu]))
    XLSX.utils.book_append_sheet(wb, sheetDariAoa(aoa, LEBAR), `Kelas ${t}`)
  }

  // 4. Log perbaikan
  const aoaLog = [['No', 'Waktu', 'NISN', 'Nama', 'Kelas', 'Kolom', 'Data Lama', 'Data Baru', 'Oleh']]
  ;(log || []).forEach((l, i) => aoaLog.push([i + 1, waktu(l.created_at), l.nisn, l.nama, l.kelas, l.label, l.nilai_lama, l.nilai_baru, l.sumber === 'admin' ? 'Admin' : 'Murid']))
  XLSX.utils.book_append_sheet(wb, sheetDariAoa(aoaLog, [5, 20, 13, 30, 8, 16, 45, 45, 8]), 'Log Perbaikan')

  const tgl = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `Rekap_Konfirmasi_Data_Murid_SMPN2_Tulangan_${tgl}.xlsx`)
}

export function unduhTemplate() {
  const wb = XLSX.utils.book_new()
  const aoa = [['DATA PESERTA DIDIK - SMP NEGERI 2 TULANGAN'], ['Tahun Pelajaran 2026/2027'], [], HEADER,
    [1, 'Contoh Nama Murid', '0123456789', '17-08-2013', 'VII-A', 'Jl. Contoh, RT 1 / RW 2, Kel. Kepuh Kemiri, Kec. Tulangan', '081234567890', 'Nama Ayah', 'Karyawan Swasta', 'Nama Ibu', 'Tidak Bekerja']]
  const ws = sheetDariAoa(aoa, LEBAR)
  // NISN sebagai teks agar angka 0 di depan tidak hilang
  ws['C5'] = { t: 's', v: '0123456789' }
  XLSX.utils.book_append_sheet(wb, ws, 'Data Murid')
  XLSX.writeFile(wb, 'Template_Upload_Data_Murid.xlsx')
}
