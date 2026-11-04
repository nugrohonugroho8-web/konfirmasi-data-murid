-- =====================================================================
-- Konfirmasi Data Murid Tahun Pelajaran 2026/2027 — SMP Negeri 2 Tulangan
-- Skema database Supabase (PostgreSQL)
--
-- Prinsip keamanan:
--   * Semua tabel memakai RLS TANPA policy → tidak bisa dibaca/ditulis
--     langsung lewat Data API oleh publik (anon).
--   * Akses hanya lewat fungsi RPC "SECURITY DEFINER":
--       - Murid  : wajib NISN + tanggal lahir yang cocok, hanya melihat datanya sendiri.
--       - Admin  : wajib token sesi hasil login (username + password ber-hash bcrypt).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- TABEL
-- ---------------------------------------------------------------------
create table if not exists public.murid (
  id               bigserial primary key,
  nisn             text not null unique,
  nama             text not null,
  tgl_lahir        text not null default '',          -- format DD-MM-YYYY
  kelas            text not null default '',
  alamat           text not null default '',
  no_hp            text not null default '',
  nama_ayah        text not null default '',
  pekerjaan_ayah   text not null default '',
  nama_ibu         text not null default '',
  pekerjaan_ibu    text not null default '',
  status           text not null default 'belum' check (status in ('belum','benar','diperbaiki')),
  catatan          text not null default '',
  jumlah_perbaikan int  not null default 0,
  data_asli        jsonb,                              -- salinan data saat diunggah
  dikonfirmasi_at  timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists murid_kelas_idx on public.murid (kelas);

create table if not exists public.log_perbaikan (
  id          bigserial primary key,
  nisn        text not null,
  nama        text not null default '',
  kelas       text not null default '',
  kolom       text not null,
  label       text not null,
  nilai_lama  text,
  nilai_baru  text,
  sumber      text not null default 'murid',          -- murid | admin
  created_at  timestamptz not null default now()
);
create index if not exists log_perbaikan_created_idx on public.log_perbaikan (created_at desc);

create table if not exists public.admin_akun (
  username      text primary key,
  password_hash text not null,
  updated_at    timestamptz not null default now()
);

create table if not exists public.admin_sesi (
  token      uuid primary key default gen_random_uuid(),
  username   text not null references public.admin_akun(username) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '12 hours'
);

create table if not exists public.pengaturan (
  id             int primary key default 1 check (id = 1),
  portal_dibuka  boolean not null default true,
  tahun_pelajaran text not null default '2026/2027',
  pengumuman     text not null default '',
  updated_at     timestamptz not null default now()
);
insert into public.pengaturan (id) values (1) on conflict do nothing;

-- Akun admin awal: administrator / esdeweni (disimpan sebagai hash bcrypt)
insert into public.admin_akun (username, password_hash)
values ('administrator', extensions.crypt('esdeweni', extensions.gen_salt('bf', 10)))
on conflict (username) do nothing;

-- RLS aktif, tanpa policy → tertutup untuk akses langsung
alter table public.murid          enable row level security;
alter table public.log_perbaikan  enable row level security;
alter table public.admin_akun     enable row level security;
alter table public.admin_sesi     enable row level security;
alter table public.pengaturan     enable row level security;
revoke all on public.murid, public.log_perbaikan, public.admin_akun, public.admin_sesi, public.pengaturan from anon, authenticated;

-- ---------------------------------------------------------------------
-- FUNGSI BANTU (internal, tidak diekspos)
-- ---------------------------------------------------------------------
create or replace function public._kolom_murid()
returns table (kolom text, label text)
language sql immutable set search_path = public as $$
  values ('nama','Nama Lengkap'), ('tgl_lahir','Tanggal Lahir'), ('alamat','Alamat Lengkap'),
         ('no_hp','No. HP'), ('nama_ayah','Nama Ayah'), ('pekerjaan_ayah','Pekerjaan Ayah'),
         ('nama_ibu','Nama Ibu'), ('pekerjaan_ibu','Pekerjaan Ibu');
$$;

create or replace function public._murid_json(m public.murid)
returns jsonb language sql stable set search_path = public as $$
  select to_jsonb(m) - 'id' - 'created_at';
$$;

create or replace function public._cek_admin(p_token uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_user text;
begin
  select username into v_user from admin_sesi where token = p_token and expires_at > now();
  if v_user is null then
    raise exception 'SESI_TIDAK_VALID' using hint = 'Silakan login ulang sebagai admin.';
  end if;
  return v_user;
end $$;

-- Terapkan perubahan + catat log per kolom yang berubah
create or replace function public._terapkan_perubahan(p_nisn text, p_data jsonb, p_sumber text)
returns int language plpgsql security definer set search_path = public as $$
declare
  m public.murid; k record; v_lama text; v_baru text; v_jml int := 0;
begin
  select * into m from murid where nisn = p_nisn for update;
  for k in select * from _kolom_murid() loop
    if p_data ? k.kolom then
      v_lama := coalesce(to_jsonb(m) ->> k.kolom, '');
      v_baru := btrim(coalesce(p_data ->> k.kolom, ''));
      if v_baru is distinct from v_lama then
        insert into log_perbaikan (nisn, nama, kelas, kolom, label, nilai_lama, nilai_baru, sumber)
        values (m.nisn, m.nama, m.kelas, k.kolom, k.label, v_lama, v_baru, p_sumber);
        execute format('update murid set %I = $1 where nisn = $2', k.kolom) using v_baru, p_nisn;
        v_jml := v_jml + 1;
      end if;
    end if;
  end loop;
  return v_jml;
end $$;

-- ---------------------------------------------------------------------
-- FUNGSI PUBLIK (murid)
-- ---------------------------------------------------------------------
create or replace function public.info_portal()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('portal_dibuka', portal_dibuka, 'tahun_pelajaran', tahun_pelajaran, 'pengumuman', pengumuman)
  from pengaturan where id = 1;
$$;

create or replace function public.murid_masuk(p_nisn text, p_tgl_lahir text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare m public.murid; v_ada boolean;
begin
  select * into m from murid where nisn = btrim(p_nisn) and tgl_lahir = btrim(p_tgl_lahir);
  if m.id is null then
    select exists(select 1 from murid where nisn = btrim(p_nisn)) into v_ada;
    if v_ada then raise exception 'TGL_TIDAK_COCOK'; end if;
    raise exception 'NISN_TIDAK_DITEMUKAN';
  end if;
  return _murid_json(m);
end $$;

create or replace function public.murid_simpan(p_nisn text, p_tgl_lahir text, p_data jsonb, p_catatan text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare m public.murid; v_jml int;
begin
  if not (select portal_dibuka from pengaturan where id = 1) then
    raise exception 'PORTAL_DITUTUP';
  end if;
  select * into m from murid where nisn = btrim(p_nisn) and tgl_lahir = btrim(p_tgl_lahir);
  if m.id is null then raise exception 'AKSES_DITOLAK'; end if;

  v_jml := _terapkan_perubahan(m.nisn, coalesce(p_data, '{}'::jsonb), 'murid');

  update murid set
    status = case when v_jml > 0 or status = 'diperbaiki' then 'diperbaiki' else 'benar' end,
    jumlah_perbaikan = jumlah_perbaikan + v_jml,
    catatan = left(btrim(coalesce(p_catatan, '')), 1000),
    dikonfirmasi_at = now(),
    updated_at = now()
  where nisn = m.nisn
  returning * into m;

  return _murid_json(m) || jsonb_build_object('perubahan', v_jml);
end $$;

-- ---------------------------------------------------------------------
-- FUNGSI ADMIN
-- ---------------------------------------------------------------------
create or replace function public.admin_masuk(p_username text, p_password text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare a public.admin_akun; s public.admin_sesi;
begin
  delete from admin_sesi where expires_at < now();
  select * into a from admin_akun where username = lower(btrim(p_username));
  if a.username is null or a.password_hash <> extensions.crypt(p_password, a.password_hash) then
    perform pg_sleep(0.8); -- perlambat tebakan password
    raise exception 'LOGIN_GAGAL';
  end if;
  insert into admin_sesi (username) values (a.username) returning * into s;
  return jsonb_build_object('token', s.token, 'username', s.username, 'expires_at', s.expires_at);
end $$;

create or replace function public.admin_keluar(p_token uuid)
returns void language sql security definer set search_path = public as $$
  delete from admin_sesi where token = p_token;
$$;

create or replace function public.admin_cek(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  return jsonb_build_object('username', _cek_admin(p_token));
end $$;

create or replace function public.admin_data_murid(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform _cek_admin(p_token);
  return coalesce((select jsonb_agg(_murid_json(m) order by m.kelas, m.nama) from murid m), '[]'::jsonb);
end $$;

create or replace function public.admin_log(p_token uuid, p_batas int default 500)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform _cek_admin(p_token);
  return coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at desc)
                   from (select * from log_perbaikan order by created_at desc limit greatest(p_batas,1)) l), '[]'::jsonb);
end $$;

create or replace function public.admin_bersihkan_log(p_token uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v int;
begin
  perform _cek_admin(p_token);
  delete from log_perbaikan where true;
  get diagnostics v = row_count;
  return v;
end $$;

create or replace function public.admin_simpan_murid(p_token uuid, p_nisn text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare m public.murid; v_jml int;
begin
  perform _cek_admin(p_token);
  if not exists(select 1 from murid where nisn = p_nisn) then raise exception 'NISN_TIDAK_DITEMUKAN'; end if;
  v_jml := _terapkan_perubahan(p_nisn, coalesce(p_data, '{}'::jsonb), 'admin');
  update murid set
    kelas = coalesce(nullif(btrim(p_data->>'kelas'), ''), kelas),
    status = coalesce(nullif(p_data->>'status', ''), status),
    jumlah_perbaikan = jumlah_perbaikan + v_jml,
    updated_at = now()
  where nisn = p_nisn returning * into m;
  return _murid_json(m);
end $$;

create or replace function public.admin_hapus_murid(p_token uuid, p_nisn text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform _cek_admin(p_token);
  delete from murid where nisn = p_nisn;
end $$;

-- p_mode: 'gabung' = tambah baru & perbarui yang NISN-nya sama (status konfirmasi dipertahankan)
--         'ganti'  = hapus semua murid & log, lalu isi dengan data baru
create or replace function public.admin_unggah_data(p_token uuid, p_rows jsonb, p_mode text default 'gabung')
returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb; v_baru int := 0; v_ubah int := 0; v_lewat int := 0; v_nisn text; v_ada boolean;
begin
  perform _cek_admin(p_token);
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'FORMAT_DATA_SALAH'; end if;
  if p_mode = 'ganti' then
    delete from log_perbaikan where true;
    delete from murid where true;
  end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    v_nisn := btrim(coalesce(r->>'nisn', ''));
    if v_nisn = '' or btrim(coalesce(r->>'nama','')) = '' then v_lewat := v_lewat + 1; continue; end if;
    select exists(select 1 from murid where nisn = v_nisn) into v_ada;
    insert into murid (nisn, nama, tgl_lahir, kelas, alamat, no_hp, nama_ayah, pekerjaan_ayah, nama_ibu, pekerjaan_ibu, data_asli)
    values (v_nisn, btrim(r->>'nama'), btrim(coalesce(r->>'tgl_lahir','')), btrim(coalesce(r->>'kelas','')),
            btrim(coalesce(r->>'alamat','')), btrim(coalesce(r->>'no_hp','')), btrim(coalesce(r->>'nama_ayah','')),
            btrim(coalesce(r->>'pekerjaan_ayah','')), btrim(coalesce(r->>'nama_ibu','')), btrim(coalesce(r->>'pekerjaan_ibu','')), r)
    on conflict (nisn) do update set
      nama = excluded.nama, tgl_lahir = excluded.tgl_lahir, kelas = excluded.kelas, alamat = excluded.alamat,
      no_hp = excluded.no_hp, nama_ayah = excluded.nama_ayah, pekerjaan_ayah = excluded.pekerjaan_ayah,
      nama_ibu = excluded.nama_ibu, pekerjaan_ibu = excluded.pekerjaan_ibu, data_asli = excluded.data_asli,
      updated_at = now();
    if v_ada then v_ubah := v_ubah + 1; else v_baru := v_baru + 1; end if;
  end loop;
  return jsonb_build_object('baru', v_baru, 'diperbarui', v_ubah, 'dilewati', v_lewat,
                            'total', (select count(*) from murid));
end $$;

create or replace function public.admin_reset_status(p_token uuid, p_nisn text default null)
returns int language plpgsql security definer set search_path = public as $$
declare v int;
begin
  perform _cek_admin(p_token);
  update murid set status = 'belum', catatan = '', dikonfirmasi_at = null, jumlah_perbaikan = 0, updated_at = now()
  where p_nisn is null or nisn = p_nisn;
  get diagnostics v = row_count;
  return v;
end $$;

create or replace function public.admin_simpan_pengaturan(p_token uuid, p_portal_dibuka boolean, p_pengumuman text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform _cek_admin(p_token);
  update pengaturan set portal_dibuka = p_portal_dibuka, pengumuman = left(coalesce(p_pengumuman,''), 500), updated_at = now()
  where id = 1;
  return info_portal();
end $$;

create or replace function public.admin_ganti_password(p_token uuid, p_lama text, p_baru text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare v_user text; a public.admin_akun;
begin
  v_user := _cek_admin(p_token);
  select * into a from admin_akun where username = v_user;
  if a.password_hash <> extensions.crypt(p_lama, a.password_hash) then raise exception 'PASSWORD_LAMA_SALAH'; end if;
  if length(coalesce(p_baru,'')) < 6 then raise exception 'PASSWORD_TERLALU_PENDEK'; end if;
  update admin_akun set password_hash = extensions.crypt(p_baru, extensions.gen_salt('bf', 10)), updated_at = now()
  where username = v_user;
  delete from admin_sesi where username = v_user and token <> p_token;
end $$;

-- ---------------------------------------------------------------------
-- REALTIME: setiap ada log baru / log dibersihkan, kirim sinyal broadcast
-- (tanpa data pribadi) ke kanal publik "log-perbaikan". Panel admin
-- mendengarkan sinyal ini lalu memuat ulang data lewat RPC ber-token.
-- ---------------------------------------------------------------------
create or replace function public._sinyal_log()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    perform realtime.send(jsonb_build_object('op', tg_op), 'berubah', 'log-perbaikan', false);
  exception when others then null; -- jangan gagalkan transaksi bila realtime tidak tersedia
  end;
  return null;
end $$;

drop trigger if exists trg_sinyal_log on public.log_perbaikan;
create trigger trg_sinyal_log after insert or delete on public.log_perbaikan
for each statement execute function public._sinyal_log();

drop trigger if exists trg_sinyal_murid on public.murid;
create trigger trg_sinyal_murid after insert or update or delete on public.murid
for each statement execute function public._sinyal_log();

-- ---------------------------------------------------------------------
-- HAK AKSES FUNGSI
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.info_portal(),
  public.murid_masuk(text, text),
  public.murid_simpan(text, text, jsonb, text),
  public.admin_masuk(text, text),
  public.admin_keluar(uuid),
  public.admin_cek(uuid),
  public.admin_data_murid(uuid),
  public.admin_log(uuid, int),
  public.admin_bersihkan_log(uuid),
  public.admin_simpan_murid(uuid, text, jsonb),
  public.admin_hapus_murid(uuid, text),
  public.admin_unggah_data(uuid, jsonb, text),
  public.admin_reset_status(uuid, text),
  public.admin_simpan_pengaturan(uuid, boolean, text),
  public.admin_ganti_password(uuid, text, text)
to anon, authenticated;
