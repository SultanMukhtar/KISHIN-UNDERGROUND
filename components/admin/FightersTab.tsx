"use client";
import { useMemo, useState } from "react";
import Avatar from "@/components/Avatar";
import { deletePhoto, sb, uploadPhoto } from "@/lib/supabase";
import { yen } from "@/lib/betting";
import { fighterCode } from "@/lib/codes";
import { FIGHTER_STATE_LABEL, buildRecords, fighterStateOf, fighterStats } from "@/lib/fight";
import type { TabProps } from "@/lib/adminTypes";
import type { Fighter, FighterFlag } from "@/lib/types";

const FLAGS: { value: FighterFlag; label: string }[] = [
  { value: "active", label: "Aktif" },
  { value: "injured", label: "Cedera" },
  { value: "suspended", label: "Diskors" },
  { value: "retired", label: "Pensiun" },
];

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export default function FightersTab({ data, reload, notify }: TabProps) {
  const fee = data.settings?.registration_fee ?? 0;
  const ready = data.schemaReady;
  const tid = data.settings?.current_tournament_id ?? null;
  // pendaftaran per vol: tiap vol (turnamen) baru, fighter daftar & bayar lagi
  const perVol = data.perVol;
  const [name, setName] = useState("");
  const [group, setGroup] = useState("");
  const [paid, setPaid] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Fighter | null>(null);

  const all = data.fighters;
  const fighters = perVol ? all.filter((f) => f.tournament_id === tid) : all; // terdaftar di vol ini
  const others = perVol ? all.filter((f) => f.tournament_id !== tid) : []; // fighter vol sebelumnya
  const paidList = fighters.filter((f) => f.paid);
  const income = paidList.reduce((s, f) => s + (f.fee ?? 0), 0);
  const shown = fighters.filter((f) => f.name.toLowerCase().includes(q.toLowerCase()));
  const byId = useMemo(() => new Map(all.map((f) => [f.id, f])), [all]);
  const records = useMemo(
    () => buildRecords(data.history, data.matches, byId, data.tournament?.name ?? null),
    [data.history, data.matches, byId, data.tournament],
  );

  /** Punya riwayat di vol lain (fight tercatat / juara turnamen lain)? Datanya gak boleh ikut kehapus. */
  const hasPast = (f: Fighter) =>
    (data.history ?? []).some((h) => h.tournament_id !== tid && (h.fighter_a_id === f.id || h.fighter_b_id === f.id)) ||
    data.tournaments.some((t) => t.id !== tid && [t.champion_id, t.runner_up_id, t.third_id].includes(f.id));

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const nm = name.trim();
    if (!nm) return;
    const existing = all.find((f) => sameName(f.name, nm));
    if (existing && (!perVol || existing.tournament_id === tid)) {
      return notify(perVol ? `${existing.name} udah terdaftar di vol ini.` : "Nama fighter itu sudah terdaftar.", true);
    }
    setBusy(true);
    let photo_url: string | null = null;
    try {
      photo_url = file ? await uploadPhoto(file, "fighters") : null;
      if (existing) {
        // fighter vol sebelumnya daftar lagi: foto & riwayat lamanya tetap nyambung
        const { error } = await sb().from("fighters").update({
          tournament_id: tid,
          paid,
          fee: paid ? fee : 0,
          ...(group.trim() ? { group_name: group.trim() } : {}),
          ...(photo_url ? { photo_url } : {}),
        }).eq("id", existing.id);
        if (error) {
          await deletePhoto(photo_url);
          throw error;
        }
        if (photo_url) await deletePhoto(existing.photo_url); // foto lama diganti yang baru
        notify(`${existing.name} didaftarin lagi buat vol ini.`);
      } else {
        const { error } = await sb().from("fighters").insert({
          name: nm, group_name: group.trim() || null, paid, fee: paid ? fee : 0, photo_url,
          ...(perVol ? { tournament_id: tid } : {}),
        });
        if (error) {
          await deletePhoto(photo_url); // pendaftaran gagal → foto yang terlanjur ke-upload dibuang
          throw new Error(error.code === "23505" ? "Nama fighter itu sudah terdaftar." : error.message);
        }
        notify(`${nm} terdaftar.`);
      }
      setName(""); setGroup(""); setFile(null); setPaid(true);
      (e.target as HTMLFormElement).reset();
      await reload();
    } catch (err) {
      notify((err as Error).message, true);
    }
    setBusy(false);
  }

  async function update(f: Fighter, changes: Partial<Fighter>) {
    const { error } = await sb().from("fighters").update(changes).eq("id", f.id);
    if (error) return notify(error.message, true);
    await reload();
  }

  async function changePhoto(f: Fighter, file: File | undefined) {
    if (!file) return;
    let url: string | null = null;
    try {
      url = await uploadPhoto(file, "fighters");
      const { error } = await sb().from("fighters").update({ photo_url: url }).eq("id", f.id);
      if (error) throw error;
      await deletePhoto(f.photo_url); // file foto lama dibuang dari storage
      notify(`Foto ${f.name} diganti.`);
      await reload();
    } catch (err) {
      await deletePhoto(url);
      notify((err as Error).message, true);
    }
  }

  async function removePhoto(f: Fighter) {
    if (!f.photo_url || !confirm(`Hapus foto ${f.name}? File-nya ikut dihapus permanen.`)) return;
    const { error } = await sb().from("fighters").update({ photo_url: null }).eq("id", f.id);
    if (error) return notify(error.message, true);
    await deletePhoto(f.photo_url);
    notify(`Foto ${f.name} dihapus.`);
    await reload();
  }

  async function remove(f: Fighter) {
    const inBracket = data.matches.some((m) => [m.fighter1_id, m.fighter2_id].includes(f.id));
    if (perVol && hasPast(f)) {
      // cuma dikeluarin dari pendaftaran vol ini; data, foto, dan riwayatnya tetap disimpan
      if (inBracket) return notify(`${f.name} masih ada di bracket vol ini. Minta superadmin ganti slot-nya di tab Bracket dulu.`, true);
      if (!confirm(`Keluarin ${f.name} dari pendaftaran vol ini?\n\nFoto dan riwayat fight-nya di vol lain tetap disimpan. Bisa didaftarin lagi kapan aja.`)) return;
      const { error } = await sb().from("fighters").update({ tournament_id: null, paid: false, fee: 0 }).eq("id", f.id);
      if (error) return notify(error.message, true);
      notify(`${f.name} dikeluarin dari pendaftaran vol ini.`);
      await reload();
      return;
    }
    const warn = inBracket ? "\n\nFighter ini sudah ada di bracket — slot-nya akan jadi kosong dan taruhan ke dia ikut terhapus." : "";
    if (!confirm(`Hapus ${f.name}?${warn}`)) return;
    const { error } = await sb().from("fighters").delete().eq("id", f.id);
    if (error) return notify(error.message, true);
    await deletePhoto(f.photo_url); // file fotonya ikut dibuang
    notify(`${f.name} dihapus.`);
    await reload();
  }

  return (
    <>
      <div className="stats">
        <div className="stat"><div className="k">{perVol ? "Terdaftar vol ini" : "Terdaftar"}</div><div className="v">{fighters.length}</div></div>
        <div className="stat"><div className="k">Sudah bayar</div><div className="v" style={{ color: "var(--green)" }}>{paidList.length}</div></div>
        <div className="stat"><div className="k">Belum bayar</div><div className="v" style={{ color: "var(--red)" }}>{fighters.length - paidList.length}</div></div>
        <div className="stat"><div className="k">Uang pendaftaran</div><div className="v mono">{yen(income)}</div></div>
      </div>

      <form className="card" onSubmit={add}>
        <h3>{perVol && data.tournament ? `Daftarkan fighter ke ${data.tournament.name}` : "Daftarkan fighter"}</h3>
        {perVol && (
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0 }}>
            Pendaftaran berlaku per vol: tiap vol baru, fighter daftar dan bayar lagi. Fighter dari vol sebelumnya tinggal ketik namanya
            (muncul di saran), foto dan riwayat fight-nya tetap nyambung.
          </p>
        )}
        <div className="form-grid">
          <label className="f">Nama fighter
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} autoComplete="off" list={perVol ? "ug-past-fighters" : undefined} />
          </label>
          <label className="f">Kelas / grup RP<input type="text" value={group} onChange={(e) => setGroup(e.target.value)} placeholder="opsional" /></label>
          <label className="f">Foto fighter<input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
          <label className="check"><input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} /> Sudah bayar {yen(fee)}</label>
          <button className="btn" disabled={busy}>{busy ? "Menyimpan…" : "Daftarkan"}</button>
        </div>
        {perVol && (
          <datalist id="ug-past-fighters">
            {others.map((f) => <option key={f.id} value={f.name} />)}
          </datalist>
        )}
      </form>

      {editing && (
        <EditForm
          key={editing.id}
          fighter={editing}
          ready={ready}
          onCancel={() => setEditing(null)}
          onSave={async (changes) => {
            const { error } = await sb().from("fighters").update(changes).eq("id", editing.id);
            if (error) return notify(error.code === "23505" ? "Nama itu sudah dipakai fighter lain." : error.message, true);
            notify(`Profil ${changes.name ?? editing.name} disimpan.`);
            setEditing(null);
            await reload();
          }}
        />
      )}

      <div className="card" style={{ padding: 0, border: "none", background: "transparent" }}>
        <input type="text" placeholder="Cari nama fighter…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 10 }} aria-label="Cari nama fighter" />
        {fighters.length === 0 ? (
          <div className="empty-state">
            {perVol
              ? `Belum ada fighter yang daftar di vol ini.${others.length ? " Fighter vol sebelumnya bisa didaftarin lagi lewat form di atas." : ""}`
              : "Belum ada fighter yang daftar."}
          </div>
        ) : shown.length === 0 ? (
          <div className="empty-state">Gak ada fighter bernama &quot;{q}&quot;.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>#</th><th>Fighter</th><th>Kelas</th><th>Status</th><th>Menang–kalah</th><th>Bayar</th><th>Fee</th><th>Pertama daftar</th><th></th></tr>
              </thead>
              <tbody>
                {shown.map((f) => {
                  const st = fighterStats(f.id, records);
                  const keep = perVol && hasPast(f);
                  return (
                    <tr key={f.id}>
                      <td>{fighters.indexOf(f) + 1}</td>
                      <td>
                        <span className="fighter-id">
                          <Avatar name={f.name} url={f.photo_url} />
                          <span style={{ whiteSpace: "nowrap" }}><strong>{f.name}</strong><br /><span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>{fighterCode(f.id)}</span></span>
                        </span>
                      </td>
                      <td>{f.group_name ?? "-"}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{FIGHTER_STATE_LABEL[fighterStateOf(f, data.matches)]}</td>
                      <td className="mono" style={{ whiteSpace: "nowrap" }}>{st.wins}–{st.losses}</td>
                      <td>
                        <button className={"pill " + (f.paid ? "ok" : "no")} title="Klik untuk ubah"
                          onClick={() => update(f, { paid: !f.paid, fee: !f.paid ? fee : 0 })}>
                          {f.paid ? "Sudah" : "Belum"}
                        </button>
                      </td>
                      <td className="mono">{yen(f.fee ?? 0)}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{f.created_at ? new Date(f.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-"}</td>
                      <td>
                        <div className="row-actions" style={{ flexWrap: "nowrap" }}>
                          <label className="btn ghost sm" style={{ cursor: "pointer" }}>
                            {f.photo_url ? "Ganti foto" : "Upload foto"}
                            <input type="file" accept="image/*" hidden onChange={(e) => { changePhoto(f, e.target.files?.[0]); e.target.value = ""; }} />
                          </label>
                          {f.photo_url && <button className="btn danger sm" onClick={() => removePhoto(f)}>Hapus foto</button>}
                          <button className="btn ghost sm" onClick={() => { setEditing(f); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</button>
                          <button className="btn danger sm" onClick={() => remove(f)} title={keep ? "Keluarin dari vol ini, riwayatnya tetap disimpan" : undefined}>
                            {keep ? "Keluarin" : "Hapus"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function EditForm({ fighter, ready, onSave, onCancel }: { fighter: Fighter; ready: boolean; onSave: (c: Partial<Fighter>) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState(fighter.name);
  const [group, setGroup] = useState(fighter.group_name ?? "");
  const [status, setStatus] = useState<FighterFlag>(fighter.status ?? "active");
  const [notes, setNotes] = useState(fighter.notes ?? "");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    await onSave({
      name: name.trim(),
      group_name: group.trim() || null,
      notes: notes.trim() || null,
      ...(ready ? { status } : {}),
    });
    setBusy(false);
  }

  return (
    <form className="card is-editing" onSubmit={submit}>
      <h3>Edit profil {fighter.name}</h3>
      <div className="form-grid">
        <label className="f">Nama fighter<input type="text" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} /></label>
        <label className="f">Kelas / grup RP<input type="text" value={group} onChange={(e) => setGroup(e.target.value)} /></label>
        {ready && (
          <label className="f">Status
            <select value={status} onChange={(e) => setStatus(e.target.value as FighterFlag)}>
              {FLAGS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
            </select>
          </label>
        )}
      </div>
      <label className="f" style={{ marginTop: 10 }}>Catatan panitia (gak tampil ke penonton)<textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      {ready && <p style={{ fontSize: 12, color: "var(--muted)" }}>Status Gugur dan Juara dihitung otomatis dari hasil fight. Yang diatur di sini cuma cedera, skors, dan pensiun.</p>}
      <div className="row-actions" style={{ marginTop: 10 }}>
        <button className="btn" disabled={busy}>{busy ? "Menyimpan…" : "Simpan profil"}</button>
        <button type="button" className="btn ghost" onClick={onCancel} disabled={busy}>Batal</button>
      </div>
    </form>
  );
}
