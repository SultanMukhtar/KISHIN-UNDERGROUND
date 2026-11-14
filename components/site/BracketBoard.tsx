"use client";
import { Fragment, useMemo, useState } from "react";
import Mugshot from "@/components/ui/Mugshot";
import Reveal from "@/components/ui/Reveal";
import { StatusChip } from "@/components/ui/Chips";
import { useUi } from "@/components/site/Ui";
import { fighterCode } from "@/lib/codes";
import { roundLabel, totalRounds } from "@/lib/bracket";
import { isBye, isReady, matchCode, statusOf, waitingFor } from "@/lib/fight";
import type { Fighter, Match } from "@/lib/types";

type Props = {
  matches: Match[];
  byId: Map<string, Fighter>;
  loading: boolean;
  /** match yang hasil resminya baru aja masuk (buat animasi garis & baris pemenang) */
  fresh: Set<string>;
  /** slot "matchId:1|2" yang baru aja keisi pemenang dari ronde sebelumnya */
  arrived: Set<string>;
};

export default function BracketBoard({ matches, byId, loading, fresh, arrived }: Props) {
  const ui = useUi();
  const total = totalRounds(matches);
  const [pick, setPick] = useState<number | null>(null); // filter ronde, cuma kepakai di layar sempit
  const [q, setQ] = useState("");

  const rounds = useMemo(() => {
    const out: Match[][] = [];
    for (let r = 1; r <= total; r++) out.push(matches.filter((m) => m.kind === "main" && m.round === r).sort((a, b) => a.slot - b.slot));
    return out;
  }, [matches, total]);
  const third = matches.find((m) => m.kind === "third");
  const extras = matches.filter((m) => m.kind === "extra");

  const query = q.trim().toLowerCase();
  const found = useMemo(
    () => (query ? [...byId.values()].filter((f) => f.name.toLowerCase().includes(query) || fighterCode(f.id).toLowerCase().includes(query)).slice(0, 12) : []),
    [query, byId],
  );
  const foundIds = useMemo(() => new Set(found.map((f) => f.id)), [found]);
  const inBracket = (id: string) => matches.some((m) => m.fighter1_id === id || m.fighter2_id === id);

  const feeders = (m: Match) => waitingFor(m, matches);

  /** Ke mana pemenang match ini pergi. Di layar lebar digambar pakai garis, di HP ditulis. */
  const onward = (m: Match): string | null => {
    if (m.kind !== "main") return null;
    if (m.round === total) return "Pemenangnya jadi juara";
    const next = matches.find((x) => x.kind === "main" && x.round === m.round + 1 && x.slot === Math.floor(m.slot / 2));
    if (!next) return null;
    const toThird = m.round === total - 1 && third ? `, yang kalah ke fight ${matchCode(third.match_no)}` : "";
    return `Pemenang maju ke fight ${matchCode(next.match_no)}${toThird}`;
  };

  if (loading) return <p className="empty-note is-loading" role="status">Ngambil data bracket…</p>;
  if (!matches.length) {
    return <p className="empty-note">Bracket belum dibuat. Panitia masih ngumpulin fighter, pantau terus halaman ini.</p>;
  }

  const node = (m: Match, label?: string) => {
    const st = statusOf(m);
    const bye = isBye(m);
    const waiting = !isReady(m) && !bye;
    const hit = query ? [m.fighter1_id, m.fighter2_id].some((id) => id && foundIds.has(id)) : false;
    const cls = [
      "bk-node",
      `is-${st}`,
      bye && "is-bye",
      waiting && "is-waiting",
      m.featured && st !== "completed" && "is-called",
      fresh.has(m.id) && "is-fresh",
      query && (hit ? "is-hit" : "is-dim"),
    ].filter(Boolean).join(" ");

    const row = (fid: string | null, slot: 1 | 2) => {
      const f = fid ? byId.get(fid) : undefined;
      const win = !!m.winner_id && !bye && fid === m.winner_id;
      const lose = !!m.winner_id && !!fid && fid !== m.winner_id;
      return (
        <span
          key={(fid ?? "slot") + slot}
          className={
            "bk-row" + (win ? " is-win" : "") + (lose ? " is-lose" : "") + (!f ? " is-empty" : "") +
            (arrived.has(`${m.id}:${slot}`) ? " is-arrived" : "") + (f && foundIds.has(f.id) ? " is-found" : "")
          }
        >
          {f ? <Mugshot name={f.name} url={f.photo_url} size="sm" /> : <span className="mug mug-sm mug-slot" aria-hidden="true" />}
          <span className="bk-who">
            <span className="bk-name">{f?.name ?? (bye && slot === 2 ? "Bye" : "Belum ada")}</span>
            {f && <span className="bk-code">{fighterCode(f.id)}</span>}
          </span>
          {win && <span className="mark mark-win">Win</span>}
        </span>
      );
    };

    const names = [m.fighter1_id, m.fighter2_id].map((id) => (id ? byId.get(id)?.name : null) ?? "belum ada").join(" lawan ");
    const next = onward(m);
    return (
      <button type="button" className={cls} onClick={() => ui.openMatch(m.id)} aria-label={`Fight ${matchCode(m.match_no)}, ${names}. Buka detail.`}>
        <span className="bk-top">
          <b className="bk-no">{matchCode(m.match_no)}</b>
          {label && <span className="bk-label">{label}</span>}
          {bye ? <span className="chip chip-bye">Lolos otomatis</span> : waiting ? <span className="chip chip-waiting">Menunggu</span> : <StatusChip status={st} />}
        </span>
        <span className="bk-rows">
          {row(m.fighter1_id, 1)}
          {row(m.fighter2_id, 2)}
        </span>
        {waiting && <span className="bk-wait">{feeders(m)}</span>}
        {next && <span className="bk-next">{next}</span>}
      </button>
    );
  };

  const count = (items: Match[]) => {
    const real = items.filter((m) => !isBye(m));
    return { real: real.length, done: real.filter((m) => m.winner_id).length };
  };

  return (
    <div className="bk">
      <div className="board-controls">
        <div className="rounds" role="group" aria-label="Pilih ronde">
          <button type="button" className={"round-tab" + (pick === null ? " is-on" : "")} aria-pressed={pick === null} onClick={() => setPick(null)}>
            <span className="rt-name">Semua</span>
            <span className="rt-count">{total} ronde</span>
          </button>
          {rounds.map((items, i) => {
            const c = count(items);
            return (
              <button
                key={i}
                type="button"
                aria-pressed={pick === i}
                className={"round-tab" + (pick === i ? " is-on" : "") + (c.real && c.done === c.real ? " is-done" : "")}
                onClick={() => setPick(i)}
              >
                <span className="rt-name">{roundLabel(i + 1, total)}</span>
                <span className="rt-count">{c.real ? `${c.done}/${c.real} selesai` : "Belum ada"}</span>
              </button>
            );
          })}
        </div>
        <label className="board-search">
          <span className="sr-only">Cari fighter</span>
          <input type="search" placeholder="Cari nama atau ID fighter" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>

      {query && (
        <div className="bk-found" role="status">
          {found.length ? (
            <>
              <span className="bk-found-label">{found.length} fighter cocok</span>
              {found.map((f) => (
                <button key={f.id} type="button" className="fighter-pill" onClick={() => ui.openFighter(f.id)}>
                  <Mugshot name={f.name} url={f.photo_url} size="xs" />
                  <span>{f.name}</span>
                  {!inBracket(f.id) && <small>belum masuk bracket</small>}
                </button>
              ))}
            </>
          ) : (
            <span className="bk-found-label">Gak ada fighter bernama &quot;{q.trim()}&quot;.</span>
          )}
        </div>
      )}

      <div className="bk-scroll">
        <Reveal as="ol" kind="none" className="bk-tree" data-pick={pick ?? undefined} style={{ "--cols": total } as React.CSSProperties}>
          {rounds.map((items, i) => {
            const c = count(items);
            const last = i === rounds.length - 1;
            return (
              <Fragment key={i}>
                <li className={"bk-round" + (pick === i ? " is-picked" : "")} style={{ "--r": i } as React.CSSProperties}>
                  <h3 className="bk-round-title">
                    <span>{roundLabel(i + 1, total)}</span>
                    <small>{c.real ? `${c.done}/${c.real} selesai` : "Belum ada"}</small>
                  </h3>
                  <ol className="bk-col">
                    {items.map((m) => {
                      const fed = i > 0 && rounds[i - 1].some((x) => Math.floor(x.slot / 2) === m.slot && x.winner_id);
                      return (
                        <li
                          key={m.id}
                          className={
                            "bk-cell" + (m.slot % 2 ? " is-odd" : " is-even") + (last ? "" : " has-out") + (i > 0 ? " has-in" : "") +
                            (m.winner_id ? " is-done" : "") + (fed ? " is-fed" : "") + (fresh.has(m.id) ? " is-fresh" : "")
                          }
                        >
                          {node(m)}
                        </li>
                      );
                    })}
                  </ol>
                </li>
                {!last && <li className="bk-rail" aria-hidden="true">Pemenang naik ke {roundLabel(i + 2, total)}</li>}
              </Fragment>
            );
          })}
        </Reveal>
      </div>

      {(third || extras.length > 0) && (
        <div className="bk-side">
          {third && (
            <Reveal className="bk-side-block" kind="up">
              <h3 className="bk-round-title"><span>Perebutan juara 3</span><small>Dua yang kalah di semifinal</small></h3>
              {node(third)}
            </Reveal>
          )}
          {extras.length > 0 && (
            <Reveal className="bk-side-block is-wide" kind="up" delay={80}>
              <h3 className="bk-round-title"><span>Laga tambahan</span><small>Di luar bracket</small></h3>
              <div className="bk-extras">{extras.map((m) => <Fragment key={m.id}>{node(m)}</Fragment>)}</div>
            </Reveal>
          )}
        </div>
      )}
    </div>
  );
}
