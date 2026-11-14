"use client";
import { useEffect, useState } from "react";
import { sb } from "@/lib/supabase";
import { stageLabel } from "@/lib/bracket";
import { fmtDate } from "@/lib/fight";
import type { TabProps } from "@/lib/adminTypes";
import type { Tournament } from "@/lib/types";

/** Superadmin: nama turnamen yang jalan, mulai turnamen baru, dan arsip turnamen lama + juaranya. */
export default function TournamentTab({ data, reload, notify }: TabProps) {
  const { tournament, tournaments, matches, schemaReady } = data;
  const [name, setName] = useState("");
  const [next, setNext] = useState("");
  const [resetPaid, setResetPaid] = useState(false);
  const [busy, setBusy] = useState(false);
  const archived = tournaments.filter((t) => t.id !== tournament?.id);

  useEffect(() => { setName(tournament?.name ?? ""); }, [tournament?.id, tournament?.name]);

  if (!schemaReady) {
    return <div className="empty-state">Fitur turnamen baru aktif setelah supabase/schema.sql versi terbaru di-Run di Supabase.</div>;
  }

  async function rename(t: Tournament, value: string) {
    const v = value.trim();
    if (!v || v === t.name) return;
    setBusy(true);
    const { error } = await sb().from("tournaments").update({ name: v }).eq("id", t.id);
    if (error) notify(error.message, true);
    else notify(`Nama turnamen diganti jadi ${v}.`);
    await reload();
    setBusy(false);
  }

  async function start(e: React.FormEvent) {
    e.preventDefault();
    const v = next.trim();
    if (!v) return;
    const unfinished = matches.some((m) => !m.winner_id && m.fighter1_id && m.fighter2_id);
    const warn =
      `Mulai turnamen baru "${v}"?\n\n` +
      `"${tournament?.name ?? "Turnamen sekarang"}" ditutup dan masuk arsip. Hasil, catatan fight, dan juaranya tetap tersimpan.` +
      (unfinished ? "\n\nMasih ada fight yang belum selesai di turnamen sekarang. Fight itu gak bakal dilanjutin." : "") +
      (resetPaid ? "\n\nStatus bayar semua fighter di-reset jadi Belum bayar." : "");
    if (!confirm(warn)) return;
    setBusy(true);
    try {
      const { error } = await sb().rpc("start_tournament", { p_name: v });
      if (error) throw error;
      if (resetPaid) {
        const r = await sb().from("fighters").update({ paid: false, fee: 0 }).eq("paid", true);
        if (r.error) throw r.error;
      }
      setNext("");
      setResetPaid(false);
      notify(`Turnamen ${v} dimulai. Lanjut ke tab Bracket buat generate bracket-nya.`);
    } catch (err) {
      notify((err as Error).message, true);
    }
    await reload();
    setBusy(false);
  }

  async function remove(t: Tournament) {
    if (!confirm(`Hapus arsip turnamen "${t.name}"? Semua match, taruhan, dan catatan fight turnamen itu ikut terhapus permanen.`)) return;
    setBusy(true);
    const { error } = await sb().from("tournaments").delete().eq("id", t.id);
    if (error) notify(error.message, true);
    else notify(`Arsip turnamen ${t.name} dihapus.`);
    await reload();
    setBusy(false);
  }

  return (
    <>
      {tournament ? (
        <>
          <div className="stats">
            <div className="stat"><div className="k">Babak sekarang</div><div className="v">{stageLabel(tournament.current_stage)}</div></div>
            <div className="stat"><div className="k">Juara 1</div><div className="v">{tournament.champion_name ?? "–"}</div></div>
            <div className="stat"><div className="k">Juara 2</div><div className="v">{tournament.runner_up_name ?? "–"}</div></div>
            <div className="stat"><div className="k">Juara 3</div><div className="v">{tournament.third_name ?? "–"}</div></div>
          </div>
          <form className="card" onSubmit={(e) => { e.preventDefault(); rename(tournament, name); }}>
            <h3>Turnamen yang lagi jalan</h3>
            <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0 }}>
              Nama ini tampil di papan Juara dan di arsip fight. Babak dan juara keisi sendiri dari hasil resmi.
            </p>
            <div className="form-grid">
              <label className="f">Nama turnamen<input type="text" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} required /></label>
              <button className="btn" disabled={busy || !name.trim() || name.trim() === tournament.name}>Simpan nama</button>
            </div>
          </form>
        </>
      ) : (
        <div className="notice">Belum ada turnamen yang jalan. Mulai satu di bawah.</div>
      )}

      <form className="card" onSubmit={start}>
        <h3>Mulai turnamen baru</h3>
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0 }}>
          Turnamen sekarang ditutup dan masuk arsip (hasil dan juaranya tetap tersimpan). Bracket baru mulai kosong, fighter tetap terdaftar.
        </p>
        <div className="form-grid">
          <label className="f">Nama turnamen baru<input type="text" value={next} maxLength={80} onChange={(e) => setNext(e.target.value)} placeholder="misal Underground Fight Vol. 2" required /></label>
          <label className="check"><input type="checkbox" checked={resetPaid} onChange={(e) => setResetPaid(e.target.checked)} /> Reset status bayar semua fighter</label>
          <button className="btn danger" disabled={busy || !next.trim()}>Mulai turnamen baru</button>
        </div>
      </form>

      <section style={{ marginTop: 22 }}>
        <div className="sec-head"><h2>Arsip turnamen</h2><span className="sub">{archived.length} turnamen</span></div>
        {archived.length === 0 ? (
          <div className="empty-state">Belum ada turnamen yang diarsipkan.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Turnamen</th><th>Juara 1</th><th>Juara 2</th><th>Juara 3</th><th>Selesai</th><th></th></tr></thead>
              <tbody>
                {archived.map((t) => (
                  <tr key={t.id}>
                    <td><strong>{t.name}</strong></td>
                    <td>{t.champion_name ?? "-"}</td>
                    <td>{t.runner_up_name ?? "-"}</td>
                    <td>{t.third_name ?? "-"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{fmtDate(t.completed_at) ?? "-"}</td>
                    <td>
                      <div className="row-actions" style={{ flexWrap: "nowrap" }}>
                        <button className="btn ghost sm" disabled={busy} onClick={() => { const v = prompt("Nama baru turnamen:", t.name); if (v) rename(t, v); }}>Ganti nama</button>
                        <button className="btn danger sm" disabled={busy} onClick={() => remove(t)}>Hapus</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
