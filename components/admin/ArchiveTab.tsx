"use client";
import { useMemo, useState } from "react";
import { stageLabel } from "@/lib/bracket";
import { METHOD_SHORT, buildRecords, fmtClock, fmtWhen, matchCode, winnerOf } from "@/lib/fight";
import type { TabProps } from "@/lib/adminTypes";

/** Catatan resmi semua fight yang selesai (cuma baca). Hasil diubah dari tab Bracket. */
export default function ArchiveTab({ data }: TabProps) {
  const { history, matches, fighters, tournament } = data;
  const [q, setQ] = useState("");
  const byId = useMemo(() => new Map(fighters.map((f) => [f.id, f])), [fighters]);
  const records = useMemo(() => buildRecords(history, matches, byId, tournament?.name ?? null), [history, matches, byId, tournament]);
  const query = q.trim().toLowerCase();
  const shown = query
    ? records.filter((r) => `${r.a.name} ${r.b.name} ${matchCode(r.matchNo)} ${stageLabel(r.stage)} ${r.tournamentName ?? ""}`.toLowerCase().includes(query))
    : records;
  const ko = records.filter((r) => r.method === "KO").length;

  return (
    <>
      <div className="stats">
        <div className="stat"><div className="k">Fight tercatat</div><div className="v">{records.length}</div></div>
        <div className="stat"><div className="k">Selesai KO</div><div className="v">{ko}</div></div>
        <div className="stat"><div className="k">Turnamen</div><div className="v">{new Set(records.map((r) => r.tournamentId)).size}</div></div>
      </div>

      <input type="text" placeholder="Cari fighter, nomor fight, babak, atau turnamen…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 10 }} aria-label="Cari di arsip" />

      {records.length === 0 ? (
        <div className="empty-state">Arsip masih kosong. Catatan muncul sendiri tiap hasil resmi dimasukin di tab Bracket.</div>
      ) : shown.length === 0 ? (
        <div className="empty-state">Gak ada catatan yang cocok sama &quot;{q}&quot;.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Selesai</th><th>Fight</th><th>Babak</th><th>Turnamen</th><th>Fighter A</th><th>Fighter B</th><th>Pemenang</th><th>Cara</th><th>Durasi</th></tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.key}>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtWhen(r.completedAt) ?? "-"}</td>
                  <td className="mono">{matchCode(r.matchNo)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{stageLabel(r.stage)}</td>
                  <td>{r.tournamentName ?? "-"}</td>
                  <td>{r.a.name}</td>
                  <td>{r.b.name}</td>
                  <td><strong>{winnerOf(r).name}</strong></td>
                  <td>{r.method ? METHOD_SHORT[r.method] : "-"}</td>
                  <td className="mono">{fmtClock(r.durationSec) ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ fontSize: 13, color: "var(--muted)" }}>
        Arsip ini cuma buat dibaca. Buat ngoreksi hasil, cara menang, atau durasi, pakai tab Bracket; arsipnya ikut berubah sendiri.
      </p>
    </>
  );
}
