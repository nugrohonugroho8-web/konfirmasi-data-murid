import { createClient } from '@supabase/supabase-js'

// Kunci "publishable/anon" memang aman berada di sisi browser:
// semua tabel dikunci RLS dan hanya bisa diakses lewat fungsi RPC yang memeriksa
// NISN + tanggal lahir (murid) atau token sesi admin.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://efdqgjgkcuvpqsulqyhg.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_FGH9Su8BcvS2yqWRkVWxLg_T-h7e2Mh'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
})
