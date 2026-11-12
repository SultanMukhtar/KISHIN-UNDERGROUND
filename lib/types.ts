export type Settings = {
  id: number;
  event_name: string;
  tagline: string;
  hero_url: string | null;
  registration_fee: number;
  default_house_cut: number;
};

export type Fighter = {
  id: string;
  name: string;
  group_name: string | null;
  photo_url: string | null;
  // kolom di bawah cuma kebaca oleh admin
  paid?: boolean;
  fee?: number;
  notes?: string | null;
  created_at?: string;
};

export type Match = {
  id: string;
  kind: "main" | "third";
  round: number;
  slot: number;
  match_no: number;
  fighter1_id: string | null;
  fighter2_id: string | null;
  winner_id: string | null;
  featured: boolean;
  house_cut: number;
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
};

export type Pool = { match_id: string; pool1: number; pool2: number; bet_count: number };
