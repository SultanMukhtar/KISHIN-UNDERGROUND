"use client";
import { useState } from "react";
import Avatar from "@/components/Avatar";
import { deletePhoto, sb, uploadPhoto } from "@/lib/supabase";
import { yen } from "@/lib/betting";
import { isRegistered } from "@/lib/fight";
import { PRIZE_CUT_PCT, PRIZE_SPLIT_PCT, prizeOf } from "@/lib/prize";
import type { TabProps } from "@/lib/adminTypes";
import type { Sponsor } from "@/lib/types";

const MAX_AMOUNT = 1_000_000_000;

/** "50.000" / "50000" → 50000. Kosong / bukan angka / kelewat besar → null. */
function toAmount(raw: string): number | null {
  const t = raw.replace(/[.\s]/g, "");
  if (!/^\d+$/.test(t)) return null;
  const n = parseInt(t, 10);
  return n <= MAX_AMOUNT ? n : null;
}

/** Superadmin: sponsor turnamen yang lagi jalan. Nama, foto, dan jumlahnya tampil di halaman penonton. */
export default function SponsorsTab({ data, reload, notify }: TabProps) {
  const { sponsors, sponsorsReady, tournament } = data;
  const tid = data.settings?.current_tournament_id ?? null;
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Sponsor | null>(null);

  if (!sponsorsReady) {
    return (
      <div className="empty-state">
        Fitur sponsor aktif setelah isi <code>supabase/schema.sql</code> versi terbaru di-Run di Supabase &gt; SQL Editor.
      </div>
    );
  }

  const total = sponsors.reduce((s, x) => s + x.amount, 0);
  // uang pendaftaran vol ini (fighter yang udah bayar) + sponsor → hadiah juara
  const registration = data.fighters.filter((f) => f.paid && isRegistered(f, tid)).reduce((s, f) => s + (f.fee ?? 0), 0);
  const prize = prizeOf({ registration, sponsors: total });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const nm = name.trim();
    const amt = toAmount(amount);
    if (!nm) return;
    if (amt === null) return notify(`Jumlah sponsor harus angka, dari 0 sampai ${yen(MAX_AMOUNT)}.`, true);
    setBusy(true);
    let photo_url: string | null = null;
    try {
      photo_url = file ? await uploadPhoto(file, "sponsors") : null;
      const { error } = await sb().from("sponsors").insert({ name: nm, amount: amt, photo_url, tournament_id: tid });
      if (error) {
        await deletePhoto(photo_url); // gagal disimpan → foto yang terlanjur ke-upload dibuang
        throw error;
      }
      setName(""); setAmount(""); setFile(null);
      (e.target as HTMLFormElement).reset();
      notify(`Sponsor ${nm} ditambahkan.`);
      await reload();
    } catch (err) {
      notify((err as Error).message, true);
    }
    setBusy(false);
  }

  async function changePhoto(s: Sponsor, f: File | undefined) {
    if (!f) return;
    let url: string | null = null;
    try {
      url = await uploadPhoto(f, "sponsors");
      const { error } = await sb().from("sponsors").update({ photo_url: url }).eq("id", s.id);
      if (error) throw error;
      await deletePhoto(s.photo_url); // file foto lama dibuang dari storage
      notify(`Foto ${s.name} diganti.`);
      await reload();
    } catch (err) {
      await deletePhoto(url);
      notify((err as Error).message, true);
    }
  }

  async function removePhoto(s: Sponsor) {
    if (!s.photo_url || !confirm(`Hapus foto ${s.name}? File-nya ikut dihapus permanen.`)) return;
    const { error } = await sb().from("sponsors").update({ photo_url: null }).eq("id", s.id);
    if (error) return notify(error.message, true);
    await deletePhoto(s.photo_url);
    notify(`Foto ${s.name} dihapus.`);
    await reload();
  }

  async function remove(s: Sponsor) {
    if (!confirm(`Hapus sponsor ${s.name} (${yen(s.amount)})? Langsung hilang dari halaman penonton.`)) return;
    const { error } = await sb().from("sponsors").delete().eq("id", s.id);
    if (error) return notify(error.message, true);
    await deletePhoto(s.photo_url); // file fotonya ikut dibuang
    if (editing?.id === s.id) setEditing(null);
    notify(`Sponsor ${s.name} dihapus.`);
    await reload();
  }

  return (
    <>
      <div className="card">
        <h3>Hadiah juara</h3>
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0 }}>
          Uang pendaftaran {yen(prize.registration)} + sponsor {yen(prize.sponsors)} = {yen(prize.gross)}. Dipotong {PRIZE_CUT_PCT}% buat kas
          panitia ({yen(prize.cut)}), sisanya <strong>{yen(prize.total)}</strong> jadi hadiah. Angkanya ikut berubah sendiri tiap ada
          pendaftaran atau sponsor baru, dan hadiah juara 1–3 tampil di papan Juara halaman penonton.
        </p>
        <div className="stats" style={{ marginBottom: 0 }}>
          {(["Juara 1", "Juara 2", "Juara 3"] as const).map((label, i) => (
            <div className="stat" key={label}>
              <div className="k">{label} ({PRIZE_SPLIT_PCT[i]}%)</div>
              <div className="v mono">{yen(prize.places[i])}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="stats">
        <div className="stat"><div className="k">Total sponsor</div><div className="v mono">{yen(total)}</div></div>
        <div className="stat"><div className="k">Jumlah sponsor</div><div className="v">{sponsors.length}</div></div>
      </div>

      <form className="card" onSubmit={add}>
        <h3>Tambah sponsor</h3>
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0 }}>
          {tournament && <>Buat turnamen <strong>{tournament.name}</strong>. </>}
          Nama, foto, dan jumlahnya langsung tampil di halaman penonton, bagian Sponsor.
        </p>
        <div className="form-grid">
          <label className="f">Nama sponsor<input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required /></label>
          <label className="f">Jumlah sponsor (¥)<input type="number" inputMode="numeric" min={0} max={MAX_AMOUNT} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} required /></label>
          <label className="f">Foto / logo<input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
          <button className="btn" disabled={busy}>{busy ? "Menyimpan…" : "Tambah sponsor"}</button>
        </div>
      </form>

      {editing && (
        <EditForm
          key={editing.id}
          sponsor={editing}
          onCancel={() => setEditing(null)}
          onSave={async (changes) => {
            const { error } = await sb().from("sponsors").update(changes).eq("id", editing.id);
            if (error) return notify(error.message, true);
            notify(`Sponsor ${changes.name ?? editing.name} disimpan.`);
            setEditing(null);
            await reload();
          }}
          notify={notify}
        />
      )}

      {sponsors.length === 0 ? (
        <div className="empty-state">Belum ada sponsor. Bagian Sponsor di halaman penonton muncul begitu sponsor pertama ditambahkan.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Sponsor</th><th>Jumlah</th><th></th></tr></thead>
            <tbody>
              {sponsors.map((s) => (
                <tr key={s.id}>
                  <td>
                    <span className="fighter-id">
                      <Avatar name={s.name} url={s.photo_url} />
                      <strong>{s.name}</strong>
                    </span>
                  </td>
                  <td className="mono" style={{ whiteSpace: "nowrap" }}>{yen(s.amount)}</td>
                  <td>
                    <div className="row-actions" style={{ flexWrap: "nowrap" }}>
                      <label className="btn ghost sm" style={{ cursor: "pointer" }}>
                        {s.photo_url ? "Ganti foto" : "Upload foto"}
                        <input type="file" accept="image/*" hidden onChange={(e) => { changePhoto(s, e.target.files?.[0]); e.target.value = ""; }} />
                      </label>
                      {s.photo_url && <button className="btn danger sm" onClick={() => removePhoto(s)}>Hapus foto</button>}
                      <button className="btn ghost sm" onClick={() => { setEditing(s); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</button>
                      <button className="btn danger sm" onClick={() => remove(s)}>Hapus</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function EditForm({ sponsor, onSave, onCancel, notify }: {
  sponsor: Sponsor;
  onSave: (c: Partial<Sponsor>) => Promise<void>;
  onCancel: () => void;
  notify: (msg: string, err?: boolean) => void;
}) {
  const [name, setName] = useState(sponsor.name);
  const [amount, setAmount] = useState(String(sponsor.amount));
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const nm = name.trim();
    const amt = toAmount(amount);
    if (!nm) return;
    if (amt === null) return notify(`Jumlah sponsor harus angka, dari 0 sampai ${yen(MAX_AMOUNT)}.`, true);
    setBusy(true);
    await onSave({ name: nm, amount: amt });
    setBusy(false);
  }

  return (
    <form className="card is-editing" onSubmit={submit}>
      <h3>Edit sponsor {sponsor.name}</h3>
      <div className="form-grid">
        <label className="f">Nama sponsor<input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required /></label>
        <label className="f">Jumlah sponsor (¥)<input type="number" inputMode="numeric" min={0} max={MAX_AMOUNT} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} required /></label>
      </div>
      <p style={{ fontSize: 12, color: "var(--muted)" }}>Foto diganti dari tombol Ganti foto di daftar sponsor.</p>
      <div className="row-actions" style={{ marginTop: 10 }}>
        <button className="btn" disabled={busy}>{busy ? "Menyimpan…" : "Simpan sponsor"}</button>
        <button type="button" className="btn ghost" onClick={onCancel} disabled={busy}>Batal</button>
      </div>
    </form>
  );
}
