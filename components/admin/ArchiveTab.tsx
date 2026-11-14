"use client";
import { useMemo, useState } from "react";
import { stageLabel } from "@/lib/bracket";
import { METHOD_SHORT, buildRecords, fmtWhen, matchCode, winnerOf } from "@/lib/fight";
import type { TabProps } from "@/lib/adminTypes";

/** Catatan resmi semua fight yang selesai (cuma baca). Hasil diubah dari tab Bracket. */
export default function ArchiveTab({ data, go }: TabProps) {
  const { history, matches, fighters, tournament } = data;
  const [q, setQ] = useState("");
  const [tour, setTour] = useState<string>("all");
  const byId = useMemo(() => new Map(fighters.map((f) => [f.id, f])), [fighters]);
  const records = useMemo(() => buildRecords(history, matches, byId, tournament?.name ?? null), [history, matches, byId, tournament]);

  // daftar turnamen yang punya catatan, urut sesuai catatan terbaru
  const tours = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of records) {
      const key = r.tournamentId ?? "none:" + (r.tournamentName ?? "");
      if (!seen.has(key)) seen.set(key, r.tournamentName ?? "Tanpa turnamen");
    }
    return [...seen.entries()];
  }, [records]);
  const keyOf = (r: (typeof records)[number]) => r.tournamentId ?? "none:" + (r.tournamentName ?? "");

  const query = q.trim().toLowerCase();
  const shown = records.filter((r) =>
    (tour === "all" || keyOf(r) === tour) &&
    (!query || `${r.a.name} ${r.b.name} ${matchCode(r.matchNo)} ${stageLabel(r.stage)} ${r.tournamentName ?? ""}`.toLowerCase().includes(query)));
  const ko = shown.filter((r) => r.method === "KO").length;

  return (
    <>
      <div className="stats is-compact">
        <div className="stat"><div className="k">Fight tercatat</div><div className="v">{shown.length}</div>{shown.length !== records.length && <div className="s">dari {records.length}</div>}</div>
        <div className="stat"><div className="k">Selesai KO</div><div className="v">{ko}</div></div>
        <div className="stat"><div className="k">Turnamen</div><div className="v">{tours.length}</div></div>
      </div>

      <div className="list-head">
        <h3>Catatan fight</h3>
        <div className="list-tools">
          {tours.length > 1 && (
            <select className="list-select" value={tour} onChange={(e) => setTour(e.target.value)} aria-label="Saring turnamen">
              <option value="all">Semua turnamen</option>
              {tours.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          )}
          <input type="search" className="list-search" placeholder="Cari fighter, fight, atau babak" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari di arsip" />
        </div>
      </div>

      {records.length === 0 ? (
        <div className="empty-state">Arsip masih kosong. Catatan muncul sendiri tiap hasil resmi dicatat di tab Bracket.</div>
      ) : shown.length === 0 ? (
        <div className="empty-state">
          Gak ada catatan yang cocok.{" "}
          <button type="button" className="link-btn" onClick={() => { setQ(""); setTour("all"); }}>Tampilkan semua</button>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="rtable">
            <thead><tr><th>Fight</th><th>Pemenang</th><th>Lawan</th><th>Cara</th><th>Babak</th><th>Turnamen</th><th>Selesai</th></tr></thead>
            <tbody>
              {shown.map((r) => {
                const w = winnerOf(r);
                const l = r.winnerSide === 1 ? r.b : r.a;
                return (
                  <tr key={r.key}>
                    <td data-label="Fight" className="mono nowrap">{matchCode(r.matchNo)}</td>
                    <td data-label="Pemenang"><strong>{w.name}</strong></td>
                    <td data-label="Lawan">{l.name}</td>
                    <td data-label="Cara">{r.method ? METHOD_SHORT[r.method] : "-"}</td>
                    <td data-label="Babak" className="nowrap">{stageLabel(r.stage)}</td>
                    <td data-label="Turnamen">{r.tournamentName ?? "-"}</td>
                    <td data-label="Selesai" className="nowrap">{fmtWhen(r.completedAt) ?? "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="hint-inline archive-foot">
        Salah catat? Ubah hasilnya di <button type="button" className="link-btn" onClick={() => go("bracket")}>tab Bracket</button>, arsipnya ikut berubah.
      </p>
    </>
  );
}
