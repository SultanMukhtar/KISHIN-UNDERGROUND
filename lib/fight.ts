/**
 * Semua yang "dihitung" dari data mentah: status fight, statistik fighter, arsip, status taruhan.
 * Gak ada angka yang ditulis tangan di komponen — semuanya lewat sini.
 */
import { podium, stageKey, totalRounds } from "./bracket";
import type { Fighter, HistoryRow, Match, MatchStatus, ResultMethod } from "./types";

export const isBye = (m: Match) => m.kind === "main" && m.round === 1 && !!m.fighter1_id && !m.fighter2_id;
export const isReady = (m: Match) => !!m.fighter1_id && !!m.fighter2_id;

/**
 * Fighter terdaftar di vol (turnamen) yang lagi jalan?
 * Database lama tanpa pendaftaran per vol (tournament_id undefined) → semua fighter dianggap terdaftar.
 */
export const isRegistered = (f: Fighter, tid: string | null | undefined) =>
  f.tournament_id === undefined || !tid || f.tournament_id === tid;

export function statusOf(m: Match): MatchStatus {
  if (m.winner_id) return "completed";
  if (m.status && m.status !== "completed") return m.status;
  // database lama (belum ada kolom status): yang lagi "tampil minggu ini" = lagi di ring
  if (m.status === undefined && m.featured && isReady(m)) return "live";
  return "upcoming";
}

export const STATUS_LABEL: Record<MatchStatus, string> = {
  upcoming: "Upcoming",
  live: "Live",
  completed: "Completed",
  postponed: "Postponed",
  cancelled: "Cancelled",
};

export const METHODS: ResultMethod[] = ["KO", "TKO", "SURRENDER", "DECISION", "DQ", "WO"];
export const METHOD_LABEL: Record<ResultMethod, string> = {
  KO: "Knockout",
  TKO: "TKO, dihentikan wasit",
  SURRENDER: "Menyerah",
  DECISION: "Keputusan wasit",
  DQ: "Diskualifikasi",
  WO: "Walkover, lawan gak datang",
};
/** Versi pendek buat cap & tabel. */
export const METHOD_SHORT: Record<ResultMethod, string> = {
  KO: "KO", TKO: "TKO", SURRENDER: "Menyerah", DECISION: "Keputusan", DQ: "DQ", WO: "WO",
};

/* ---------- taruhan ---------- */

export type BettingState = "open" | "closed" | "settled";

export function bettingStateOf(m: Match): BettingState {
  if (m.winner_id) return "settled";
  const st = statusOf(m);
  if (!isReady(m) || st === "live" || st === "cancelled" || m.betting_closed) return "closed";
  return "open";
}

export const BETTING_LABEL: Record<BettingState, string> = {
  open: "Betting open",
  closed: "Betting closed",
  settled: "Settled",
};

/** Kenapa taruhan ditutup, dalam bahasa yang dipakai panitia ke penonton. */
export function bettingNote(m: Match): string {
  const st = statusOf(m);
  if (m.winner_id) return "Fight selesai, taruhan udah dihitung.";
  if (st === "cancelled") return "Fight dibatalkan. Semua taruhan dikembalikan utuh.";
  if (st === "live") return "Fight udah mulai, taruhan ditutup.";
  if (m.betting_closed) return "Taruhan ditutup panitia.";
  if (!isReady(m)) return "Nunggu dua fighter-nya ketahuan dulu.";
  return "Taruhan masih dibuka sampai fight mulai.";
}

/* ---------- arsip ---------- */

export type FightRecord = {
  key: string;
  matchId: string | null;
  tournamentId: string | null;
  tournamentName: string | null;
  matchNo: number;
  stage: string;
  a: { id: string | null; name: string };
  b: { id: string | null; name: string };
  winnerSide: 1 | 2;
  method: ResultMethod | null;
  completedAt: string | null;
};

/**
 * Daftar fight yang selesai, terbaru dulu.
 * - Database baru: dari tabel fight_history (catatan resmi, termasuk turnamen arsip).
 * - Database lama (history === null): dihitung dari match turnamen yang lagi jalan.
 */
export function buildRecords(
  history: HistoryRow[] | null,
  matches: Match[],
  byId: Map<string, Fighter>,
  tournamentName: string | null,
): FightRecord[] {
  let out: FightRecord[];
  if (history) {
    out = history.map((h) => ({
      key: h.id,
      matchId: h.match_id,
      tournamentId: h.tournament_id,
      tournamentName: h.tournament_name,
      matchNo: h.match_no,
      stage: h.stage,
      a: { id: h.fighter_a_id, name: h.fighter_a_name },
      b: { id: h.fighter_b_id, name: h.fighter_b_name },
      winnerSide: h.winner_side,
      method: h.result_method,
      completedAt: h.completed_at,
    }));
  } else {
    const total = totalRounds(matches);
    out = matches
      .filter((m) => m.winner_id && isReady(m))
      .map((m) => ({
        key: m.id,
        matchId: m.id,
        tournamentId: m.tournament_id ?? null,
        tournamentName,
        matchNo: m.match_no,
        stage: stageKey(m.round, total, m.kind),
        a: { id: m.fighter1_id, name: byId.get(m.fighter1_id!)?.name ?? "?" },
        b: { id: m.fighter2_id, name: byId.get(m.fighter2_id!)?.name ?? "?" },
        winnerSide: m.winner_id === m.fighter1_id ? 1 : 2,
        method: m.result_method ?? null,
        completedAt: m.completed_at ?? null,
      }));
  }
  return out.sort((x, y) => {
    const tx = x.completedAt ? Date.parse(x.completedAt) : 0;
    const ty = y.completedAt ? Date.parse(y.completedAt) : 0;
    return ty - tx || y.matchNo - x.matchNo;
  });
}

export const winnerOf = (r: FightRecord) => (r.winnerSide === 1 ? r.a : r.b);
export const loserOf = (r: FightRecord) => (r.winnerSide === 1 ? r.b : r.a);

/* ---------- fighter ---------- */

export type FighterStats = { fights: number; wins: number; losses: number; winRate: number | null; records: FightRecord[] };

export function fighterStats(fighterId: string, records: FightRecord[]): FighterStats {
  const mine = records.filter((r) => r.a.id === fighterId || r.b.id === fighterId);
  const wins = mine.filter((r) => winnerOf(r).id === fighterId).length;
  return {
    fights: mine.length,
    wins,
    losses: mine.length - wins,
    winRate: mine.length ? Math.round((wins / mine.length) * 100) : null,
    records: mine,
  };
}

export type FighterState = "champion" | "runner_up" | "third_place" | "eliminated" | "active" | "injured" | "suspended" | "retired";

export const FIGHTER_STATE_LABEL: Record<FighterState, string> = {
  champion: "Champion",
  runner_up: "Runner-up",
  third_place: "Third place",
  eliminated: "Eliminated",
  active: "Active",
  injured: "Injured",
  suspended: "Suspended",
  retired: "Retired",
};

/**
 * Status fighter di turnamen yang lagi jalan.
 * Status manual dari panitia (cedera/skors/pensiun) menang; sisanya dihitung dari bracket.
 */
export function fighterStateOf(f: Fighter, matches: Match[]): FighterState {
  if (f.status && f.status !== "active") return f.status;
  const pod = podium(matches);
  if (pod.first === f.id) return "champion";
  if (pod.second === f.id) return "runner_up";
  if (pod.third === f.id) return "third_place";
  const mine = matches.filter((m) => m.fighter1_id === f.id || m.fighter2_id === f.id);
  const pending = mine.some((m) => !m.winner_id && statusOf(m) !== "cancelled");
  const lost = mine.some((m) => m.kind !== "extra" && m.winner_id && m.winner_id !== f.id);
  return lost && !pending ? "eliminated" : "active";
}

/** Fight berikutnya buat fighter ini (yang belum ada hasilnya). */
export function nextMatchOf(fighterId: string, matches: Match[]): Match | undefined {
  return matches.find((m) => !m.winner_id && statusOf(m) !== "cancelled" && (m.fighter1_id === fighterId || m.fighter2_id === fighterId));
}

/** Slot match ini nunggu siapa? (buat teks "nunggu pemenang fight ...") */
export function waitingFor(m: Match, matches: Match[]): string {
  const total = totalRounds(matches);
  if (m.kind === "third") {
    const semis = matches.filter((x) => x.kind === "main" && x.round === total - 1).map((x) => matchCode(x.match_no));
    return semis.length ? `Nunggu yang kalah di fight ${semis.join(" & ")}` : "Nunggu semifinal";
  }
  if (m.kind === "extra") return "Nunggu lawan";
  const prev = matches.filter((x) => x.kind === "main" && x.round === m.round - 1 && Math.floor(x.slot / 2) === m.slot);
  return prev.length ? `Nunggu pemenang fight ${prev.map((x) => matchCode(x.match_no)).join(" & ")}` : "Nunggu lawan";
}

/* ---------- format ---------- */

export function pad3(n: number): string {
  return String(n).padStart(3, "0");
}
export function matchCode(n: number): string {
  return "#" + pad3(n);
}

const DAY = new Intl.DateTimeFormat("id-ID", { weekday: "short", day: "numeric", month: "short" });
const TIME = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false });
const DATE = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" });

/** "Sab, 14 Nov, 20.30" di zona waktu yang lihat. */
export function fmtWhen(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${DAY.format(d)}, ${TIME.format(d)}`;
}
export function fmtDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : DATE.format(d);
}
export function fmtTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : TIME.format(d);
}
