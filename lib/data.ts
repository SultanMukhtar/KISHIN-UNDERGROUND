/**
 * Ambil data dari Supabase.
 * Tahan banting buat database yang belum di-update ke schema terbaru:
 * tabel/kolom baru yang belum ada dianggap kosong, website lama tetap jalan.
 */
import { sb } from "./supabase";
import type { Bet, BetLog, Fighter, HistoryRow, Match, Pool, Settings, Sponsor, Tournament } from "./types";

type DbError = { code?: string; message: string };

/** Tabel / kolom belum ada, atau belum dikasih izin baca → database masih schema lama. */
const isMissing = (e: DbError | null) =>
  !!e && (["PGRST205", "PGRST204", "PGRST202", "42P01", "42703", "42501"].includes(e.code ?? "") || /schema cache|does not exist/i.test(e.message));

export type PublicData = {
  settings: Settings | null;
  fighters: Fighter[];
  /** match turnamen yang lagi jalan aja */
  matches: Match[];
  pools: Pool[];
  tournaments: Tournament[];
  tournament: Tournament | null;
  /** null = tabel fight_history belum ada (database lama) */
  history: HistoryRow[] | null;
  /** sponsor turnamen yang lagi jalan, jumlah terbesar dulu */
  sponsors: Sponsor[];
  /** false = supabase/schema.sql versi terbaru belum di-Run */
  schemaReady: boolean;
};

export const EMPTY_PUBLIC: PublicData = {
  settings: null, fighters: [], matches: [], pools: [], tournaments: [], tournament: null, history: null, sponsors: [], schemaReady: false,
};

const FIGHTER_COLS = "id,name,group_name,photo_url";
let fullFighterCols = true;
/** Tabel turnamen & arsip ada? Di database lama: false, biar gak nembak request gagal tiap 30 detik. */
let hasArchive = true;
/** Tabel sponsor ada? Kalau belum, gak ditanya lagi sampai halaman dimuat ulang. */
let hasSponsors = true;
const MISSING = { data: null, error: { code: "42P01", message: "does not exist" } };

/** Match milik turnamen yang lagi jalan. Database lama (tanpa kolom tournament_id) → semua match. */
export function currentMatches(all: Match[], settings: Settings | null): Match[] {
  const cur = settings?.current_tournament_id;
  if (!cur) return all.filter((m) => !m.tournament_id);
  return all.filter((m) => m.tournament_id === cur);
}

/** Sponsor turnamen yang lagi jalan (data udah diurutkan dari query). */
const currentSponsors = (all: Sponsor[], settings: Settings | null) =>
  all.filter((s) => s.tournament_id === (settings?.current_tournament_id ?? null));

const sponsorsQuery = () =>
  sb().from("sponsors").select("*").order("amount", { ascending: false }).order("created_at", { ascending: true });

export async function loadPublic(): Promise<PublicData> {
  const c = sb();
  const fightersQ = async () => {
    if (fullFighterCols) {
      const r = await c.from("fighters").select(FIGHTER_COLS + ",fighting_style,status");
      if (!r.error) return r;
      if (!isMissing(r.error)) return r;
      fullFighterCols = false;
    }
    return c.from("fighters").select(FIGHTER_COLS);
  };
  const [s, f, m, p, t, h, sp] = await Promise.all([
    c.from("settings").select("*").eq("id", 1).maybeSingle(),
    fightersQ(),
    c.from("matches").select("*").order("match_no"),
    c.from("match_pools").select("*"),
    hasArchive ? c.from("tournaments").select("*").order("created_at", { ascending: false }) : MISSING,
    hasArchive ? c.from("fight_history").select("*").order("completed_at", { ascending: false }).limit(500) : MISSING,
    hasSponsors ? sponsorsQuery() : MISSING,
  ]);
  const err = s.error || f.error || m.error || p.error;
  if (err) throw err;
  if (t.error && !isMissing(t.error)) throw t.error;
  if (h.error && !isMissing(h.error)) throw h.error;
  // sponsor cuma pelengkap: gagal dimuat gak boleh bikin halaman fight ikut error
  if (sp.error) {
    if (isMissing(sp.error)) hasSponsors = false;
    else console.warn("Gagal memuat sponsor:", sp.error.message);
  }

  const settings = (s.data as Settings | null) ?? null;
  const schemaReady = !!settings && "current_tournament_id" in settings;
  // database baru di-update → load berikutnya ambil kolom & tabel lengkap lagi
  fullFighterCols = schemaReady || fullFighterCols;
  hasArchive = schemaReady || !(t.error || h.error);
  const tournaments = (t.error ? [] : t.data ?? []) as Tournament[];
  return {
    settings,
    fighters: (f.data ?? []) as unknown as Fighter[],
    matches: currentMatches((m.data ?? []) as Match[], settings),
    pools: (p.data ?? []) as Pool[],
    tournaments,
    tournament: tournaments.find((x) => x.id === settings?.current_tournament_id) ?? null,
    history: h.error ? null : ((h.data ?? []) as HistoryRow[]),
    sponsors: sp.error ? [] : currentSponsors((sp.data ?? []) as Sponsor[], settings),
    schemaReady,
  };
}

export type AdminLoad = {
  settings: Settings | null;
  fighters: Fighter[];
  matches: Match[];
  bets: Bet[];
  betLog: BetLog[];
  tournaments: Tournament[];
  tournament: Tournament | null;
  history: HistoryRow[] | null;
  /** sponsor turnamen yang lagi jalan, jumlah terbesar dulu */
  sponsors: Sponsor[];
  /** false = tabel sponsor belum ada (supabase/schema.sql terbaru belum di-Run) */
  sponsorsReady: boolean;
  schemaReady: boolean;
  error: string | null;
};

export async function loadAdmin(): Promise<AdminLoad> {
  const c = sb();
  const [s, f, m, b, t, h, l, sp] = await Promise.all([
    c.from("settings").select("*").eq("id", 1).maybeSingle(),
    c.from("fighters").select("*").order("created_at"),
    c.from("matches").select("*").order("match_no"),
    c.from("bets").select("*").order("created_at"),
    c.from("tournaments").select("*").order("created_at", { ascending: false }),
    c.from("fight_history").select("*").order("completed_at", { ascending: false }).limit(1000),
    c.from("bet_log").select("*").order("created_at", { ascending: false }).limit(300),
    sponsorsQuery(),
  ]);
  const optional = [t.error, h.error, l.error, sp.error].find((e) => e && !isMissing(e));
  const err = s.error || f.error || m.error || b.error || optional || null;
  const settings = (s.data as Settings | null) ?? null;
  const tournaments = (t.error ? [] : t.data ?? []) as Tournament[];
  const matches = currentMatches((m.data ?? []) as Match[], settings);
  const ids = new Set(matches.map((x) => x.id));
  return {
    settings,
    fighters: (f.data ?? []) as Fighter[],
    matches,
    bets: ((b.data ?? []) as Bet[]).filter((x) => ids.has(x.match_id)),
    betLog: (l.error ? [] : l.data ?? []) as BetLog[],
    tournaments,
    tournament: tournaments.find((x) => x.id === settings?.current_tournament_id) ?? null,
    history: h.error ? null : ((h.data ?? []) as HistoryRow[]),
    sponsors: sp.error ? [] : currentSponsors((sp.data ?? []) as Sponsor[], settings),
    sponsorsReady: !sp.error || !isMissing(sp.error),
    schemaReady: !!settings && "current_tournament_id" in settings,
    error: err ? err.message : null,
  };
}
