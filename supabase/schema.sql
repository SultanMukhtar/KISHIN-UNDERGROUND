-- =========================================================
-- UNDERGROUND - SCHEMA SUPABASE
-- Jalankan di Supabase > SQL Editor > New query > Run.
-- Aman di-Run ulang (data gak kehapus) kalau ada versi baru.
--
-- Isi:
--   settings        pengaturan event (1 baris) + turnamen yang lagi jalan
--   fighters        fighter + gaya bertarung + status
--   tournaments     turnamen (yang jalan + arsip) dan podiumnya
--   matches         bracket & laga tambahan: status, hasil
--   fight_history   catatan resmi tiap fight yang selesai (diisi otomatis)
--   bets            taruhan mata uang RP (virtual), cuma panitia
--   bet_log         riwayat semua transaksi taruhan (diisi otomatis)
--   sponsors        sponsor turnamen: nama, foto, jumlah (tampil di halaman penonton)
--   admin_accounts  akun panitia + role
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
alter table settings add column if not exists current_tournament_id uuid;

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
alter table fighters add column if not exists fighting_style text;
-- status manual dari panitia. "Gugur" dan "Juara" dihitung otomatis dari hasil fight, gak disimpan di sini.
alter table fighters add column if not exists status text not null default 'active';
alter table fighters drop constraint if exists fighters_status_check;
alter table fighters add constraint fighters_status_check check (status in ('active', 'injured', 'suspended', 'retired'));

-- ---------- TURNAMEN ----------
-- Satu turnamen "jalan" (settings.current_tournament_id), sisanya arsip.
-- current_stage, status, dan podium diisi otomatis dari hasil match (lihat refresh_tournament).
create table if not exists tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'ongoing' check (status in ('ongoing', 'completed', 'archived')),
  current_stage text not null default 'registration',
  champion_id uuid references fighters(id) on delete set null,
  runner_up_id uuid references fighters(id) on delete set null,
  third_id uuid references fighters(id) on delete set null,
  champion_name text,     -- nama disalin, jadi papan juara tetap utuh walau fighter-nya dihapus
  runner_up_name text,
  third_name text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
do $$ begin
  alter table settings add constraint settings_current_tournament_fkey
    foreign key (current_tournament_id) references tournaments(id) on delete set null;
exception when duplicate_object then null; end $$;

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
  featured boolean not null default false,   -- "Tampil minggu ini"
  house_cut numeric not null default 0.2 check (house_cut >= 0 and house_cut < 1),
  created_at timestamptz not null default now(),
  unique (kind, round, slot)
);

-- Kolom status dibuat lewat blok ini supaya match lama dapat status yang cocok SEKALI aja:
-- yang udah ada pemenangnya = selesai, yang lagi "tampil minggu ini" = live.
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'matches' and column_name = 'status') then
    alter table matches add column status text not null default 'upcoming';
    update matches set status = 'completed' where winner_id is not null;
    update matches set status = 'live'
      where winner_id is null and featured and fighter1_id is not null and fighter2_id is not null;
  end if;
end $$;
alter table matches add column if not exists tournament_id uuid references tournaments(id) on delete cascade;
alter table matches add column if not exists scheduled_at timestamptz;      -- dulu jadwal fight; gak dipakai website lagi, kolomnya dibiarkan
alter table matches add column if not exists result_method text;            -- cara menang
alter table matches add column if not exists duration_sec int;              -- dulu durasi fight; gak dipakai website lagi, kolomnya dibiarkan
alter table matches add column if not exists completed_at timestamptz;      -- kapan hasil resmi masuk
alter table matches add column if not exists betting_closed boolean not null default false;  -- taruhan ditutup manual

alter table matches drop constraint if exists matches_kind_check;
alter table matches add constraint matches_kind_check check (kind in ('main', 'third', 'extra'));   -- extra = laga tambahan di luar bracket
alter table matches drop constraint if exists matches_status_check;
alter table matches add constraint matches_status_check check (status in ('upcoming', 'live', 'completed', 'postponed', 'cancelled'));
alter table matches drop constraint if exists matches_result_method_check;
alter table matches add constraint matches_result_method_check
  check (result_method is null or result_method in ('KO', 'TKO', 'SURRENDER', 'DECISION', 'DQ', 'WO'));
alter table matches drop constraint if exists matches_duration_check;
alter table matches add constraint matches_duration_check check (duration_sec is null or (duration_sec >= 0 and duration_sec <= 86400));

-- posisi di bracket sekarang unik PER TURNAMEN (dulu global)
alter table matches drop constraint if exists matches_kind_round_slot_key;
do $$ begin
  alter table matches add constraint matches_tournament_slot_key unique (tournament_id, kind, round, slot);
exception when duplicate_table or duplicate_object then null; end $$;
create index if not exists matches_tournament_idx on matches(tournament_id);

-- ---------- CATATAN RESMI FIGHT (arsip) ----------
-- Diisi otomatis tiap hasil resmi masuk. Nama disalin, jadi arsip tetap kebaca walau fighter dihapus.
-- Ikut kehapus kalau match-nya dihapus (bracket dibuat ulang / turnamen arsip dihapus).
create table if not exists fight_history (
  id uuid primary key default gen_random_uuid(),
  match_id uuid unique references matches(id) on delete cascade,
  tournament_id uuid references tournaments(id) on delete set null,
  tournament_name text,
  match_no int not null,
  stage text not null,               -- final | third | semifinal | quarterfinal | round-N | extra
  fighter_a_id uuid references fighters(id) on delete set null,
  fighter_b_id uuid references fighters(id) on delete set null,
  winner_id uuid references fighters(id) on delete set null,
  winner_side smallint not null check (winner_side in (1, 2)),
  fighter_a_name text not null,
  fighter_b_name text not null,
  winner_name text not null,
  result_method text,
  duration_sec int,
  completed_at timestamptz not null default now()
);
-- boleh kosong: fight lama yang tanggalnya gak dicatat (Vol. 1). Fight baru tetap diisi otomatis oleh trigger.
alter table fight_history alter column completed_at drop not null;
create index if not exists fight_history_completed_idx on fight_history(completed_at desc);

-- ---------- TARUHAN (mata uang RP, bukan uang asli) ----------
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
alter table bets add column if not exists recorded_by uuid default auth.uid();   -- panitia yang nyatat
alter table bets add column if not exists paid_out_at timestamptz;
create index if not exists bets_match_idx on bets(match_id);

-- ---------- RIWAYAT TRANSAKSI TARUHAN ----------
-- Tiap taruhan dicatat, diubah, dibayar, atau dihapus → satu baris di sini. Gak bisa diedit dari panel.
create table if not exists bet_log (
  id bigint generated always as identity primary key,
  bet_id uuid,
  match_id uuid,
  action text not null check (action in ('placed', 'edited', 'paid', 'unpaid', 'voided')),
  bettor_name text not null,
  fighter_id uuid,
  fighter_name text,
  amount int not null,
  actor uuid,
  actor_name text,
  created_at timestamptz not null default now()
);
create index if not exists bet_log_match_idx on bet_log(match_id, created_at desc);

-- ---------- SPONSOR ----------
-- Nama, foto/logo, dan jumlah sponsornya tampil di halaman penonton. Cuma superadmin yang ngelola.
-- Nempel ke turnamen: turnamen baru mulai dengan daftar sponsor kosong, sponsor lama ikut arsip.
create table if not exists sponsors (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  amount int not null default 0 check (amount >= 0 and amount <= 1000000000),   -- Yen (mata uang RP)
  photo_url text,
  created_at timestamptz not null default now()
);
create index if not exists sponsors_tournament_idx on sponsors(tournament_id);

-- ---------- TOTAL POOL PER MATCH (aman buat publik, tanpa nama bettor) ----------
drop view if exists match_pools;
create view match_pools as
select
  m.id as match_id,
  coalesce(sum(b.amount) filter (where b.fighter_id = m.fighter1_id), 0)::bigint as pool1,
  coalesce(sum(b.amount) filter (where b.fighter_id = m.fighter2_id), 0)::bigint as pool2,
  count(b.id)::int as bet_count,
  count(distinct lower(btrim(b.bettor_name)))::int as bettors
from matches m
left join bets b on b.match_id = m.id
group by m.id;

-- =========================================================
-- AKUN ADMIN
-- role 'superadmin' (cuma boleh 1): semua operasional + generate bracket + turnamen + house cut
--                                   + untung kas + sponsor + pengaturan + kelola akun admin
-- role 'admin'                     : pendaftaran, status fight, hasil resmi, catat taruhan
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
-- LOGIKA OTOMATIS (trigger)
-- =========================================================

-- Kunci babak yang stabil: dipakai arsip & papan turnamen.
create or replace function stage_key(p_kind text, p_round int, p_total int) returns text
language sql immutable as $$
  select case
    when p_kind = 'third' then 'third'
    when p_kind = 'extra' then 'extra'
    when p_round = p_total then 'final'
    when p_round = p_total - 1 then 'semifinal'
    when p_round = p_total - 2 then 'quarterfinal'
    else 'round-' || p_round
  end;
$$;

-- Hitung ulang babak yang lagi jalan + podium sebuah turnamen. Turnamen arsip gak disentuh lagi.
create or replace function refresh_tournament(tid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  t tournaments%rowtype;
  fin matches%rowtype;
  thr matches%rowtype;
  total int;
  pending_round int;
  champ uuid;
  runner uuid;
  third uuid;
  champ_name text;
  runner_name text;
  third_name_ text;
  stage text := 'registration';
  new_status text;
begin
  if tid is null then return; end if;
  select * into t from tournaments where id = tid;
  if not found or t.status = 'archived' then return; end if;

  select coalesce(max(round), 0) into total from matches where tournament_id = tid and kind = 'main';
  if total > 0 then
    select * into fin from matches where tournament_id = tid and kind = 'main' and round = total order by slot limit 1;
    select * into thr from matches where tournament_id = tid and kind = 'third' order by slot limit 1;
    champ := fin.winner_id;
    if champ is not null then
      runner := case when champ = fin.fighter1_id then fin.fighter2_id else fin.fighter1_id end;
    end if;
    third := thr.winner_id;
    select min(round) into pending_round from matches
      where tournament_id = tid and kind = 'main' and winner_id is null;
    stage := case
      when pending_round is null then
        case when thr.id is not null and thr.winner_id is null then 'third' else 'completed' end
      when pending_round = total and thr.id is not null and thr.winner_id is null
           and thr.fighter1_id is not null and thr.fighter2_id is not null then 'third'
      else stage_key('main', pending_round, total)
    end;
  end if;

  select name into champ_name from fighters where id = champ;
  select name into runner_name from fighters where id = runner;
  select name into third_name_ from fighters where id = third;
  new_status := case when champ is not null then 'completed' else 'ongoing' end;

  update tournaments set
    current_stage = stage,
    status = new_status,
    champion_id = champ, runner_up_id = runner, third_id = third,
    champion_name = champ_name, runner_up_name = runner_name, third_name = third_name_,
    completed_at = case when champ is null then null else coalesce(completed_at, now()) end
  where id = tid
    and (current_stage, status, champion_id, runner_up_id, third_id, champion_name, runner_up_name, third_name)
        is distinct from (stage, new_status, champ, runner, third, champ_name, runner_name, third_name_);
end $$;

-- Sebelum match disimpan: jaga konsistensi status ↔ pemenang.
create or replace function matches_before_write() returns trigger
language plpgsql set search_path = public as $$
begin
  -- pemenang harus salah satu fighter di match ini
  if new.winner_id is not null
     and new.winner_id is distinct from new.fighter1_id
     and new.winner_id is distinct from new.fighter2_id then
    new.winner_id := null;
  end if;

  if new.winner_id is not null then
    new.status := 'completed';
    if new.completed_at is null then new.completed_at := now(); end if;
  else
    new.completed_at := null;
    new.result_method := null;
    new.duration_sec := null;
    if new.status = 'completed' then new.status := 'upcoming'; end if;
    -- fight gak bisa "live" kalau belum ada dua fighter
    if new.status = 'live' and (new.fighter1_id is null or new.fighter2_id is null) then
      new.status := 'upcoming';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists matches_before_write on matches;
create trigger matches_before_write before insert or update on matches
  for each row execute function matches_before_write();

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

-- Sesudah match disimpan: tulis catatan resmi + perbarui papan turnamen.
create or replace function matches_after_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  total int;
  gone boolean;
begin
  if tg_op = 'DELETE' then
    perform refresh_tournament(old.tournament_id);
    return old;
  end if;

  if new.winner_id is not null and new.fighter1_id is not null and new.fighter2_id is not null then
    select coalesce(max(round), 0) into total from matches
      where kind = 'main' and tournament_id is not distinct from new.tournament_id;
    insert into fight_history (
      match_id, tournament_id, tournament_name, match_no, stage,
      fighter_a_id, fighter_b_id, winner_id, winner_side,
      fighter_a_name, fighter_b_name, winner_name,
      result_method, duration_sec, completed_at)
    select
      new.id, new.tournament_id, (select name from tournaments where id = new.tournament_id),
      new.match_no, stage_key(new.kind, new.round, total),
      new.fighter1_id, new.fighter2_id, new.winner_id,
      case when new.winner_id = new.fighter1_id then 1 else 2 end,
      fa.name, fb.name,
      case when new.winner_id = new.fighter1_id then fa.name else fb.name end,
      new.result_method, new.duration_sec, coalesce(new.completed_at, now())
    from fighters fa, fighters fb
    where fa.id = new.fighter1_id and fb.id = new.fighter2_id
    on conflict (match_id) do update set
      tournament_id = excluded.tournament_id,
      tournament_name = excluded.tournament_name,
      match_no = excluded.match_no,
      stage = excluded.stage,
      fighter_a_id = excluded.fighter_a_id,
      fighter_b_id = excluded.fighter_b_id,
      winner_id = excluded.winner_id,
      winner_side = excluded.winner_side,
      fighter_a_name = excluded.fighter_a_name,
      fighter_b_name = excluded.fighter_b_name,
      winner_name = excluded.winner_name,
      result_method = excluded.result_method,
      duration_sec = excluded.duration_sec,
      completed_at = excluded.completed_at;
  elsif tg_op = 'UPDATE' and (old.winner_id is distinct from new.winner_id
        or old.fighter1_id is distinct from new.fighter1_id
        or old.fighter2_id is distinct from new.fighter2_id) then
    -- Hasil dibatalkan / isi match berubah → catatannya dicabut.
    -- Kecuali kalau penyebabnya fighter dihapus: catatan lama tetap disimpan apa adanya.
    gone := (old.fighter1_id is not null and new.fighter1_id is null
               and not exists (select 1 from fighters where id = old.fighter1_id))
         or (old.fighter2_id is not null and new.fighter2_id is null
               and not exists (select 1 from fighters where id = old.fighter2_id))
         or (old.winner_id is not null and new.winner_id is null
               and not exists (select 1 from fighters where id = old.winner_id));
    if not gone then
      delete from fight_history where match_id = new.id;
    end if;
  end if;

  perform refresh_tournament(new.tournament_id);
  if tg_op = 'UPDATE' and old.tournament_id is distinct from new.tournament_id then
    perform refresh_tournament(old.tournament_id);
  end if;
  return new;
end $$;
drop trigger if exists matches_after_write on matches;
create trigger matches_after_write after insert or update or delete on matches
  for each row execute function matches_after_write();

-- Fighter ganti nama → nama di arsip & papan juara ikut diperbarui.
create or replace function fighters_after_rename() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.name is distinct from old.name then
    update fight_history set fighter_a_name = new.name where fighter_a_id = new.id;
    update fight_history set fighter_b_name = new.name where fighter_b_id = new.id;
    update fight_history set winner_name = new.name where winner_id = new.id;
    update tournaments set champion_name = new.name where champion_id = new.id;
    update tournaments set runner_up_name = new.name where runner_up_id = new.id;
    update tournaments set third_name = new.name where third_id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists fighters_after_rename on fighters;
create trigger fighters_after_rename after update of name on fighters
  for each row execute function fighters_after_rename();

-- Taruhan: tolak yang gak valid, dobel, atau masuk setelah taruhan ditutup.
create or replace function guard_bet() returns trigger
language plpgsql set search_path = public as $$
declare
  m matches%rowtype;
begin
  if tg_op = 'UPDATE'
     and new.match_id is not distinct from old.match_id
     and new.fighter_id is not distinct from old.fighter_id
     and new.amount is not distinct from old.amount then
    -- cuma ganti status bayar / nama / rekening: boleh kapan aja
    if new.paid_out is distinct from old.paid_out then
      new.paid_out_at := case when new.paid_out then now() else null end;
    end if;
    return new;
  end if;

  new.bettor_name := btrim(coalesce(new.bettor_name, ''));
  if new.bettor_name = '' then raise exception 'Nama bettor wajib diisi.'; end if;
  if new.amount is null or new.amount <= 0 then raise exception 'Nominal taruhan harus lebih dari 0.'; end if;
  if new.amount > 100000000 then raise exception 'Nominal maksimal ¥100.000.000 per taruhan.'; end if;

  select * into m from matches where id = new.match_id;
  if not found then raise exception 'Fight-nya gak ketemu.'; end if;
  if m.fighter1_id is null or m.fighter2_id is null then raise exception 'Fight ini belum punya dua fighter.'; end if;
  if m.winner_id is not null or m.status = 'completed' then raise exception 'Fight ini udah selesai, taruhan ditutup.'; end if;
  if m.status = 'cancelled' then raise exception 'Fight ini dibatalkan, taruhan ditutup.'; end if;
  if m.status = 'live' then raise exception 'Fight udah mulai, taruhan ditutup.'; end if;
  if m.betting_closed then raise exception 'Taruhan buat fight ini lagi ditutup panitia.'; end if;
  if new.fighter_id is distinct from m.fighter1_id and new.fighter_id is distinct from m.fighter2_id then
    raise exception 'Jagoan harus salah satu fighter di fight ini.';
  end if;

  if tg_op = 'INSERT' and exists (
    select 1 from bets b
    where b.match_id = new.match_id and b.fighter_id = new.fighter_id and b.amount = new.amount
      and lower(b.bettor_name) = lower(new.bettor_name)
      and b.created_at > now() - interval '10 seconds') then
    raise exception 'Taruhan yang sama baru aja dicatat. Cek daftarnya dulu sebelum nyatat lagi.';
  end if;
  return new;
end $$;
drop trigger if exists bets_guard on bets;
create trigger bets_guard before insert or update on bets
  for each row execute function guard_bet();

-- Tiap perubahan taruhan masuk riwayat transaksi.
create or replace function bets_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r bets%rowtype;
  act text;
begin
  if tg_op = 'DELETE' then
    r := old; act := 'voided';
  elsif tg_op = 'INSERT' then
    r := new; act := 'placed';
  else
    r := new;
    if new.paid_out is distinct from old.paid_out then
      act := case when new.paid_out then 'paid' else 'unpaid' end;
    elsif new.amount is distinct from old.amount or new.fighter_id is distinct from old.fighter_id
       or new.bettor_name is distinct from old.bettor_name or new.bettor_account is distinct from old.bettor_account then
      act := 'edited';
    else
      return null;
    end if;
  end if;
  insert into bet_log (bet_id, match_id, action, bettor_name, fighter_id, fighter_name, amount, actor, actor_name)
  values (
    r.id, r.match_id, act, r.bettor_name, r.fighter_id,
    (select name from fighters where id = r.fighter_id),
    r.amount, auth.uid(),
    (select username from admin_accounts where user_id = auth.uid()));
  return null;
end $$;
drop trigger if exists bets_audit on bets;
create trigger bets_audit after insert or update or delete on bets
  for each row execute function bets_audit();

-- Bettor ngecek slip-nya sendiri pakai kode slip (8 karakter) tanpa perlu akun.
-- Yang balik cuma taruhan dengan kode itu, taruhan orang lain tetap rahasia.
create or replace function bet_slip(p_code text)
returns table (code text, match_id uuid, fighter_id uuid, bettor_name text, amount int, created_at timestamptz, paid_out boolean)
language sql stable security definer set search_path = public as $$
  select upper(left(replace(b.id::text, '-', ''), 8)), b.match_id, b.fighter_id, b.bettor_name, b.amount, b.created_at, b.paid_out
  from bets b
  where left(replace(b.id::text, '-', ''), 8) = lower(regexp_replace(coalesce(p_code, ''), '[^0-9A-Fa-f]', '', 'g'))
  limit 5;
$$;
revoke all on function bet_slip(text) from public;
grant execute on function bet_slip(text) to anon, authenticated;

-- Superadmin: arsipkan turnamen yang jalan, mulai turnamen baru (bracket kosong).
create or replace function start_tournament(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  old_id uuid;
  new_id uuid;
  nm text := btrim(coalesce(p_name, ''));
begin
  if not is_superadmin() then raise exception 'Cuma superadmin yang boleh mulai turnamen baru.'; end if;
  if nm = '' then raise exception 'Nama turnamen wajib diisi.'; end if;
  if length(nm) > 80 then raise exception 'Nama turnamen maksimal 80 karakter.'; end if;

  select current_tournament_id into old_id from settings where id = 1;
  if old_id is not null then
    -- fight yang belum selesai di turnamen lama gak ikut tampil lagi
    update matches set featured = false, status = case when status = 'live' then 'upcoming' else status end
      where tournament_id = old_id and (featured or status = 'live');
    update tournaments set status = 'archived' where id = old_id;
  end if;
  insert into tournaments (name) values (nm) returning id into new_id;
  update settings set current_tournament_id = new_id, updated_at = now() where id = 1;
  return new_id;
end $$;
revoke all on function start_tournament(text) from public;
grant execute on function start_tournament(text) to authenticated;

-- =========================================================
-- DATA LAMA → STRUKTUR BARU (jalan sekali, aman diulang)
-- =========================================================
do $$
declare
  tid uuid;
begin
  select current_tournament_id into tid from settings where id = 1;
  if tid is null or not exists (select 1 from tournaments where id = tid) then
    insert into tournaments (name)
      select btrim(event_name) || ' Vol. 1' from settings where id = 1
      returning id into tid;
    update settings set current_tournament_id = tid where id = 1;
  end if;
  -- match lama masuk ke turnamen yang lagi jalan
  update matches set tournament_id = tid where tournament_id is null;
  -- fight yang udah selesai tapi belum punya catatan resmi → dicatat sekarang
  update matches m set match_no = m.match_no
    where m.winner_id is not null and m.fighter1_id is not null and m.fighter2_id is not null
      and not exists (select 1 from fight_history h where h.match_id = m.id);
  perform refresh_tournament(tid);
end $$;

-- =========================================================
-- KEAMANAN (Row Level Security)
-- Penonton (anon) cuma bisa BACA. Admin ngelola operasional, pengaturan & turnamen cuma superadmin.
-- =========================================================
alter table settings      enable row level security;
alter table fighters      enable row level security;
alter table matches       enable row level security;
alter table bets          enable row level security;
alter table tournaments   enable row level security;
alter table fight_history enable row level security;
alter table bet_log       enable row level security;
alter table sponsors      enable row level security;

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
drop policy if exists "public read tournaments"       on tournaments;
drop policy if exists "superadmin update tournaments" on tournaments;
drop policy if exists "superadmin delete tournaments" on tournaments;
drop policy if exists "public read fight_history"     on fight_history;
drop policy if exists "admin read bet_log"            on bet_log;
drop policy if exists "public read sponsors"          on sponsors;
drop policy if exists "superadmin all sponsors"       on sponsors;

create policy "public read settings"     on settings for select to anon, authenticated using (true);
create policy "superadmin edit settings" on settings for update to authenticated using (is_superadmin()) with check (is_superadmin());
create policy "public read fighters"     on fighters for select to anon, authenticated using (true);
create policy "admin all fighters"       on fighters for all to authenticated using (is_admin()) with check (is_admin());
create policy "public read matches"      on matches  for select to anon, authenticated using (true);
-- Admin cuma boleh UPDATE match (status, hasil resmi, "tampil minggu ini").
-- Bikin / hapus match (generate bracket, laga tambahan) cuma superadmin.
create policy "admin update matches"      on matches for update to authenticated using (is_admin()) with check (is_admin());
create policy "superadmin insert matches" on matches for insert to authenticated with check (is_superadmin());
create policy "superadmin delete matches" on matches for delete to authenticated using (is_superadmin());

-- bets TIDAK bisa dibaca publik (nama bettor & nominal per orang tetap rahasia)
create policy "admin all bets"           on bets     for all to authenticated using (is_admin()) with check (is_admin());

-- Turnamen: semua bisa baca. Ganti nama cuma superadmin. Turnamen baru lewat start_tournament().
-- Yang boleh dihapus cuma arsip, bukan turnamen yang lagi jalan.
create policy "public read tournaments"       on tournaments for select to anon, authenticated using (true);
create policy "superadmin update tournaments" on tournaments for update to authenticated using (is_superadmin()) with check (is_superadmin());
create policy "superadmin delete tournaments" on tournaments for delete to authenticated
  using (is_superadmin() and id is distinct from (select current_tournament_id from settings where id = 1));
revoke insert on tournaments from anon, authenticated;

-- Arsip fight: semua bisa baca, gak ada yang bisa nulis langsung (diisi trigger).
create policy "public read fight_history" on fight_history for select to anon, authenticated using (true);
revoke insert, update, delete on fight_history from anon, authenticated;

-- Riwayat transaksi: cuma panitia yang bisa baca, gak ada yang bisa ngedit.
create policy "admin read bet_log" on bet_log for select to authenticated using (is_admin());
revoke insert, update, delete on bet_log from anon, authenticated;

-- Sponsor: semua bisa baca (tampil di halaman penonton). Tambah / ubah / hapus cuma superadmin.
create policy "public read sponsors"    on sponsors for select to anon, authenticated using (true);
create policy "superadmin all sponsors" on sponsors for all to authenticated using (is_superadmin()) with check (is_superadmin());

-- Penonton cuma boleh lihat kolom fighter yang aman (status bayar, fee, catatan disembunyikan)
revoke select on fighters from anon;
grant select (id, name, group_name, photo_url, fighting_style, status) on fighters to anon;

grant select on match_pools to anon, authenticated;

-- =========================================================
-- REALTIME (website penonton update otomatis tanpa refresh)
-- =========================================================
do $$
begin
  begin alter publication supabase_realtime add table matches;       exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table settings;      exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table tournaments;   exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table fight_history; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table sponsors;      exception when duplicate_object then null; end;
  -- bets: cuma admin yang nerima (RLS), panel admin lain langsung update.
  -- fighters sengaja TIDAK dimasukkan (kolom bayar/fee/catatan rahasia); panel admin polling tiap 10 detik.
  begin alter publication supabase_realtime add table bets;          exception when duplicate_object then null; end;
end $$;

-- =========================================================
-- STORAGE FOTO, maks 5 MB per file
-- fighters/ → semua admin, hero/ & sponsors/ → cuma superadmin
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
