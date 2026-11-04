// Definisi kolom data murid yang ditampilkan & bisa diperbaiki
export const KOLOM_EDIT = [
  { key: 'nama', label: 'Nama Lengkap', icon: 'bi-person', grup: 'murid', placeholder: 'Sesuai akta kelahiran', wajib: true },
  { key: 'tgl_lahir', label: 'Tanggal Lahir', icon: 'bi-calendar-event', grup: 'murid', tipe: 'tanggal', wajib: true },
  { key: 'alamat', label: 'Alamat Lengkap', icon: 'bi-geo-alt', grup: 'kontak', tipe: 'textarea', placeholder: 'Jalan/Dusun, RT / RW, Kel./Desa, Kec.', wajib: true },
  { key: 'no_hp', label: 'No. HP / WhatsApp', icon: 'bi-telephone', grup: 'kontak', tipe: 'tel', placeholder: 'Contoh: 081234567890', wajib: true },
  { key: 'nama_ayah', label: 'Nama Ayah', icon: 'bi-person-badge', grup: 'ortu', wajib: true },
  { key: 'pekerjaan_ayah', label: 'Pekerjaan Ayah', icon: 'bi-briefcase', grup: 'ortu', tipe: 'pekerjaan', wajib: true },
  { key: 'nama_ibu', label: 'Nama Ibu', icon: 'bi-person-heart', grup: 'ortu', wajib: true },
  { key: 'pekerjaan_ibu', label: 'Pekerjaan Ibu', icon: 'bi-briefcase', grup: 'ortu', tipe: 'pekerjaan', wajib: true }
]

export const GRUP = {
  murid: { judul: 'Identitas Murid', icon: 'bi-person-vcard' },
  kontak: { judul: 'Alamat & Kontak', icon: 'bi-house-door' },
  ortu: { judul: 'Data Orang Tua', icon: 'bi-people' }
}

export const PEKERJAAN = [
  'Tidak Bekerja', 'Pns/Tni/Polri', 'Aparatur Sipil Negara', 'Karyawan Swasta', 'Karyawan Bumn',
  'Wiraswasta', 'Wirausaha', 'Pedagang Kecil', 'Pedagang Besar', 'Petani', 'Peternak', 'Nelayan',
  'Buruh', 'Pensiunan', 'Sudah Meninggal', 'Lainnya'
]

export const STATUS = {
  belum: { label: 'Belum Konfirmasi', kelas: 'text-bg-secondary', icon: 'bi-hourglass-split' },
  benar: { label: 'Data Benar', kelas: 'text-bg-success', icon: 'bi-check-circle' },
  diperbaiki: { label: 'Diperbaiki', kelas: 'text-bg-warning', icon: 'bi-pencil-square' }
}

// "dd-mm-yyyy" <-> "yyyy-mm-dd" (input type=date)
export function keIso(dmy) {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec((dmy || '').trim())
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}
export function keDmy(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso || '').trim())
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
export function tglPanjang(dmy) {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(dmy || '')
  return m ? `${+m[1]} ${BULAN[+m[2] - 1]} ${m[3]}` : dmy || '-'
}

export function waktu(ts) {
  if (!ts) return '-'
  return new Date(ts).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Cek kelengkapan / kewajaran isian, dipakai untuk menandai kolom yang perlu dicek
export function cekKolom(key, nilai) {
  const v = (nilai || '').trim()
  if (!v) return 'Masih kosong'
  if (key === 'no_hp') {
    const d = v.replace(/[^0-9]/g, '')
    if (!/^(08|628)/.test(d) || d.length < 10 || d.length > 14) return 'Format nomor HP tampak tidak wajar'
  }
  if (key === 'alamat' && !/RT/i.test(v)) return 'RT/RW belum tercantum'
  if (key === 'tgl_lahir' && !/^\d{2}-\d{2}-\d{4}$/.test(v)) return 'Format tanggal tidak valid'
  return ''
}
