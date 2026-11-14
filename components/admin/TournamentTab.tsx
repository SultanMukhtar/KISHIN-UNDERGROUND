"use client";
import { useEffect, useState } from "react";
import EditModal from "@/components/admin/EditModal";
import { deletePhoto, sb } from "@/lib/supabase";
import { stageLabel } from "@/lib/bracket";
import { fmtDate } from "@/lib/fight";
import type { TabProps } from "@/lib/adminTypes";
import type { Tournament } from "@/lib/types";

/** Superadmin: nama turnamen yang jalan, mulai turnamen baru, dan arsip turnamen lama + juaranya. */
export default function TournamentTab({ data, reload, notify, confirm, go }: TabProps) {
  const { tournament, tournaments, matches, schemaReady, fighters, sponsors, bets } = data;
  const [name, setName] = useState("");
  const [next, setNext] = useState("");
  const [resetPaid, setResetPaid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState<Tournament | null>(null);
  const [resetPaidNow, setResetPaidNow] = useState(false);
  const [clearSponsors, setClearSponsors] = useState(false);
  const archived = tournaments.filter((t) => t.id !== tournament?.id);

  useEffect(() => { setName(tournament?.name ?? ""); }, [tournament?.id, tournament?.name]);

  if (!schemaReady) {
    return <div className="notice err" role="status">Fitur turnamen aktif setelah isi <code>supabase/schema.sql</code> versi terbaru di-Run di Supabase &gt; SQL Editor.</div>;
  }

  async function rename(t: Tournament, value: string) {
    const v = value.trim();
    if (!v || v === t.name) return;
    setBusy(true);
    const { error } = await sb().from("tournaments").update({ name: v }).eq("id", t.id);
    if (error) notify("Gagal ganti nama: " + error.message, true);
    else notify(`Nama turnamen diganti jadi ${v}.`);
    await reload();
    setBusy(false);
  }

  /** Dipanggil popup ganti nama turnamen arsip. Balikin pesan gagal, atau null kalau berhasil. */
  async function renameArchived(t: Tournament, value: string): Promise<string | null> {
    const v = value.trim();
    if (v === t.name) {
      setRenaming(null);
      return null;
    }
    const { error } = await sb().from("tournaments").update({ name: v }).eq("id", t.id);
    if (error) return error.message;
    notify(`Nama turnamen diganti jadi ${v}.`);
    setRenaming(null);
    await reload();
    return null;
  }

  async function start(e: React.FormEvent) {
    e.preventDefault();
    const v = next.trim();
    if (!v || busy) return;
    const unfinished = matches.filter((m) => !m.winner_id && m.fighter1_id && m.fighter2_id && m.status !== "cancelled").length;
    const unpaidBets = bets.filter((b) => !b.paid_out).length;
    const paidCount = fighters.filter((f) => f.paid).length;
    const ok = await confirm({
      title: `Mulai turnamen ${v}?`,
      body: <><b>{tournament?.name ?? "Turnamen sekarang"}</b> ditutup dan masuk arsip. Hasil, catatan fight, dan juaranya tetap tersimpan.</>,
      points: [
        "Bracket turnamen baru mulai kosong.",
        ...(unfinished ? [`${unfinished} fight yang belum selesai gak bakal dilanjutin.`] : []),
        ...(unpaidBets ? [`${unpaidBets} taruhan belum ditandai dibayar. Beresin dulu kalau masih ada utang.`] : []),
        ...(sponsors.length ? [`${sponsors.length} sponsor tetap di arsip turnamen lama. Daftar sponsor baru mulai kosong.`] : []),
        resetPaid ? `Status bayar ${paidCount} fighter di-reset jadi belum bayar. Hadiah juara mulai dari nol.` : "Status bayar fighter gak berubah.",
      ],
      confirmLabel: "Mulai turnamen baru",
      tone: "danger",
      typeToConfirm: "MULAI",
    });
    if (!ok) return;
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
      notify(`Turnamen ${v} dimulai.`);
      await reload();
      go("bracket");
    } catch (err) {
      notify("Turnamen baru gagal dimulai: " + (err as Error).message, true);
      await reload();
    }
    setBusy(false);
  }

  /** Kosongin turnamen yang lagi jalan dan mulai lagi dari awal (nama turnamen & fighter tetap). */
  async function resetCurrent(e: React.FormEvent) {
    e.preventDefault();
    if (!tournament || busy) return;
    const results = matches.filter((m) => m.winner_id && m.fighter1_id && m.fighter2_id).length;
    const paidCount = fighters.filter((f) => f.paid).length;
    const ok = await confirm({
      title: `Reset ${tournament.name}?`,
      body: <>Isi turnamen ini dikosongin dan mulai lagi dari awal. Nama turnamen, daftar fighter, dan arsip turnamen lain tetap.</>,
      points: [
        `${matches.length} match (bracket + laga tambahan) dihapus.`,
        ...(bets.length ? [`${bets.length} taruhan dan riwayat transaksinya dihapus. Uang yang udah masuk harus dikembalikan manual.`] : []),
        ...(results ? [`${results} hasil fight hilang dari arsip dan rekor fighter.`] : []),
        clearSponsors ? `${sponsors.length} sponsor turnamen ini dihapus.` : "Sponsor tetap.",
        resetPaidNow ? `Status bayar ${paidCount} fighter di-reset jadi belum bayar.` : "Status bayar fighter gak berubah.",
        "Gak bisa dibatalin.",
      ],
      confirmLabel: "Reset turnamen",
      tone: "danger",
      typeToConfirm: "RESET",
    });
    if (!ok) return;
    setBusy(true);
    const photos = clearSponsors ? sponsors.map((s) => s.photo_url) : [];
    const { error } = await sb().rpc("reset_tournament", { p_reset_paid: resetPaidNow, p_clear_sponsors: clearSponsors });
    if (error) {
      notify("Reset gagal: " + error.message, true);
    } else {
      for (const p of photos) await deletePhoto(p); // logo sponsor yang dihapus ikut dibuang dari storage
      setResetPaidNow(false);
      setClearSponsors(false);
      notify(`${tournament.name} di-reset. Mulai lagi dari buat bracket.`);
    }
    await reload();
    setBusy(false);
    if (!error) go("bracket");
  }

  async function remove(t: Tournament) {
    const records = (data.history ?? []).filter((h) => h.tournament_id === t.id && h.match_id).length;
    const ok = await confirm({
      title: `Hapus arsip ${t.name}?`,
      points: [
        "Semua fight, taruhan, dan sponsor turnamen itu ikut terhapus.",
        ...(records ? [`${records} catatan fight hilang dari arsip dan rekor fighter.`] : []),
        ...(t.champion_name ? [`Juaranya (${t.champion_name}) hilang dari daftar juara sebelumnya.`] : []),
        "Gak bisa dibatalin.",
      ],
      confirmLabel: "Hapus arsip",
      tone: "danger",
      typeToConfirm: "HAPUS",
    });
    if (!ok) return;
    setBusy(true);
    const { error } = await sb().from("tournaments").delete().eq("id", t.id);
    if (error) notify("Gagal hapus arsip: " + error.message, true);
    else notify(`Arsip turnamen ${t.name} dihapus.`);
    await reload();
    setBusy(false);
  }

  return (
    <>
      {tournament ? (
        <>
          <div className="stats is-compact">
            <div className="stat"><div className="k">Babak sekarang</div><div className="v">{stageLabel(tournament.current_stage)}</div></div>
            <div className="stat"><div className="k">Juara 1</div><div className="v is-name">{tournament.champion_name ?? "–"}</div></div>
            <div className="stat"><div className="k">Juara 2</div><div className="v is-name">{tournament.runner_up_name ?? "–"}</div></div>
            <div className="stat"><div className="k">Juara 3</div><div className="v is-name">{tournament.third_name ?? "–"}</div></div>
          </div>
          <form className="card" onSubmit={(e) => { e.preventDefault(); rename(tournament, name); }}>
            <h3>Turnamen yang lagi jalan</h3>
            <p className="hint">Nama ini tampil di papan Juara dan di arsip fight. Babak dan juara keisi sendiri dari hasil resmi.</p>
            <div className="form-grid settings-actions">
              <label className="f">Nama turnamen<input type="text" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} required /></label>
              <button className="btn" disabled={busy || !name.trim() || name.trim() === tournament.name}>Simpan nama</button>
            </div>
          </form>

          <form className="card" onSubmit={resetCurrent}>
            <h3>Reset turnamen yang lagi jalan</h3>
            <p className="hint">
              Ngosongin bracket, laga tambahan, taruhan, dan catatan fight {tournament.name}, lalu mulai lagi dari awal.
              Nama turnamen, fighter, dan arsip turnamen lain gak kesentuh.
            </p>
            <div className="form-grid settings-actions">
              <label className="check"><input type="checkbox" checked={resetPaidNow} onChange={(e) => setResetPaidNow(e.target.checked)} /> Reset status bayar fighter</label>
              <label className="check"><input type="checkbox" checked={clearSponsors} onChange={(e) => setClearSponsors(e.target.checked)} /> Hapus sponsor turnamen ini</label>
              <button className="btn danger" disabled={busy}>Reset turnamen…</button>
            </div>
          </form>
        </>
      ) : (
        <div className="notice">Belum ada turnamen yang jalan. Mulai satu di bawah.</div>
      )}

      <form className="card" onSubmit={start}>
        <h3>Mulai turnamen baru</h3>
        <p className="hint">Turnamen sekarang masuk arsip. Fighter tetap terdaftar, bracket dan sponsor mulai kosong.</p>
        <div className="form-grid settings-actions">
          <label className="f">Nama turnamen baru<input type="text" value={next} maxLength={80} onChange={(e) => setNext(e.target.value)} placeholder="misal UNDERGROUND Vol. 3" required /></label>
          <label className="check"><input type="checkbox" checked={resetPaid} onChange={(e) => setResetPaid(e.target.checked)} /> Fighter harus bayar lagi (reset status bayar)</label>
          <button className="btn danger" disabled={busy || !next.trim()}>Mulai turnamen baru…</button>
        </div>
      </form>

      <section className="bracket-round">
        <div className="sec-head"><h2>Arsip turnamen</h2><span className="sub">{archived.length} turnamen</span></div>
        {archived.length === 0 ? (
          <div className="empty-state">Belum ada turnamen yang diarsipkan.</div>
        ) : (
          <div className="table-wrap">
            <table className="rtable">
              <thead><tr><th>Turnamen</th><th>Juara 1</th><th>Juara 2</th><th>Juara 3</th><th>Selesai</th><th></th></tr></thead>
              <tbody>
                {archived.map((t) => (
                  <tr key={t.id}>
                    <td className="cell-wide"><strong>{t.name}</strong></td>
                    <td data-label="Juara 1">{t.champion_name ?? "-"}</td>
                    <td data-label="Juara 2">{t.runner_up_name ?? "-"}</td>
                    <td data-label="Juara 3">{t.third_name ?? "-"}</td>
                    <td data-label="Selesai" className="nowrap">{fmtDate(t.completed_at) ?? "-"}</td>
                    <td className="cell-action">
                      <button className="btn ghost sm" disabled={busy} onClick={() => setRenaming(t)} aria-label={`Ganti nama ${t.name}`}>Ganti nama</button>
                      <button className="btn danger sm" disabled={busy} onClick={() => remove(t)} aria-label={`Hapus arsip ${t.name}`}>Hapus</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {renaming && (
        <RenameTournament key={renaming.id} tournament={renaming} onClose={() => setRenaming(null)} onSave={(v) => renameArchived(renaming, v)} />
      )}
    </>
  );
}

/** Popup ganti nama turnamen arsip. */
function RenameTournament({ tournament, onSave, onClose }: {
  tournament: Tournament;
  onSave: (name: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const [name, setName] = useState(tournament.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) return setError("Nama turnamen wajib diisi.");
    setBusy(true);
    setError(null);
    const err = await onSave(name);
    if (err) setError("Gagal nyimpan: " + err);
    setBusy(false);
  }

  return (
    <EditModal title={`Ganti nama ${tournament.name}`} onClose={onClose} onSubmit={submit} busy={busy} error={error} submitLabel="Simpan nama">
      <label className="f">Nama turnamen<input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required /></label>
      <p className="hint">Nama baru langsung tampil di daftar juara sebelumnya dan di Fight history.</p>
    </EditModal>
  );
}
