// Edge Function: dokumen-murid
// Menjadi "penjaga" bucket privat `dokumen-murid`:
//   siapkan -> murid (NISN + tgl lahir) meminta signed upload URL (JPG/JPEG/PDF, maks 1 MB)
//   selesai -> mendaftarkan file yang sudah terunggah
//   lihat   -> signed URL 5 menit (murid pemilik / admin)
//   hapus   -> hapus file (murid pemilik saat portal dibuka / admin)
import { createClient } from 'npm:@supabase/supabase-js@2'

const BUCKET = 'dokumen-murid'
const MAKS = 1024 * 1024
const MAKS_PER_MURID = 10
const MIME: Record<string, string> = { 'image/jpeg': 'jpg', 'application/pdf': 'pdf' }
const JENIS = ['Kartu Keluarga', 'Akta Kelahiran', 'KTP Ayah', 'KTP Ibu', 'KTP Wali', 'Ijazah / SKL', 'KIP / PIP / PKH', 'Foto Murid', 'Lainnya']

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
class Galat extends Error { constructor(public kode: string, public status = 400) { super(kode) } }

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false }
})

async function rpc(nama: string, args: Record<string, unknown>) {
  const { data, error } = await sb.rpc(nama, args)
  if (error) {
    const kode = (error.message.match(/[A-Z_]{6,}/) || ['GAGAL'])[0]
    throw new Galat(kode, kode === 'GAGAL' ? 500 : 400)
  }
  return data
}

// Identitas pemanggil: admin (token) atau murid (nisn + tgl_lahir)
async function siapa(b: Record<string, string>): Promise<{ admin: boolean; nisn?: string }> {
  if (b.token) { await rpc('admin_cek', { p_token: b.token }); return { admin: true } }
  const nisn = String(b.nisn || '').trim()
  await rpc('murid_masuk', { p_nisn: nisn, p_tgl_lahir: String(b.tgl || '').trim() })
  return { admin: false, nisn }
}
async function portalDibuka() { return (await rpc('info_portal', {}))?.portal_dibuka !== false }

async function ambilDokumen(id: string) {
  const { data, error } = await sb.from('dokumen_murid').select('*').eq('id', id).maybeSingle()
  if (error) throw new Galat('GAGAL', 500)
  if (!data) throw new Galat('DOKUMEN_TIDAK_ADA', 404)
  return data
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'METODE_TIDAK_DIDUKUNG' }, 405)
  try {
    const b = await req.json()
    const pemanggil = await siapa(b)

    switch (b.aksi) {
      case 'siapkan': {
        if (pemanggil.admin) throw new Galat('KHUSUS_MURID', 403)
        if (!(await portalDibuka())) throw new Galat('PORTAL_DITUTUP', 403)
        const ext = MIME[b.mime]
        if (!ext) throw new Galat('TIPE_TIDAK_DIDUKUNG')
        if (!(Number(b.ukuran) > 0 && Number(b.ukuran) <= MAKS)) throw new Galat('UKURAN_TERLALU_BESAR')
        if (!JENIS.includes(b.jenis)) throw new Galat('JENIS_TIDAK_VALID')
        const { count } = await sb.from('dokumen_murid').select('id', { count: 'exact', head: true }).eq('nisn', pemanggil.nisn)
        if ((count ?? 0) >= MAKS_PER_MURID) throw new Galat('BATAS_DOKUMEN')
        const path = `${pemanggil.nisn}/${crypto.randomUUID()}.${ext}`
        const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path)
        if (error) throw new Galat('GAGAL', 500)
        return json({ path: data.path, token: data.token })
      }
      case 'selesai': {
        if (pemanggil.admin) throw new Galat('KHUSUS_MURID', 403)
        if (!JENIS.includes(b.jenis)) throw new Galat('JENIS_TIDAK_VALID')
        const dok = await rpc('_daftarkan_dokumen', { p_nisn: pemanggil.nisn, p_path: String(b.path || ''), p_jenis: b.jenis, p_nama_asli: String(b.nama || 'dokumen') })
        return json(dok)
      }
      case 'lihat': {
        const d = await ambilDokumen(b.id)
        if (!pemanggil.admin && d.nisn !== pemanggil.nisn) throw new Galat('AKSES_DITOLAK', 403)
        const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(d.path, 300, b.unduh ? { download: d.nama_asli } : undefined)
        if (error) throw new Galat('GAGAL', 500)
        return json({ url: data.signedUrl })
      }
      case 'hapus': {
        const d = await ambilDokumen(b.id)
        if (!pemanggil.admin) {
          if (d.nisn !== pemanggil.nisn) throw new Galat('AKSES_DITOLAK', 403)
          if (!(await portalDibuka())) throw new Galat('PORTAL_DITUTUP', 403)
        }
        await sb.storage.from(BUCKET).remove([d.path])
        await sb.from('dokumen_murid').delete().eq('id', d.id)
        return json({ ok: true })
      }
      default:
        throw new Galat('AKSI_TIDAK_DIKENAL')
    }
  } catch (e) {
    if (e instanceof Galat) return json({ error: e.kode }, e.status)
    console.error(e)
    return json({ error: 'GAGAL' }, 500)
  }
})
