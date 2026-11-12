/**
 * Sistem taruhan 1C:
 * - Yang menang: modal balik utuh + bagian dari uang pihak yang kalah (proporsional ke besar taruhan).
 * - House cut cuma dipotong dari uang pihak yang kalah. Uang pemenang gak pernah dipotong.
 * - Kalau gak ada yang taruh ke pihak yang menang, seluruh uang pihak kalah masuk kas 1C.
 */

/** Kelipatan hasil kalau sisi ini menang (misal 1.25 = taruh ¥10.000 dapat ¥12.500). */
export function multiplier(ownPool: number, otherPool: number, houseCut: number): number | null {
  if (ownPool <= 0) return null;
  return 1 + (otherPool * (1 - houseCut)) / ownPool;
}

export function payout(amount: number, winnerPool: number, loserPool: number, houseCut: number): number {
  if (winnerPool <= 0) return 0;
  return Math.floor(amount + (amount / winnerPool) * loserPool * (1 - houseCut));
}

/** Keuntungan kas 1C dari satu match yang sudah selesai. */
export function houseProfit(winnerPool: number, loserPool: number, houseCut: number): number {
  if (winnerPool <= 0) return loserPool;
  return Math.ceil(loserPool * houseCut);
}

export const yen = (n: number) => "¥" + Math.round(n).toLocaleString("id-ID");
