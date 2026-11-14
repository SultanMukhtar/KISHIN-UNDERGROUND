"use client";
import { useEffect } from "react";
import { useUi } from "@/components/site/Ui";
import type { MatchEvent } from "@/components/site/useMatchEvents";
import { roundLabel } from "@/lib/bracket";
import { METHOD_SHORT, matchCode } from "@/lib/fight";
import type { Fighter, Match } from "@/lib/types";

type Props = { events: MatchEvent[]; matches: Match[]; byId: Map<string, Fighter>; total: number; onDismiss: (key: string) => void };

const SHOW_MS = 6500;

/**
 * Pengumuman singkat waktu data beneran berubah: fight mulai, atau hasil resmi masuk.
 * Satu per satu, hilang sendiri, bisa diklik buat buka detail fight-nya.
 */
export default function EventBanner({ events, matches, byId, total, onDismiss }: Props) {
  const ui = useUi();
  const ev = events[0];

  useEffect(() => {
    if (!ev) return;
    const t = setTimeout(() => onDismiss(ev.key), SHOW_MS);
    return () => clearTimeout(t);
  }, [ev, onDismiss]);

  if (!ev) return null;
  const m = matches.find((x) => x.id === ev.matchId);
  if (!m) return null;
  const name = (id: string | null) => (id ? byId.get(id)?.name : undefined) ?? "?";
  const result = ev.kind === "result";
  const loserId = m.winner_id === m.fighter1_id ? m.fighter2_id : m.fighter1_id;

  return (
    <div className={`event is-${ev.kind}`} key={ev.key} role="status" aria-live="polite">
      <button type="button" className="event-main" onClick={() => { ui.openMatch(m.id); onDismiss(ev.key); }}>
        <span className="event-tag">
          {!result && <span className="live-dot" aria-hidden="true" />}
          {result ? "Hasil resmi" : "Fight mulai"}
        </span>
        <span className="event-text">
          {result ? (
            <>
              <b>{name(m.winner_id)}</b> ngalahin {name(loserId)}
              {m.result_method ? `, ${METHOD_SHORT[m.result_method]}` : ""}
            </>
          ) : (
            <>
              <b>{name(m.fighter1_id)}</b> lawan <b>{name(m.fighter2_id)}</b>
            </>
          )}
        </span>
        <span className="event-meta">{roundLabel(m.round, total, m.kind)}, fight {matchCode(m.match_no)}</span>
        {result && <span className="event-stamp" aria-hidden="true">Win</span>}
      </button>
      <button type="button" className="event-x" onClick={() => onDismiss(ev.key)} aria-label="Tutup pengumuman">
        <span aria-hidden="true" />
      </button>
    </div>
  );
}
