-- =========================================================
-- 1C UNDERGROUND FIGHT - SCHEMA SUPABASE
-- Jalankan SEKALI di Supabase > SQL Editor > New query > Run
-- =========================================================

-- ---------- PENGATURAN (cuma 1 baris) ----------
create table if not exists settings (
  id int primary key default 1 check (id = 1),
  event_name text not null default '1C UNDERGROUND FIGHT',
  tagline text not null default 'Fight club rahasia Class 1-C, Kishin High School. Fist only, sampai KO. Jangan sampai guru tahu.',
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
  amount int not null check (amount > 0),
  paid_out boolean not null default false,   -- sudah dibayar ke bettor yang menang?
  created_at timestamptz not null default now()
);
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
-- KEAMANAN (Row Level Security)
-- Penonton (anon) cuma bisa BACA. Cuma email yang ada di admin_emails yang bisa ngedit.
-- =========================================================
create table if not exists admin_emails (email text primary key);
alter table admin_emails enable row level security;  -- tanpa policy = gak bisa dibaca/diubah dari website
revoke all on admin_emails from anon, authenticated;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admin_emails where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
grant execute on function is_admin() to anon, authenticated;
alter table settings enable row level security;
alter table fighters enable row level security;
alter table matches  enable row level security;
alter table bets     enable row level security;

drop policy if exists "public read settings" on settings;
drop policy if exists "admin all settings"   on settings;
drop policy if exists "public read fighters" on fighters;
drop policy if exists "admin all fighters"   on fighters;
drop policy if exists "public read matches"  on matches;
drop policy if exists "admin all matches"    on matches;
drop policy if exists "admin all bets"       on bets;

create policy "public read settings" on settings for select to anon, authenticated using (true);
create policy "admin all settings"   on settings for all to authenticated using (is_admin()) with check (is_admin());
create policy "public read fighters" on fighters for select to anon, authenticated using (true);
create policy "admin all fighters"   on fighters for all to authenticated using (is_admin()) with check (is_admin());
create policy "public read matches"  on matches  for select to anon, authenticated using (true);
create policy "admin all matches"    on matches  for all to authenticated using (is_admin()) with check (is_admin());
-- bets TIDAK bisa dibaca publik (nama bettor & nominal per orang tetap rahasia)
create policy "admin all bets"       on bets     for all to authenticated using (is_admin()) with check (is_admin());

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
end $$;

-- =========================================================
-- STORAGE FOTO (fighter + hero), maks 5 MB per file
-- =========================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

drop policy if exists "public read photos"   on storage.objects;
drop policy if exists "admin upload photos"  on storage.objects;
drop policy if exists "admin update photos"  on storage.objects;
drop policy if exists "admin delete photos"  on storage.objects;

create policy "public read photos"  on storage.objects for select to anon, authenticated using (bucket_id = 'photos');
create policy "admin upload photos" on storage.objects for insert to authenticated with check (bucket_id = 'photos' and is_admin());
create policy "admin update photos" on storage.objects for update to authenticated using (bucket_id = 'photos' and is_admin());
create policy "admin delete photos" on storage.objects for delete to authenticated using (bucket_id = 'photos' and is_admin());

-- =========================================================
-- DAFTARKAN EMAIL ADMIN (ganti dengan email akun panitia yang kamu buat
-- di Authentication > Users). Boleh lebih dari satu baris.
-- =========================================================
-- insert into admin_emails (email) values ('panitia1c@contoh.com');
