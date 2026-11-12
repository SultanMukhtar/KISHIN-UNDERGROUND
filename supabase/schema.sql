-- =========================================================
-- UNDERGROUND - SCHEMA SUPABASE
-- Jalankan di Supabase > SQL Editor > New query > Run.
-- Aman di-Run ulang (data gak kehapus) kalau ada versi baru.
-- =========================================================

-- ---------- PENGATURAN (cuma 1 baris) ----------
create table if not exists settings (
  id int primary key default 1 check (id = 1),
  event_name text not null default 'UNDERGROUND',
  tagline text not null default 'Fight club rahasia Kishin High School. Tangan kosong, sampai KO. Jangan sampai guru tahu.',
  hero_url text,
  registration_fee int not null default 5000,
  default_house_cut numeric not null default 0.2 check (default_house_cut >= 0 and default_house_cut < 1),
  updated_at timestamptz not null default now()
);
insert into settings (id) values (1) on conflict (id) do nothing;

-- ---------- FIGHTER ----------
create table if not exists fighters (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  group_name text,
  paid boolean not null default false,
  fee int not null default 0 check (fee >= 0),
  photo_url text,
  notes text,
  created_at timestamptz not null default now()   -- tanggal daftar otomatis
);

-- ---------- MATCH / BRACKET ----------
create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'main' check (kind in ('main', 'third')),
  round int not null,          -- 1 = ronde pertama, makin besar makin dekat final
  slot int not null,           -- posisi match di dalam ronde (mulai 0)
  match_no int not null,
  fighter1_id uuid references fighters(id) on delete set null,
  fighter2_id uuid references fighters(id) on delete set null,
  winner_id uuid references fighters(id) on delete set null,
  featured boolean not null default false,   -- "Tampil Hari Ini"
  house_cut numeric not null default 0.2 check (house_cut >= 0 and house_cut < 1),
  created_at timestamptz not null default now(),
  unique (kind, round, slot)
);

-- ---------- TARUHAN ----------
create table if not exists bets (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  bettor_name text not null,
  fighter_id uuid not null references fighters(id) on delete cascade,
  bettor_account text,                       -- rekening / Yentag buat transfer payout
  amount int not null check (amount > 0),
  paid_out boolean not null default false,   -- sudah dibayar ke bettor yang menang?
  created_at timestamptz not null default now()
);
alter table bets add column if not exists bettor_account text;   -- buat database yang dibuat sebelum kolom ini ada
create index if not exists bets_match_idx on bets(match_id);

-- ---------- TOTAL POOL PER MATCH (aman buat publik, tanpa nama bettor) ----------
create or replace view match_pools as
select
  m.id as match_id,
  coalesce(sum(b.amount) filter (where b.fighter_id = m.fighter1_id), 0)::int as pool1,
  coalesce(sum(b.amount) filter (where b.fighter_id = m.fighter2_id), 0)::int as pool2,
  count(b.id)::int as bet_count
from matches m
left join bets b on b.match_id = m.id
group by m.id;

-- =========================================================
-- AKUN ADMIN
-- role 'superadmin' (cuma boleh 1): semua operasional + generate bracket + house cut + untung kas
--                                   + pengaturan + kelola akun admin
-- role 'admin'                     : pendaftaran, isi pemenang & "tampil hari ini", catat taruhan
-- Akun dibuat/dihapus lewat panel /admin (server), bukan dari SQL.
-- =========================================================
drop function if exists admin_login_email(text);
drop table if exists admin_emails;   -- sistem lama (login pakai email), diganti admin_accounts

create table if not exists admin_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  email text not null,            -- email internal Supabase Auth, gak pernah tampil di website
  role text not null default 'admin' check (role in ('admin', 'superadmin')),
  created_at timestamptz not null default now()
);
create unique index if not exists admin_accounts_username_key on admin_accounts (lower(username));
create unique index if not exists admin_accounts_one_superadmin on admin_accounts (role) where role = 'superadmin';
alter table admin_accounts enable row level security;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admin_accounts where user_id = auth.uid());
$$;
create or replace function is_superadmin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admin_accounts where user_id = auth.uid() and role = 'superadmin');
$$;
grant execute on function is_admin() to anon, authenticated;
grant execute on function is_superadmin() to anon, authenticated;

drop policy if exists "read own or superadmin" on admin_accounts;
create policy "read own or superadmin" on admin_accounts for select to authenticated
  using (user_id = auth.uid() or is_superadmin());
revoke insert, update, delete on admin_accounts from anon, authenticated;

-- =========================================================
-- KEAMANAN (Row Level Security)
-- Penonton (anon) cuma bisa BACA. Admin ngelola operasional, pengaturan cuma superadmin.
-- =========================================================
alter table settings enable row level security;
alter table fighters enable row level security;
alter table matches  enable row level security;
alter table bets     enable row level security;

drop policy if exists "public read settings"     on settings;
drop policy if exists "admin all settings"       on settings;
drop policy if exists "superadmin edit settings" on settings;
drop policy if exists "public read fighters"     on fighters;
drop policy if exists "admin all fighters"       on fighters;
drop policy if exists "public read matches"      on matches;
drop policy if exists "admin all matches"        on matches;
drop policy if exists "admin update matches"     on matches;
drop policy if exists "superadmin insert matches" on matches;
drop policy if exists "superadmin delete matches" on matches;
drop policy if exists "admin all bets"           on bets;

create policy "public read settings"     on settings for select to anon, authenticated using (true);
create policy "superadmin edit settings" on settings for update to authenticated using (is_superadmin()) with check (is_superadmin());
create policy "public read fighters"     on fighters for select to anon, authenticated using (true);
create policy "admin all fighters"       on fighters for all to authenticated using (is_admin()) with check (is_admin());
create policy "public read matches"      on matches  for select to anon, authenticated using (true);
-- Admin cuma boleh UPDATE match (isi pemenang, "tampil hari ini").
-- Generate / buat ulang bracket (insert + delete) cuma superadmin.
create policy "admin update matches"      on matches for update to authenticated using (is_admin()) with check (is_admin());
create policy "superadmin insert matches" on matches for insert to authenticated with check (is_superadmin());
create policy "superadmin delete matches" on matches for delete to authenticated using (is_superadmin());

-- House cut per match cuma boleh diubah superadmin.
-- (auth.uid() kosong = SQL Editor / server, tetap boleh.)
create or replace function guard_house_cut() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.house_cut is distinct from old.house_cut and auth.uid() is not null and not is_superadmin() then
    raise exception 'Cuma superadmin yang boleh ubah house cut.';
  end if;
  return new;
end $$;
drop trigger if exists matches_guard_house_cut on matches;
create trigger matches_guard_house_cut before update on matches
  for each row execute function guard_house_cut();
-- bets TIDAK bisa dibaca publik (nama bettor & nominal per orang tetap rahasia)
create policy "admin all bets"           on bets     for all to authenticated using (is_admin()) with check (is_admin());

-- Penonton cuma boleh lihat kolom fighter yang aman (status bayar, fee, catatan disembunyikan)
revoke select on fighters from anon;
grant select (id, name, group_name, photo_url) on fighters to anon;

grant select on match_pools to anon, authenticated;

-- =========================================================
-- REALTIME (website penonton update otomatis tanpa refresh)
-- =========================================================
do $$
begin
  begin alter publication supabase_realtime add table matches;  exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table settings; exception when duplicate_object then null; end;
  -- bets: cuma admin yang nerima (RLS), panel admin lain langsung update.
  -- fighters sengaja TIDAK dimasukkan (kolom bayar/fee/catatan rahasia); panel admin polling tiap 10 detik.
  begin alter publication supabase_realtime add table bets;     exception when duplicate_object then null; end;
end $$;

-- =========================================================
-- STORAGE FOTO, maks 5 MB per file
-- fighters/ → semua admin, hero/ → cuma superadmin
-- =========================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

drop policy if exists "public read photos"   on storage.objects;
drop policy if exists "admin upload photos"  on storage.objects;
drop policy if exists "admin update photos"  on storage.objects;
drop policy if exists "admin delete photos"  on storage.objects;

create policy "public read photos"  on storage.objects for select to anon, authenticated using (bucket_id = 'photos');
create policy "admin upload photos" on storage.objects for insert to authenticated with check (
  bucket_id = 'photos' and (is_superadmin() or (is_admin() and (storage.foldername(name))[1] = 'fighters')));
create policy "admin update photos" on storage.objects for update to authenticated using (
  bucket_id = 'photos' and (is_superadmin() or (is_admin() and (storage.foldername(name))[1] = 'fighters')));
create policy "admin delete photos" on storage.objects for delete to authenticated using (
  bucket_id = 'photos' and (is_superadmin() or (is_admin() and (storage.foldername(name))[1] = 'fighters')));

-- =========================================================
-- AKUN SUPERADMIN: buka /admin setelah ini → isi form "Bikin akun superadmin".
-- =========================================================
