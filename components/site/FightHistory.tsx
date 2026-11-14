"use client";
import { useMemo, useState } from "react";
import Reveal from "@/components/ui/Reveal";
import { useUi } from "@/components/site/Ui";
import { stageLabel, stageOrder } from "@/lib/bracket";
import { METHODS, METHOD_SHORT, fmtClock, fmtDate, fmtTime, loserOf, matchCode, winnerOf, type FightRecord } from "@/lib/fight";
import type { ResultMethod } from "@/lib/types";

type Props = { records: FightRecord[]; loading: boolean; currentTournamentId: string | null };

const PAGE = 10;

/**
 * FIGHT HISTORY: arsip semua fight yang udah selesai, terbaru di atas, dikelompokkan per tanggal.
 * Bisa dicari, dan disaring per babak, fighter, cara menang, dan turnamen.
 */
export default function FightHistory({ records, loading, currentTournamentId }: Props) {
  const ui = useUi();
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("");
  const [fighter, setFighter] = useState("");
  const [method, setMethod] = useState("");
  const [tour, setTour] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const stages = useMemo(() => [...new Set(records.map((r) => r.stage))].sort((a, b) => stageOrder(a) - stageOrder(b)), [records]);
  const fighters = useMemo(() => [...new Set(records.flatMap((r) => [r.a.name, r.b.name]))].sort((a, b) => a.localeCompare(b, "id")), [records]);
  const methods = useMemo(() => METHODS.filter((k) => records.some((r) => r.method === k)), [records]);
  const tours = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of records) if (r.tournamentId && r.tournamentName) seen.set(r.tournamentId, r.tournamentName);
    return [...seen].map(([id, name]) => ({ id, name }));
  }, [records]);

  const query = q.trim().toLowerCase();
  const list = useMemo(
    () =>
      records.filter((r) => {
        if (stage && r.stage !== stage) return false;
        if (fighter && r.a.name !== fighter && r.b.name !== fighter) return false;
        if (method && r.method !== method) return false;
        if (tour && r.tournamentId !== tour) return false;
        if (!query) return true;
        const hay = `${r.a.name} ${r.b.name} ${matchCode(r.matchNo)} ${r.matchNo} ${stageLabel(r.stage)} ${r.tournamentName ?? ""}`.toLowerCase();
        return hay.includes(query);
      }),
    [records, stage, fighter, method, tour, query],
  );

  const filtered = !!(query || stage || fighter || method || tour);
  const reset = () => { setQ(""); setStage(""); setFighter(""); setMethod(""); setTour(""); setLimit(PAGE); };
  const shown = list.slice(0, limit);

  // kelompok per tanggal, urutan udah terbaru dulu
  const groups: { day: string; items: FightRecord[] }[] = [];
  for (const r of shown) {
    const day = fmtDate(r.completedAt) ?? "Tanggal gak tercatat";
    const g = groups[groups.length - 1];
    if (g && g.day === day) g.items.push(r);
    else groups.push({ day, items: [r] });
  }

  if (loading) return <p className="empty-note is-loading" role="status">Ngambil arsip fight…</p>;
  if (!records.length) {
    return <p className="empty-note">Arsip masih kosong. Begitu wasit masukin hasil fight pertama, catatannya muncul di sini.</p>;
  }

  const pick = (label: string, value: string, set: (v: string) => void, options: { value: string; label: string }[], all: string) => (
    <label className="filter">
      <span>{label}</span>
      <select value={value} onChange={(e) => { set(e.target.value); setLimit(PAGE); }}>
        <option value="">{all}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );

  return (
    <div className="archive">
      <Reveal className="archive-controls" kind="up">
        <label className="board-search">
          <span className="sr-only">Cari di arsip</span>
          <input type="search" placeholder="Cari fighter atau nomor fight" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} />
        </label>
        {pick("Babak", stage, setStage, stages.map((s) => ({ value: s, label: stageLabel(s) })), "Semua babak")}
        {pick("Fighter", fighter, setFighter, fighters.map((n) => ({ value: n, label: n })), "Semua fighter")}
        {methods.length > 0 && pick("Hasil", method, setMethod, methods.map((k) => ({ value: k, label: METHOD_SHORT[k as ResultMethod] })), "Semua hasil")}
        {tours.length > 1 && pick("Turnamen", tour, setTour, tours.map((t) => ({ value: t.id, label: t.name })), "Semua turnamen")}
      </Reveal>

      <p className="archive-count" role="status">
        {filtered ? `${list.length} dari ${records.length} catatan cocok.` : `${records.length} fight tercatat.`}
        {filtered && <button type="button" className="link-btn" onClick={reset}>Hapus saringan</button>}
      </p>

      {list.length === 0 ? (
        <p className="empty-note">Gak ada catatan yang cocok sama saringan itu.</p>
      ) : (
        <Reveal className="file" kind="up">
          <header className="file-head" aria-hidden="true">
            <span>Match</span>
            <span>Fighter</span>
            <span>Winner</span>
            <span>Method / durasi</span>
            <span>Status</span>
          </header>
          {groups.map((g) => (
            <section key={g.day} className="file-day">
              <h3 className="file-date">{g.day}</h3>
              <ol className="file-rows">
                {g.items.map((r) => {
                  const w = winnerOf(r);
                  const l = loserOf(r);
                  const clock = fmtClock(r.durationSec);
                  return (
                    <li key={r.key}>
                      <button type="button" className="rec" onClick={() => ui.openRecord(r)}>
                        <span className="rec-no">
                          <b>Match {matchCode(r.matchNo)}</b>
                          <span>{stageLabel(r.stage)}{r.tournamentId && r.tournamentId !== currentTournamentId && r.tournamentName ? `, ${r.tournamentName}` : ""}</span>
                        </span>
                        <span className="rec-names">
                          <span className={r.winnerSide === 1 ? "is-win" : "is-lose"}>{r.a.name}</span>
                          <i>vs</i>
                          <span className={r.winnerSide === 2 ? "is-win" : "is-lose"}>{r.b.name}</span>
                        </span>
                        <span className="rec-win">
                          <small>Winner</small>
                          <b>{w.name}</b>
                          <span className="sr-only"> ngalahin {l.name}</span>
                        </span>
                        <span className="rec-how">
                          <b>{r.method ? METHOD_SHORT[r.method] : "Gak dicatat"}</b>
                          <span>{clock ? clock : "Durasi gak dicatat"}{fmtTime(r.completedAt) ? `, jam ${fmtTime(r.completedAt)}` : ""}</span>
                        </span>
                        <span className="rec-stamp" aria-hidden="true">Completed</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </Reveal>
      )}

      {list.length > shown.length && (
        <p className="archive-more">
          <button type="button" className="btn ghost" onClick={() => setLimit((n) => n + PAGE)}>
            Tampilkan {Math.min(PAGE, list.length - shown.length)} catatan lagi
          </button>
        </p>
      )}
    </div>
  );
}
