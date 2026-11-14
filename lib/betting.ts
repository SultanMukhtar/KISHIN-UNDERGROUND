/**
 * Sistem taruhan (mata uang RP, bukan uang asli):
 * - Yang menang: modal balik utuh + bagian dari uang pihak yang kalah (proporsional ke besar taruhan).
 * - House cut cuma dipotong dari uang pihak yang kalah. Uang pemenang gak pernah dipotong.
 * - Kalau gak ada yang taruh ke pihak yang menang, seluruh uang pihak kalah masuk kas panitia.
 * - Fight dibatalkan → semua taruhan dikembalikan utuh.
 */
import type { Bet, Match, Pool } from "./types";

/** Kelipatan hasil kalau sisi ini menang (misal 1.25 = taruh ¥10.000 dapat ¥12.500). */
export function multiplier(ownPool: number, otherPool: number, houseCut: number): number | null {
  if (ownPool <= 0) return null;
  return 1 + (otherPool * (1 - houseCut)) / ownPool;
}

export function payout(amount: number, winnerPool: number, loserPool: number, houseCut: number): number {
  if (winnerPool <= 0) return 0;
  return Math.floor(amount + (amount / winnerPool) * loserPool * (1 - houseCut));
}

/** Keuntungan kas panitia dari satu match yang sudah selesai. */
export function houseProfit(winnerPool: number, loserPool: number, houseCut: number): number {
  if (winnerPool <= 0) return loserPool;
  return Math.ceil(loserPool * houseCut);
}

export const yen = (n: number) => "¥" + Math.round(n).toLocaleString("id-ID");

/** Batas nominal satu taruhan (sama dengan guard_bet() di schema.sql). */
export const MAX_BET = 100_000_000;

/** Kode slip yang dikasih ke bettor, misal TX-7F3A9C21. Dipakai buat ngecek taruhan sendiri. */
export const slipCode = (betId: string) => "TX-" + betId.replace(/-/g, "").slice(0, 8).toUpperCase();

export type BetOutcome = { status: "Menang" | "Kalah" | "Menunggu" | "Batal"; payout: number };

const cancelled = (m: Match) => !m.winner_id && m.status === "cancelled";

/** Nasib satu taruhan, dihitung dari total pool per sisi. Dipakai panel panitia DAN cek slip penonton. */
export function betOutcome(m: Match, pool1: number, pool2: number, bet: Pick<Bet, "fighter_id" | "amount">): BetOutcome {
  if (cancelled(m)) return { status: "Batal", payout: bet.amount };
  if (!m.winner_id) return { status: "Menunggu", payout: 0 };
  if (bet.fighter_id !== m.fighter1_id && bet.fighter_id !== m.fighter2_id) {
    return { status: "Batal", payout: bet.amount }; // fighter-nya udah gak di match ini, refund
  }
  if (bet.fighter_id !== m.winner_id) return { status: "Kalah", payout: 0 };
  const winPool = m.winner_id === m.fighter1_id ? pool1 : pool2;
  const losePool = m.winner_id === m.fighter1_id ? pool2 : pool1;
  return { status: "Menang", payout: payout(bet.amount, winPool, losePool, m.house_cut) };
}

export type MatchSettlement = {
  m: Match;
  bets: Bet[];
  pool1: number;
  pool2: number;
  results: Map<string, BetOutcome>;
  /** untung kas dari match ini, termasuk sisa pembulatan */
  house: number;
  paidOutTotal: number;
};

/** Hitung semua taruhan di satu match. */
export function settleMatch(m: Match, bets: Bet[]): MatchSettlement {
  const pool1 = bets.filter((b) => b.fighter_id === m.fighter1_id).reduce((s, b) => s + b.amount, 0);
  const pool2 = bets.filter((b) => b.fighter_id === m.fighter2_id).reduce((s, b) => s + b.amount, 0);
  const results: MatchSettlement["results"] = new Map();
  let paidOutTotal = 0;
  for (const b of bets) {
    const r = betOutcome(m, pool1, pool2, b);
    results.set(b.id, r);
    paidOutTotal += r.payout;
  }
  const totalIn = bets.reduce((s, b) => s + b.amount, 0);
  const house = m.winner_id ? totalIn - paidOutTotal : 0;
  return { m, bets, pool1, pool2, results, house, paidOutTotal: m.winner_id || cancelled(m) ? paidOutTotal : 0 };
}

export const poolSum = (p?: Pool) => (p ? p.pool1 + p.pool2 : 0);

/** "12.500" / "12500" / "¥12.500" → 12500. Gak valid → null. */
export function parseAmount(raw: string): number | null {
  const t = raw.trim().replace(/^¥\s*/, "");
  // angka polos, atau pakai titik pemisah ribuan. Koma, minus, dan desimal ditolak.
  if (!/^(\d+|\d{1,3}(\.\d{3})+)$/.test(t)) return null;
  const n = parseInt(t.replace(/\./g, ""), 10);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
