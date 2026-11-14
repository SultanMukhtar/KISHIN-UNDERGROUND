export type Settings = {
  id: number;
  event_name: string;
  tagline: string;
  hero_url: string | null;
  registration_fee: number;
  default_house_cut: number;
  /** undefined = database belum di-update ke schema terbaru */
  current_tournament_id?: string | null;
};

/** Status yang diisi panitia. "Gugur" dan "Juara" dihitung dari hasil fight (lib/fight.ts). */
export type FighterFlag = "active" | "injured" | "suspended" | "retired";

export type Fighter = {
  id: string;
  name: string;
  group_name: string | null;
  photo_url: string | null;
  fighting_style?: string | null;
  status?: FighterFlag;
  // kolom di bawah cuma kebaca oleh admin
  paid?: boolean;
  fee?: number;
  notes?: string | null;
  created_at?: string;
};

export type MatchStatus = "upcoming" | "live" | "completed" | "postponed" | "cancelled";
export type ResultMethod = "KO" | "TKO" | "SURRENDER" | "DECISION" | "DQ" | "WO";
export type MatchKind = "main" | "third" | "extra";

export type Match = {
  id: string;
  kind: MatchKind;
  round: number;
  slot: number;
  match_no: number;
  fighter1_id: string | null;
  fighter2_id: string | null;
  winner_id: string | null;
  featured: boolean;
  house_cut: number;
  // kolom schema baru (undefined di database lama)
  tournament_id?: string | null;
  status?: MatchStatus;
  result_method?: ResultMethod | null;
  duration_sec?: number | null;
  completed_at?: string | null;
  betting_closed?: boolean;
};

export type Tournament = {
  id: string;
  name: string;
  status: "ongoing" | "completed" | "archived";
  current_stage: string;
  champion_id: string | null;
  runner_up_id: string | null;
  third_id: string | null;
  champion_name: string | null;
  runner_up_name: string | null;
  third_name: string | null;
  created_at: string;
  completed_at: string | null;
};

/** Baris tabel fight_history: catatan resmi satu fight yang selesai. */
export type HistoryRow = {
  id: string;
  match_id: string | null;
  tournament_id: string | null;
  tournament_name: string | null;
  match_no: number;
  stage: string;
  fighter_a_id: string | null;
  fighter_b_id: string | null;
  winner_id: string | null;
  winner_side: 1 | 2;
  fighter_a_name: string;
  fighter_b_name: string;
  winner_name: string;
  result_method: ResultMethod | null;
  duration_sec: number | null;
  completed_at: string | null; // null = tanggal gak dicatat (Vol. 1)
};

export type Bet = {
  id: string;
  match_id: string;
  bettor_name: string;
  bettor_account: string | null; // rekening / Yentag
  fighter_id: string;
  amount: number;
  paid_out: boolean;
  created_at: string;
  recorded_by?: string | null;
  paid_out_at?: string | null;
};

export type BetLog = {
  id: number;
  bet_id: string | null;
  match_id: string | null;
  action: "placed" | "edited" | "paid" | "unpaid" | "voided";
  bettor_name: string;
  fighter_id: string | null;
  fighter_name: string | null;
  amount: number;
  actor: string | null;
  actor_name: string | null;
  created_at: string;
};

/** Hasil bet_slip(kode): satu slip taruhan, dicek bettor-nya sendiri. */
export type BetSlip = {
  code: string;
  match_id: string;
  fighter_id: string;
  bettor_name: string;
  amount: number;
  created_at: string;
  paid_out: boolean;
};

export type Pool = { match_id: string; pool1: number; pool2: number; bet_count: number; bettors?: number };
