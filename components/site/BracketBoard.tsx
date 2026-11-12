"use client";
import { useMemo, useState } from "react";
import Mugshot from "@/components/ui/Mugshot";
import { fighterCode, pad2 } from "@/lib/codes";
import { roundLabel, totalRounds } from "@/lib/bracket";
import type { Fighter, Match } from "@/lib/types";

type Group = { key: string; label: string; items: Match[] };

export default function BracketBoard({ matches, byId }: { matches: Match[]; byId: Map<string, Fighter> }) {
  const total = totalRounds(matches);
  const [picked, setPicked] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const groups = useMemo(() => {
    const out: Group[] = [];
    for (const m of matches) {
      const key = `${m.kind}-${m.round}`;
      let g = out.find((x) => x.key === key);
      if (!g) out.push((g = { key, label: roundLabel(m.round, total, m.kind), items: [] }));
      g.items.push(m);
    }
    return out;
  }, [matches, total]);

  // ronde aktif default: ronde pertama yang masih ada fight siap tanding
  const auto = groups.find((g) => g.items.some((m) => !m.winner_id && m.fighter1_id && m.fighter2_id))?.key ?? groups[groups.length - 1]?.key;
  const activeKey = picked ?? auto;
  const active = groups.find((g) => g.key === activeKey);
  const labelOf = (m: Match) => roundLabel(m.round, total, m.kind);

  const query = q.trim().toLowerCase();
  const results = query
    ? matches.filter((m) => [m.fighter1_id, m.fighter2_id].some((id) => id && byId.get(id)?.name.toLowerCase().includes(query)))
    : null;

  /** Fight mana aja yang ngisi slot match ini (buat teks "nunggu pemenang ..."). */
  const feeders = (m: Match): string => {
    if (m.kind === "third") {
      const semis = matches.filter((x) => x.kind === "main" && x.round === total - 1).map((x) => pad2(x.match_no));
      return semis.length ? `Nunggu yang kalah di fight ${semis.join(" & ")}` : "Nunggu semifinal";
    }
    const prev = matches.filter((x) => x.kind === "main" && x.round === m.round - 1 && Math.floor(x.slot / 2) === m.slot);
    return prev.length ? `Nunggu pemenang fight ${prev.map((x) => pad2(x.match_no)).join(" & ")}` : "Nunggu lawan";
  };

  if (!matches.length) {
    return <p className="empty-note">Bracket belum dibuat. Panitia masih ngumpulin fighter, pantau terus halaman ini.</p>;
  }

  const list = results ?? active?.items ?? [];

  return (
    <div className="board">
      <div className="board-controls">
        <div className="rounds" aria-label="Pilih ronde">
          {groups.map((g) => {
            const real = g.items.filter((m) => !(m.kind === "main" && m.round === 1 && m.fighter1_id && !m.fighter2_id));
            const done = real.filter((m) => m.winner_id).length;
            const on = !results && g.key === activeKey;
            return (
              <button
                key={g.key}
                aria-pressed={on}
                className={"round-tab" + (on ? " is-on" : "") + (real.length && done === real.length ? " is-done" : "")}
                onClick={() => { setPicked(g.key); setQ(""); }}
              >
                <span className="rt-name">{g.label}</span>
                <span className="rt-count">{real.length ? `${done}/${real.length} selesai` : "Belum ada"}</span>
              </button>
            );
          })}
        </div>
        <label className="board-search">
          <span className="sr-only">Cari fighter</span>
          <input type="search" placeholder="Cari nama fighter" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>

      {results && (
        <p className="board-note" role="status">
          {results.length ? `${results.length} fight buat "${q.trim()}"` : `Gak ada fighter bernama "${q.trim()}" di bracket.`}
        </p>
      )}

      <div className="tags">
        {list.map((m) => (
          <FightTag key={m.id} m={m} byId={byId} label={results ? labelOf(m) : undefined} waiting={feeders(m)} />
        ))}
      </div>
    </div>
  );
}

function FightTag({ m, byId, label, waiting }: { m: Match; byId: Map<string, Fighter>; label?: string; waiting: string }) {
  const isBye = m.kind === "main" && m.round === 1 && !!m.fighter1_id && !m.fighter2_id;
  const empty = !m.fighter1_id && !m.fighter2_id;
  const state = m.winner_id && !isBye ? "is-done" : m.fighter1_id && m.fighter2_id ? "is-ready" : "is-waiting";

  const row = (fid: string | null, slot: number) => {
    const f = fid ? byId.get(fid) : undefined;
    const win = !!m.winner_id && !isBye && fid === m.winner_id;
    const lose = !!m.winner_id && !!fid && fid !== m.winner_id;
    return (
      <li className={"tag-row" + (win ? " is-win" : "") + (lose ? " is-lose" : "") + (!f ? " is-empty" : "")}>
        {f ? <Mugshot name={f.name} url={f.photo_url} size="sm" /> : <span className="mug mug-sm mug-slot" aria-hidden="true" />}
        <span className="tag-who">
          <span className="tag-name">{f?.name ?? (isBye && slot === 2 ? "Bye" : "–")}</span>
          {f && <span className="tag-code">{fighterCode(f.id)}</span>}
        </span>
        {win && <span className="tag-win">Menang</span>}
      </li>
    );
  };

  return (
    <article className={`tag ${state}${m.featured ? " is-featured" : ""}`}>
      <div className="tag-no" aria-label={`Fight ${m.match_no}`}>
        <b>{pad2(m.match_no)}</b>
      </div>
      <div className="tag-body">
        {(label || m.featured || isBye) && (
          <p className="tag-meta">
            {label && <span>{label}</span>}
            {m.featured && <span className="tag-live">Lagi di ring</span>}
            {isBye && <span>Lolos otomatis</span>}
          </p>
        )}
        {empty ? (
          <p className="tag-wait">{waiting}</p>
        ) : (
          <ul className="tag-rows">
            {row(m.fighter1_id, 1)}
            {row(m.fighter2_id, 2)}
          </ul>
        )}
        {!empty && state === "is-waiting" && !isBye && <p className="tag-wait small">{waiting}</p>}
      </div>
    </article>
  );
}
