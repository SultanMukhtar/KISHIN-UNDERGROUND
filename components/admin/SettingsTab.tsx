"use client";
import { useEffect, useMemo, useState } from "react";
import { deletePhoto, photoPath, sb, uploadPhoto } from "@/lib/supabase";
import type { TabProps } from "@/lib/adminTypes";
import MoneyInput, { formatMoney, parseMoney } from "./MoneyInput";
import PhotoField, { NO_PHOTO_CHANGE, type PhotoChange } from "./PhotoField";

type Form = { eventName: string; tagline: string; fee: string; cut: string };

export default function SettingsTab({ data, reload, notify, confirm }: TabProps) {
  const s = data.settings;

  /* ---------- info event ---------- */
  // nilai yang tersimpan di database. Cuma berubah kalau isinya beneran berubah, bukan tiap data dimuat ulang.
  const saved = useMemo<Form | null>(
    () => (s ? { eventName: s.event_name, tagline: s.tagline, fee: formatMoney(s.registration_fee), cut: String(Math.round(s.default_house_cut * 100)) } : null),
    [s?.event_name, s?.tagline, s?.registration_fee, s?.default_house_cut], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const [form, setForm] = useState<Form>(saved ?? { eventName: "", tagline: "", fee: "", cut: "" });
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // data baru masuk (misal admin lain nyimpan): isi form ikut, KECUALI lagi ada ketikan yang belum disimpan
  useEffect(() => {
    if (saved && !dirty) setForm(saved);
  }, [saved, dirty]);

  // ketikan belum disimpan → browser nanya dulu sebelum halaman ditutup / di-refresh
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = (k: keyof Form) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  };

  const cutNum = Number(form.cut);
  const cutBad = form.cut.trim() === "" || !Number.isFinite(cutNum) || cutNum < 0 || cutNum > 90;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (cutBad) return setErr("Potongan kas harus angka 0 sampai 90.");
    setBusy(true);
    setErr(null);
    const { error } = await sb().from("settings").update({
      event_name: form.eventName.trim() || "UNDERGROUND",
      tagline: form.tagline.trim(),
      registration_fee: parseMoney(form.fee) ?? 0,
      default_house_cut: Math.round(cutNum) / 100,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    if (error) {
      setErr("Gagal nyimpan: " + error.message);
    } else {
      setDirty(false);
      notify("Info event disimpan.");
      await reload();
    }
    setBusy(false);
  }

  /* ---------- foto hero ---------- */
  const [hero, setHero] = useState<PhotoChange>(NO_PHOTO_CHANGE);
  const [heroBusy, setHeroBusy] = useState(false);
  const heroChanged = !!hero.file || hero.remove;

  async function saveHero(e: React.FormEvent) {
    e.preventDefault();
    if (!heroChanged || heroBusy) return;
    if (hero.remove && !(await confirm({
      title: "Hapus foto hero?",
      body: "Banner paling atas balik ke tampilan polos sampai ada foto baru.",
      points: ["File fotonya ikut dihapus dari storage, gak bisa dibalikin."],
      confirmLabel: "Hapus foto",
      tone: "danger",
    }))) return;
    setHeroBusy(true);
    const oldUrl = s?.hero_url;
    let url: string | null = null;
    try {
      url = hero.file ? await uploadPhoto(hero.file, "hero") : null;
      const { error } = await sb().from("settings").update({ hero_url: url }).eq("id", 1);
      if (error) throw error;
      await deletePhoto(oldUrl); // file hero lama dibuang dari storage
      setHero(NO_PHOTO_CHANGE);
      notify(url ? "Foto hero diganti." : "Foto hero dihapus.");
      await reload();
    } catch (er) {
      await deletePhoto(url);
      notify("Foto hero gagal disimpan: " + (er as Error).message, true);
    }
    setHeroBusy(false);
  }

  /* ---------- bersihin storage ---------- */
  const [cleaning, setCleaning] = useState(false);

  async function cleanupPhotos() {
    setCleaning(true);
    try {
      const used = new Set<string>();
      const [f, st, sp] = await Promise.all([
        sb().from("fighters").select("photo_url"),
        sb().from("settings").select("hero_url").eq("id", 1).maybeSingle(),
        sb().from("sponsors").select("photo_url"), // semua turnamen, termasuk arsip
      ]);
      if (f.error) throw f.error;
      if (st.error) throw st.error;
      (f.data ?? []).forEach((r) => { const p = photoPath(r.photo_url); if (p) used.add(p); });
      (sp.data ?? []).forEach((r) => { const p = photoPath(r.photo_url); if (p) used.add(p); });
      const hp = photoPath(st.data?.hero_url);
      if (hp) used.add(hp);

      const orphans: string[] = [];
      // tabel sponsor belum ada / gagal dibaca → folder sponsors/ gak disentuh sama sekali
      for (const folder of ["fighters", "hero", ...(sp.error ? [] : ["sponsors"])]) {
        const { data: files, error } = await sb().storage.from("photos").list(folder, { limit: 1000 });
        if (error) throw error;
        for (const file of files ?? []) {
          const path = `${folder}/${file.name}`;
          if (file.id && !used.has(path)) orphans.push(path);
        }
      }
      if (!orphans.length) { notify("Gak ada foto nganggur. Storage udah bersih."); return; }
      const ok = await confirm({
        title: `Hapus ${orphans.length} foto nganggur?`,
        body: "Foto-foto ini gak dipakai fighter, sponsor, atau hero mana pun.",
        points: ["Dihapus permanen dari storage, gak bisa dibalikin."],
        confirmLabel: `Hapus ${orphans.length} foto`,
        tone: "danger",
      });
      if (!ok) return;
      const { error } = await sb().storage.from("photos").remove(orphans);
      if (error) throw error;
      notify(`${orphans.length} foto nganggur dihapus.`);
    } catch (er) {
      notify("Gagal bersihin storage: " + (er as Error).message, true);
    } finally {
      setCleaning(false);
    }
  }

  return (
    <>
      <form className="card" onSubmit={save} noValidate>
        <h3>Info event</h3>
        <div className="form-grid">
          <label className="f">Nama event<input type="text" value={form.eventName} onChange={(e) => set("eventName")(e.target.value)} maxLength={60} /></label>
          <label className="f">Biaya pendaftaran
            <MoneyInput value={form.fee} onChange={set("fee")} placeholder="0" />
          </label>
          <label className="f">Potongan kas taruhan (%)
            <input type="number" inputMode="numeric" min={0} max={90} step={1} value={form.cut} onChange={(e) => set("cut")(e.target.value)} aria-invalid={cutBad || undefined} aria-describedby="set-cut-hint" />
          </label>
        </div>
        <p className="hint" id="set-cut-hint">Potongan kas kepakai buat bracket baru. Tiap fight tetap bisa diubah sendiri di tab Taruhan.</p>
        <label className="f settings-tagline">Tagline<textarea rows={2} value={form.tagline} onChange={(e) => set("tagline")(e.target.value)} maxLength={160} /></label>
        {err && <div className="notice err admin-modal-err" role="alert">{err}</div>}
        <div className="row-actions settings-actions">
          <button className="btn" disabled={busy || !dirty}>{busy ? "Menyimpan…" : "Simpan info event"}</button>
          {dirty && !busy && (
            <button type="button" className="btn ghost" onClick={() => { setDirty(false); setErr(null); if (saved) setForm(saved); }}>Batalin perubahan</button>
          )}
          {dirty && <span className="unsaved" role="status">Belum disimpan</span>}
        </div>
      </form>

      <form className="card" onSubmit={saveHero}>
        <h3>Foto hero</h3>
        <PhotoField
          label="Banner paling atas di halaman penonton"
          name={s?.event_name ?? "Hero"}
          currentUrl={s?.hero_url}
          value={hero}
          onChange={setHero}
          shape="wide"
          disabled={heroBusy}
          hint="Pakai foto landscape lebar, misal 1600×800. JPG, PNG, WebP, atau GIF, maksimal 5 MB."
        />
        {heroChanged && (
          <div className="row-actions settings-actions">
            <button className={hero.remove ? "btn danger" : "btn"} disabled={heroBusy}>
              {heroBusy ? "Menyimpan…" : hero.remove ? "Hapus foto hero" : "Simpan foto hero"}
            </button>
            <button type="button" className="btn ghost" disabled={heroBusy} onClick={() => setHero(NO_PHOTO_CHANGE)}>Batal</button>
          </div>
        )}
      </form>

      <div className="card">
        <h3>Bersihkan storage foto</h3>
        <p className="hint">Foto yang diganti atau dihapus udah otomatis ikut kebuang. Tombol ini buat jaga-jaga kalau ada sisa.</p>
        <div className="row-actions settings-actions">
          <button type="button" className="btn ghost" onClick={cleanupPhotos} disabled={cleaning}>{cleaning ? "Nyari…" : "Cari foto nganggur"}</button>
        </div>
      </div>
    </>
  );
}
