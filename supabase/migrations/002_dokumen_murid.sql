-- =====================================================================
-- Unggah dokumen pendukung murid (JPG/JPEG/PDF, maks. 1 MB)
-- Disimpan di Supabase Storage bucket PRIVAT "dokumen-murid".
-- Upload & akses file dilakukan lewat Edge Function "dokumen-murid"
-- (signed URL berumur pendek), sehingga publik tidak bisa menjelajah bucket.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dokumen-murid', 'dokumen-murid', false, 1048576, array['image/jpeg', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 1048576,
  allowed_mime_types = array['image/jpeg', 'application/pdf'];

create table if not exists public.dokumen_murid (
  id          uuid primary key default gen_random_uuid(),
  nisn        text not null references public.murid(nisn) on delete cascade on update cascade,
  jenis       text not null,
  nama_asli   text not null,
  path        text not null unique,
  mime        text not null,
  ukuran      int  not null check (ukuran > 0 and ukuran <= 1048576),
  created_at  timestamptz not null default now()
);
create index if not exists dokumen_murid_nisn_idx on public.dokumen_murid (nisn);
alter table public.dokumen_murid enable row level security;
revoke all on public.dokumen_murid from anon, authenticated;

-- Hanya dokumen yang file-nya benar-benar sudah ada di Storage yang ditampilkan
create or replace function public.murid_dokumen(p_nisn text, p_tgl_lahir text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from murid where nisn = btrim(p_nisn) and tgl_lahir = btrim(p_tgl_lahir)) then
    raise exception 'AKSES_DITOLAK';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', d.id, 'jenis', d.jenis, 'nama_asli', d.nama_asli, 'mime', d.mime,
                                        'ukuran', d.ukuran, 'created_at', d.created_at) order by d.created_at desc)
    from dokumen_murid d
    where d.nisn = btrim(p_nisn)
      and exists (select 1 from storage.objects o where o.bucket_id = 'dokumen-murid' and o.name = d.path)
  ), '[]'::jsonb);
end $$;

create or replace function public.admin_dokumen(p_token uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform _cek_admin(p_token);
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', d.id, 'nisn', d.nisn, 'nama', m.nama, 'kelas', m.kelas, 'jenis', d.jenis,
                                        'nama_asli', d.nama_asli, 'mime', d.mime, 'ukuran', d.ukuran, 'created_at', d.created_at)
                     order by d.created_at desc)
    from dokumen_murid d join murid m on m.nisn = d.nisn
    where exists (select 1 from storage.objects o where o.bucket_id = 'dokumen-murid' and o.name = d.path)
  ), '[]'::jsonb);
end $$;

-- Dipanggil Edge Function (service_role) SETELAH file selesai diunggah:
-- memverifikasi objek benar-benar ada, lalu mencatat ukuran & tipe aslinya.
create or replace function public._daftarkan_dokumen(p_nisn text, p_path text, p_jenis text, p_nama_asli text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o record; d public.dokumen_murid;
begin
  if p_path not like p_nisn || '/%' then raise exception 'PATH_TIDAK_VALID'; end if;
  select (metadata->>'size')::int as ukuran, metadata->>'mimetype' as mime into o
  from storage.objects where bucket_id = 'dokumen-murid' and name = p_path;
  if o.ukuran is null then raise exception 'FILE_BELUM_ADA'; end if;
  insert into dokumen_murid (nisn, jenis, nama_asli, path, mime, ukuran)
  values (p_nisn, left(p_jenis, 60), left(p_nama_asli, 200), p_path, coalesce(o.mime, ''), o.ukuran)
  on conflict (path) do update set jenis = excluded.jenis
  returning * into d;
  return to_jsonb(d) - 'path';
end $$;
revoke execute on function public._daftarkan_dokumen(text, text, text, text) from public, anon, authenticated;
grant execute on function public._daftarkan_dokumen(text, text, text, text) to service_role;
grant select, insert, update, delete on public.dokumen_murid to service_role;

-- sinyal realtime untuk panel admin
drop trigger if exists trg_sinyal_dokumen on public.dokumen_murid;
create trigger trg_sinyal_dokumen after insert or delete on public.dokumen_murid
for each statement execute function public._sinyal_log();

revoke execute on function public.murid_dokumen(text, text), public.admin_dokumen(uuid) from public;
grant execute on function public.murid_dokumen(text, text), public.admin_dokumen(uuid) to anon, authenticated;

-- Edge Function memakai service_role untuk memanggil fungsi RPC
grant execute on all functions in schema public to service_role;
