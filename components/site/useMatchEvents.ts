"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { isReady, statusOf } from "@/lib/fight";
import type { Match, MatchStatus } from "@/lib/types";

export type MatchEvent = { key: string; kind: "start" | "result"; matchId: string };

type Snap = { st: MatchStatus; w: string | null; f1: string | null; f2: string | null };

/**
 * Bandingin data match yang baru masuk sama yang sebelumnya, terus laporin apa yang BENERAN berubah:
 * fight mulai, hasil resmi masuk, slot bracket keisi. Animasi "fight mulai" dan "hasil masuk"
 * cuma dipicu dari sini, gak pernah jalan tanpa perubahan data.
 */
export function useMatchEvents(matches: Match[], loaded: boolean) {
  const prev = useRef<Map<string, Snap> | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  const [arrived, setArrived] = useState<Set<string>>(() => new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!loaded) return;
    const snap = new Map<string, Snap>(
      matches.map((m) => [m.id, { st: statusOf(m), w: m.winner_id, f1: m.fighter1_id, f2: m.fighter2_id }]),
    );
    const before = prev.current;
    prev.current = snap;
    if (!before) return; // data pertama: gak ada yang "berubah"

    const evs: MatchEvent[] = [];
    const fr = new Set<string>();
    const ar = new Set<string>();
    for (const m of matches) {
      const b = before.get(m.id);
      const s = snap.get(m.id)!;
      if (!b) continue; // match baru (bracket baru dibuat)
      if (s.w && s.w !== b.w && isReady(m)) {
        evs.push({ key: `${m.id}:result:${s.w}`, kind: "result", matchId: m.id });
        fr.add(m.id);
      } else if (s.st === "live" && b.st !== "live") {
        evs.push({ key: `${m.id}:start:${Date.now()}`, kind: "start", matchId: m.id });
      }
      if (s.f1 && s.f1 !== b.f1) ar.add(`${m.id}:1`);
      if (s.f2 && s.f2 !== b.f2) ar.add(`${m.id}:2`);
    }
    if (evs.length) setEvents((q) => [...q, ...evs].slice(-4));
    if (fr.size || ar.size) {
      setFresh(fr);
      setArrived(ar);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setFresh(new Set());
        setArrived(new Set());
      }, 5000);
    }
  }, [matches, loaded]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const dismiss = useCallback((key: string) => setEvents((q) => q.filter((e) => e.key !== key)), []);
  return { events, fresh, arrived, dismiss };
}
