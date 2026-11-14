import type { Match } from "./types";

export type NewMatch = Omit<Match, "id">;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function totalRounds(matches: Pick<Match, "kind" | "round">[]): number {
  return matches.filter((m) => m.kind === "main").reduce((max, m) => Math.max(max, m.round), 0);
}

/** Kunci babak yang stabil (sama persis dengan stage_key() di schema.sql). */
export function stageKey(round: number, total: number, kind: Match["kind"] = "main"): string {
  if (kind === "third") return "third";
  if (kind === "extra") return "extra";
  if (round === total) return "final";
  if (round === total - 1) return "semifinal";
  if (round === total - 2) return "quarterfinal";
  return `round-${round}`;
}

export function stageLabel(key: string | null | undefined): string {
  switch (key) {
    case "final": return "Final";
    case "third": return "Perebutan Juara 3";
    case "semifinal": return "Semifinal";
    case "quarterfinal": return "Perempat Final";
    case "extra": return "Laga Tambahan";
    case "registration": return "Pendaftaran";
    case "completed": return "Selesai";
    default: return key && key.startsWith("round-") ? `Ronde ${key.slice(6)}` : "–";
  }
}

/** Urutan babak buat pilihan filter: ronde awal dulu, final paling akhir. */
export function stageOrder(key: string): number {
  if (key.startsWith("round-")) return parseInt(key.slice(6), 10) || 0;
  return { quarterfinal: 100, semifinal: 101, third: 102, final: 103, extra: 104 }[key] ?? 105;
}

export function roundLabel(round: number, total: number, kind: Match["kind"] = "main"): string {
  return stageLabel(stageKey(round, total, kind));
}

/**
 * Bikin seluruh bracket single elimination dari daftar fighter.
 * - Fighter diacak.
 * - Kalau jumlahnya bukan 2,4,8,16,32,64, sebagian fighter dapat BYE (langsung lolos ronde 1), disebar merata.
 * - Ada match Perebutan Juara 3 kalau peserta >= 4.
 */
export function generateBracket(fighterIds: string[], houseCut: number, tournamentId?: string | null): NewMatch[] {
  if (fighterIds.length < 2) throw new Error("Minimal 2 fighter yang sudah bayar buat bikin bracket.");
  const ids = shuffle(fighterIds);
  let size = 2;
  while (size < ids.length) size *= 2;
  const rounds = Math.log2(size);
  const firstRoundMatches = size / 2;
  const byes = size - ids.length;

  const byeSlots = new Set<number>();
  for (let i = 0; i < byes; i++) byeSlots.add(Math.floor((i * firstRoundMatches) / byes));

  const matches: NewMatch[] = [];
  const base = {
    winner_id: null, featured: false, house_cut: houseCut,
    ...(tournamentId ? { tournament_id: tournamentId } : {}), // database lama belum punya kolom ini
  };
  let idx = 0;

  for (let s = 0; s < firstRoundMatches; s++) {
    const f1 = ids[idx++];
    const f2 = byeSlots.has(s) ? null : ids[idx++];
    matches.push({ ...base, kind: "main", round: 1, slot: s, match_no: 0, fighter1_id: f1, fighter2_id: f2 });
  }
  for (let r = 2; r <= rounds; r++) {
    const count = size / 2 ** r;
    for (let s = 0; s < count; s++) {
      matches.push({ ...base, kind: "main", round: r, slot: s, match_no: 0, fighter1_id: null, fighter2_id: null });
    }
  }
  if (rounds >= 2) {
    matches.push({ ...base, kind: "third", round: rounds, slot: 0, match_no: 0, fighter1_id: null, fighter2_id: null });
  }

  // fighter yang dapat BYE langsung maju ke ronde 2
  for (const m of matches.filter((x) => x.round === 1 && x.kind === "main" && x.fighter2_id === null)) {
    m.winner_id = m.fighter1_id;
    if (rounds >= 2) {
      const next = matches.find((x) => x.kind === "main" && x.round === 2 && x.slot === Math.floor(m.slot / 2))!;
      if (m.slot % 2 === 0) next.fighter1_id = m.winner_id;
      else next.fighter2_id = m.winner_id;
    }
  }

  // nomor match berurutan: per ronde, perebutan juara 3 sebelum final
  const ordered = [...matches].sort((a, b) => {
    const ka = a.kind === "third" ? a.round - 0.5 : a.round;
    const kb = b.kind === "third" ? b.round - 0.5 : b.round;
    return ka - kb || a.slot - b.slot;
  });
  ordered.forEach((m, i) => (m.match_no = i + 1));
  return ordered;
}

export type MatchPatch = { id: string; changes: Partial<Match> };

/**
 * Hitung perubahan yang harus disimpan saat pemenang sebuah match diisi/diganti/dihapus:
 * pemenang maju ke match ronde berikutnya, yang kalah di semifinal masuk Perebutan Juara 3.
 */
export function winnerPatches(
  all: Match[],
  match: Match,
  winnerId: string | null,
  result?: Pick<Match, "result_method" | "duration_sec">,
): MatchPatch[] {
  const patches: MatchPatch[] = [{ id: match.id, changes: { winner_id: winnerId, ...(winnerId && result ? result : {}) } }];
  if (match.kind !== "main") return patches;
  const total = totalRounds(all);
  const field = match.slot % 2 === 0 ? "fighter1_id" : "fighter2_id";

  const pushInto = (target: Match | undefined, value: string | null) => {
    if (!target) return;
    const changes: Partial<Match> = { [field]: value };
    const otherField = field === "fighter1_id" ? "fighter2_id" : "fighter1_id";
    // kalau pemenang match tujuan sudah bukan salah satu fighter-nya lagi, reset
    if (target.winner_id && target.winner_id !== value && target.winner_id !== target[otherField]) {
      changes.winner_id = null;
    }
    patches.push({ id: target.id, changes });
  };

  if (match.round < total) {
    const next = all.find((m) => m.kind === "main" && m.round === match.round + 1 && m.slot === Math.floor(match.slot / 2));
    pushInto(next, winnerId);
  }
  if (match.round === total - 1) {
    const third = all.find((m) => m.kind === "third");
    const loser = winnerId === null ? null : winnerId === match.fighter1_id ? match.fighter2_id : match.fighter1_id;
    pushInto(third, loser);
  }
  return patches;
}

export function podium(all: Match[]) {
  const total = totalRounds(all);
  const final = all.find((m) => m.kind === "main" && m.round === total);
  const third = all.find((m) => m.kind === "third");
  const first = final?.winner_id ?? null;
  const second = first ? (first === final!.fighter1_id ? final!.fighter2_id : final!.fighter1_id) : null;
  return { first, second, third: third?.winner_id ?? null };
}
