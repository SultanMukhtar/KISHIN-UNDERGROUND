/**
 * Hadiah juara turnamen yang lagi jalan:
 * - Sumbernya uang pendaftaran (fighter yang udah bayar di vol ini) + uang sponsor vol ini.
 * - Dipotong dulu 30% buat kas panitia, sisanya jadi total hadiah.
 * - Total hadiah dibagi: juara 1 = 50%, juara 2 = 30%, juara 3 = 20%.
 * - Pecahan Yen dibulatkan ke bawah, sisa pembulatannya ikut ke kas panitia.
 * Hitungannya pakai bilangan bulat (persen), biar gak ada selisih ¥1 gara-gara pembulatan desimal.
 */
export const PRIZE_CUT_PCT = 30;
export const PRIZE_SPLIT_PCT = [50, 30, 20] as const;

/** Total mentah dari database (view prize_pool) atau dihitung di panel panitia. */
export type PrizePool = { registration: number; sponsors: number };

export type Prize = PrizePool & {
  /** pendaftaran + sponsor */
  gross: number;
  /** potongan kas panitia, termasuk sisa pembulatan */
  cut: number;
  /** total hadiah = juara 1 + juara 2 + juara 3 */
  total: number;
  places: [number, number, number];
};

export function prizeOf({ registration, sponsors }: PrizePool): Prize {
  const gross = Math.max(0, registration) + Math.max(0, sponsors);
  const keep = 100 - PRIZE_CUT_PCT;
  const places = PRIZE_SPLIT_PCT.map((s) => Math.floor((gross * keep * s) / 10000)) as [number, number, number];
  const total = places[0] + places[1] + places[2];
  return { registration, sponsors, gross, cut: gross - total, total, places };
}
