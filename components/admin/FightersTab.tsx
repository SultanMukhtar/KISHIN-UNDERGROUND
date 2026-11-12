"use client";
import { useState } from "react";
import Avatar from "@/components/Avatar";
import { deletePhoto, sb, uploadPhoto } from "@/lib/supabase";
import { yen } from "@/lib/betting";
import type { TabProps } from "@/lib/adminTypes";
import type { Fighter } from "@/lib/types";

export default function FightersTab({ data, reload, notify }: TabProps) {
  const fee = data.settings?.registration_fee ?? 0;
  const [name, setName] = useState("");
  const [group, setGroup] = useState("");
  const [paid, setPaid] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");

  const fighters = data.fighters;
  const paidList = fighters.filter((f) => f.paid);
  const income = paidList.reduce((s, f) => s + (f.fee ?? 0), 0);
  const shown = fighters.filter((f) => f.name.toLowerCase().includes(q.toLowerCase()));

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    let photo_url: string | null = null;
    try {
      photo_url = file ? await uploadPhoto(file, "fighters") : null;
      const { error } = await sb().from("fighters").insert({
        name: name.trim(), group_name: group.trim() || null, paid, fee: paid ? fee : 0, photo_url,
      });
      if (error) {
        await deletePhoto(photo_url); // pendaftaran gagal → foto yang terlanjur ke-upload dibuang
        throw new Error(error.code === "23505" ? "Nama fighter itu sudah terdaftar." : error.message);
      }
      setName(""); setGroup(""); setFile(null); setPaid(true);
      (e.target as HTMLFormElement).reset();
      notify(`${name.trim()} terdaftar.`);
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
        <div className="stat"><div className="k">Terdaftar</div><div className="v">{fighters.length}</div></div>
        <div className="stat"><div className="k">Sudah bayar</div><div className="v" style={{ color: "var(--green)" }}>{paidList.length}</div></div>
        <div className="stat"><div className="k">Belum bayar</div><div className="v" style={{ color: "var(--red)" }}>{fighters.length - paidList.length}</div></div>
        <div className="stat"><div className="k">Kas registrasi</div><div className="v mono">{yen(income)}</div></div>
      </div>

      <form className="card" onSubmit={add}>
        <h3>Daftarkan fighter baru</h3>
        <div className="form-grid">
          <label className="f">Nama fighter / username Roblox<input type="text" value={name} onChange={(e) => setName(e.target.value)} required /></label>
          <label className="f">Kelas / grup RP<input type="text" value={group} onChange={(e) => setGroup(e.target.value)} placeholder="opsional" /></label>
          <label className="f">Foto fighter<input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
          <label className="check"><input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} /> Sudah bayar {yen(fee)}</label>
          <button className="btn" disabled={busy}>{busy ? "Menyimpan…" : "Daftarkan"}</button>
        </div>
      </form>

      <div className="card" style={{ padding: 0, border: "none", background: "transparent" }}>
        <input type="text" placeholder="Cari nama fighter…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 10 }} />
        {fighters.length === 0 ? (
          <div className="empty-state">Belum ada fighter yang daftar.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>#</th><th>Fighter</th><th>Kelas / grup</th><th>Bayar</th><th>Fee</th><th>Daftar</th><th>Foto</th><th></th></tr></thead>
              <tbody>
                {shown.map((f) => (
                  <tr key={f.id}>
                    <td>{fighters.indexOf(f) + 1}</td>
                    <td><span className="fighter-id"><Avatar name={f.name} url={f.photo_url} /><strong>{f.name}</strong></span></td>
                    <td>{f.group_name ?? "-"}</td>
                    <td>
                      <button className={"pill " + (f.paid ? "ok" : "no")} title="Klik untuk ubah"
                        onClick={() => update(f, { paid: !f.paid, fee: !f.paid ? fee : 0 })}>
                        {f.paid ? "Sudah" : "Belum"}
                      </button>
                    </td>
                    <td className="mono">{yen(f.fee ?? 0)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{f.created_at ? new Date(f.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "-"}</td>
                    <td>
                      <div className="row-actions" style={{ flexWrap: "nowrap" }}>
                        <label className="btn ghost sm" style={{ cursor: "pointer" }}>
                          {f.photo_url ? "Ganti" : "Upload"}
                          <input type="file" accept="image/*" hidden onChange={(e) => { changePhoto(f, e.target.files?.[0]); e.target.value = ""; }} />
                        </label>
                        {f.photo_url && <button className="btn danger sm" onClick={() => removePhoto(f)}>Hapus foto</button>}
                      </div>
                    </td>
                    <td><button className="btn danger sm" onClick={() => remove(f)}>Hapus</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
