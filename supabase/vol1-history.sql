-- =========================================================
-- RIWAYAT UNDERGROUND Vol. 1 (turnamen arsip)
-- Jalankan di Supabase > SQL Editor SETELAH schema.sql.
-- Aman di-Run ulang: data Vol. 1 yang lama dihapus lalu ditulis ulang.
--
-- Yang dilakukan:
--   1. Turnamen yang lagi jalan diganti namanya jadi "... Vol. 2"
--      (schema.sql otomatis namain "... Vol. 1" waktu pertama kali di-Run).
--   2. Bikin turnamen arsip "UNDERGROUND Vol. 1" + podiumnya.
--   3. Masukin semua fight Vol. 1 ke riwayat (tanpa tanggal).
--      Fighter yang namanya sama dengan fighter terdaftar otomatis nyambung ke profilnya.
--
-- Format khusus Vol. 1 (gak dipakai lagi):
--   Strpz Togashi walk out di semifinal → Njut Pourkian menang WO.
--   Hito Kassa (kalah di semifinal) dilawankan ke Njut Pourkian di laga tambahan;
--   pemenangnya (Hito) ketemu Yb Arap lagi di final.
--   Njut Pourkian juara 3 (gak ada fight perebutan juara 3 karena Strpz walk out).
-- =========================================================

alter table fight_history alter column completed_at drop not null;

do $$
declare
  vol1 constant text := 'UNDERGROUND Vol. 1';
  cur uuid;
  tid uuid;
begin
  if to_regclass('public.fight_history') is null or to_regclass('public.tournaments') is null then
    raise exception 'Jalankan supabase/schema.sql dulu, baru file ini.';
  end if;

  -- 1. Turnamen yang lagi jalan = Vol. 2
  select current_tournament_id into cur from settings where id = 1;
  update tournaments set name = regexp_replace(name, 'Vol\.\s*1$', 'Vol. 2', 'i')
    where id = cur and name ~* 'Vol\.\s*1$';
  update fight_history h set tournament_name = t.name
    from tournaments t where t.id = cur and h.tournament_id = cur;

  -- 2. Buang Vol. 1 lama (kalau file ini pernah di-Run)
  delete from fight_history where tournament_name = vol1 and match_id is null;
  delete from tournaments where name = vol1 and id is distinct from cur;

  -- 3. Turnamen arsip Vol. 1 (dibikin "lebih tua" dari turnamen lain biar urutannya bener)
  insert into tournaments (name, status, current_stage, champion_name, runner_up_name, third_name, created_at, completed_at)
  values (vol1, 'archived', 'completed', 'Hito Kassa', 'Yb Arap', 'Njut Pourkian',
          coalesce((select min(created_at) from tournaments), now()) - interval '1 minute', null)
  returning id into tid;

  -- 4. Semua fight Vol. 1. side = pemenangnya fighter ke-1 atau ke-2.
  insert into fight_history (tournament_id, tournament_name, match_no, stage,
                             fighter_a_name, fighter_b_name, winner_side, winner_name, result_method, completed_at)
  select tid, vol1, v.no, v.stage, v.a, v.b, v.side,
         case when v.side = 1 then v.a else v.b end, v.method, null
  from (values
    -- Ronde 1
    ( 1, 'round-1', 'Elshiro Higa',     'Goro Mireles',        2, null::text),
    ( 2, 'round-1', 'Leonidas Rich',    'Yb Arap',             2, null),
    ( 3, 'round-1', 'Lucient Giovanna', 'Keith D''Angelo',     1, null),
    ( 4, 'round-1', 'Njut Pourkian',    'Brosar',              1, null),
    ( 5, 'round-1', 'Ell Yazbeck',      'Dyanne Miyake',       2, null),
    ( 6, 'round-1', 'Zel Sanders',      'Eizen Walter',        2, null),
    ( 7, 'round-1', 'Kenjiro Marimo',   'Ryu Sakurai',         2, null),
    ( 8, 'round-1', 'Brayen O''connor', 'Refar Visser',        1, null),
    ( 9, 'round-1', 'Hito Kassa',       'Helian Shimazaki',    1, null),
    (10, 'round-1', 'Kyyeru Kiyohara',  'Langits Affonso',     1, null),
    (11, 'round-1', 'Brain Roth',       'Papyrus Ferdowsi',    2, null),
    (12, 'round-1', 'Biru Hirugashi',   'Yotaro Van Der Meer', 2, null),
    (13, 'round-1', 'El Takoyaki',      'Pieee Albino',        1, null),
    (14, 'round-1', 'Ebe Parks',        'Lula Mercier',        2, null),
    (15, 'round-1', 'Strpz Togashi',    'Natsu Gojo',          1, null),
    (16, 'round-1', 'Chuta Aarav',      'Lite Yagami',         1, null),
    (17, 'round-1', 'Sen Nakashima',    'Judas d''angelo',     2, null),
    -- Perempat final
    (18, 'quarterfinal', 'Lucient Giovanna', 'Yb Arap',          2, null),
    (19, 'quarterfinal', 'Njut Pourkian',    'Papyrus Ferdowsi', 1, null),
    (20, 'quarterfinal', 'Chuta Aarav',      'Strpz Togashi',    2, null),
    (21, 'quarterfinal', 'Hito Kassa',       'Lula Mercier',     1, null),
    -- Semifinal
    (22, 'semifinal', 'Hito Kassa',    'Yb Arap',       2, null),
    (23, 'semifinal', 'Njut Pourkian', 'Strpz Togashi', 1, 'WO'),   -- Strpz walk out
    -- Laga tambahan: yang kalah di semifinal vs Njut, pemenangnya ke final
    (24, 'extra', 'Hito Kassa', 'Njut Pourkian', 1, null),
    -- Final
    (25, 'final', 'Yb Arap', 'Hito Kassa', 2, null)
  ) as v(no, stage, a, b, side, method);

  -- 5. Sambungin ke profil fighter yang namanya sama (gak peduli huruf besar/kecil)
  update fight_history h set
    fighter_a_id = (select f.id from fighters f where lower(btrim(f.name)) = lower(h.fighter_a_name) limit 1),
    fighter_b_id = (select f.id from fighters f where lower(btrim(f.name)) = lower(h.fighter_b_name) limit 1),
    winner_id    = (select f.id from fighters f where lower(btrim(f.name)) = lower(h.winner_name) limit 1)
  where h.tournament_id = tid;

  update tournaments t set
    champion_id  = (select f.id from fighters f where lower(btrim(f.name)) = lower(t.champion_name) limit 1),
    runner_up_id = (select f.id from fighters f where lower(btrim(f.name)) = lower(t.runner_up_name) limit 1),
    third_id     = (select f.id from fighters f where lower(btrim(f.name)) = lower(t.third_name) limit 1)
  where t.id = tid;
end $$;

-- Cek hasilnya
select match_no, stage, fighter_a_name, fighter_b_name, winner_name, result_method,
       (fighter_a_id is not null) as a_nyambung, (fighter_b_id is not null) as b_nyambung
from fight_history where tournament_name = 'UNDERGROUND Vol. 1' order by match_no;
