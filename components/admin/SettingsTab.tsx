"use client";
import { useEffect, useState } from "react";
import { deletePhoto, photoPath, sb, uploadPhoto } from "@/lib/supabase";
import type { TabProps } from "@/lib/adminTypes";

export default function SettingsTab({ data, reload, notify }: TabProps) {
  const s = data.settings;
  const [eventName, setEventName] = useState("");
  const [tagline, setTagline] = useState("");
  const [fee, setFee] = useState("");
  const [cut, setCut] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!s) return;
    setEventName(s.event_name);
    setTagline(s.tagline);
    setFee(String(s.registration_fee));
    setCut(String(Math.round(s.default_house_cut * 100)));
  }, [s]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await sb().from("settings").update({
      event_name: eventName.trim() || "UNDERGROUND",
      tagline: tagline.trim(),
      registration_fee: Math.max(parseInt(fee, 10) || 0, 0),
      default_house_cut: Math.min(Math.max(parseFloat(cut) || 0, 0), 90) / 100,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    if (error) notify(error.message, true);
    else { notify("Pengaturan disimpan."); await reload(); }
    setBusy(false);
  }

  async function setHero(file: File | undefined | null) {
    if (file === undefined) return;
    if (!file && !confirm("Hapus foto hero? File-nya ikut dihapus permanen.")) return;
    setBusy(true);
    const oldUrl = s?.hero_url;
    let hero_url: string | null = null;
    try {
      hero_url = file ? await uploadPhoto(file, "hero") : null;
      const { error } = await sb().from("settings").update({ hero_url }).eq("id", 1);
      if (error) throw error;
      await deletePhoto(oldUrl); // file hero lama dibuang dari storage
      notify(file ? "Foto hero diganti." : "Foto hero dihapus.");
      await reload();
    } catch (err) {
      await deletePhoto(hero_url);
      notify((err as Error).message, true);
    }
    setBusy(false);
  }

  async function cleanupPhotos() {
    setBusy(true);
    try {
      const used = new Set<string>();
      const [f, st] = await Promise.all([
        sb().from("fighters").select("photo_url"),
        sb().from("settings").select("hero_url").eq("id", 1).maybeSingle(),
      ]);
      if (f.error) throw f.error;
      if (st.error) throw st.error;
      (f.data ?? []).forEach((r) => { const p = photoPath(r.photo_url); if (p) used.add(p); });
      const hp = photoPath(st.data?.hero_url);
      if (hp) used.add(hp);

      const orphans: string[] = [];
      for (const folder of ["fighters", "hero"]) {
        const { data: files, error } = await sb().storage.from("photos").list(folder, { limit: 1000 });
        if (error) throw error;
        for (const file of files ?? []) {
          const path = `${folder}/${file.name}`;
          if (file.id && !used.has(path)) orphans.push(path);
        }
      }
      if (!orphans.length) { notify("Gak ada file foto nganggur. Storage udah bersih."); return; }
      if (!confirm(`Ada ${orphans.length} file foto yang gak dipakai siapa pun. Hapus permanen?`)) return;
      const { error } = await sb().storage.from("photos").remove(orphans);
      if (error) throw error;
      notify(`${orphans.length} file foto nganggur dihapus.`);
    } catch (err) {
      notify((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="card">
        <h3>Foto hero (banner paling atas)</h3>
        {s?.hero_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.hero_url} alt="" style={{ width: "100%", maxHeight: 220, objectFit: "cover", border: "1px solid var(--line)", marginBottom: 10 }} />
        ) : (
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0 }}>Belum ada. Pakai gambar landscape lebar (misal 1600×800), maks 5 MB.</p>
        )}
        <div className="row-actions">
          <label className="btn" style={{ cursor: "pointer" }}>
            {s?.hero_url ? "Ganti foto" : "Upload foto"}
            <input type="file" accept="image/*" hidden disabled={busy} onChange={(e) => { setHero(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          {s?.hero_url && <button className="btn danger" disabled={busy} onClick={() => setHero(null)}>Hapus foto</button>}
        </div>
      </div>

      <form className="card" onSubmit={save}>
        <h3>Info event</h3>
        <div className="form-grid">
          <label className="f">Nama event<input type="text" value={eventName} onChange={(e) => setEventName(e.target.value)} /></label>
          <label className="f">Biaya pendaftaran (¥)<input type="number" min={0} value={fee} onChange={(e) => setFee(e.target.value)} /></label>
          <label className="f">House cut default (%)<input type="number" min={0} max={90} value={cut} onChange={(e) => setCut(e.target.value)} /></label>
        </div>
        <label className="f" style={{ marginTop: 10 }}>Tagline<textarea rows={2} value={tagline} onChange={(e) => setTagline(e.target.value)} /></label>
        <p style={{ fontSize: 12, color: "var(--muted)" }}>House cut default dipakai saat bracket dibuat. Tiap match tetap bisa diubah sendiri di tab Taruhan.</p>
        <button className="btn" disabled={busy}>Simpan</button>
      </form>

      <div className="card">
        <h3>Bersihkan storage foto</h3>
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0 }}>
          Foto yang diganti/dihapus udah otomatis ikut kehapus. Tombol ini buat jaga-jaga: nyari file foto yang gak dipakai fighter mana pun atau hero, lalu menghapusnya.
        </p>
        <button className="btn ghost" onClick={cleanupPhotos} disabled={busy}>Cari & hapus foto nganggur</button>
      </div>
    </>
  );
}
