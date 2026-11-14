"use client";
import { useRef, useState } from "react";
import Mugshot from "@/components/ui/Mugshot";
import EditModal from "@/components/admin/EditModal";
import { deletePhoto, sb, uploadPhoto } from "@/lib/supabase";
import { yen } from "@/lib/betting";
import { PRIZE_CUT_PCT, PRIZE_SPLIT_PCT, prizeOf } from "@/lib/prize";
import type { TabProps } from "@/lib/adminTypes";
import type { Sponsor } from "@/lib/types";
import MoneyInput, { formatMoney, parseMoney } from "./MoneyInput";
import PhotoField, { NO_PHOTO_CHANGE, type PhotoChange } from "./PhotoField";

const MAX_AMOUNT = 1_000_000_000;
const PLACES = ["Juara 1", "Juara 2", "Juara 3"] as const;

/** Superadmin: sponsor turnamen yang lagi jalan + hitungan hadiah juara. Dua-duanya tampil di halaman penonton. */
export default function SponsorsTab({ data, reload, notify, confirm }: TabProps) {
  const { sponsors, sponsorsReady, tournament } = data;
  const tid = data.settings?.current_tournament_id ?? null;

  /* ---------- tambah sponsor ---------- */
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [logo, setLogo] = useState<PhotoChange>(NO_PHOTO_CHANGE);
  const [busy, setBusy] = useState(false);
  const [addErr, setAddErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<Sponsor | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  if (!sponsorsReady) {
    return (
      <div className="notice err" role="status">
        Fitur sponsor aktif setelah isi <code>supabase/schema.sql</code> versi terbaru di-Run di Supabase &gt; SQL Editor.
      </div>
    );
  }

  const total = sponsors.reduce((s, x) => s + x.amount, 0);
  const paidFighters = data.fighters.filter((f) => f.paid);
  // uang pendaftaran (fighter yang udah bayar) + sponsor → hadiah juara
  const registration = paidFighters.reduce((s, f) => s + (f.fee ?? 0), 0);
  const prize = prizeOf({ registration, sponsors: total });
  const typed = parseMoney(amount);
  const gain = typed ? prizeOf({ registration, sponsors: total + typed }).total - prize.total : 0;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const nm = name.trim();
    const amt = amount.trim() === "" ? null : parseMoney(amount);
    if (!nm) { setAddErr("Nama sponsor wajib diisi."); nameRef.current?.focus(); return; }
    if (amt === null) return setAddErr("Isi jumlah sponsornya. Tulis 0 kalau sponsornya bukan uang.");
    if (amt > MAX_AMOUNT) return setAddErr(`Jumlah maksimal ${yen(MAX_AMOUNT)}.`);
    setBusy(true);
    setAddErr(null);
    let photo_url: string | null = null;
    try {
      photo_url = logo.file ? await uploadPhoto(logo.file, "sponsors") : null;
      const { error } = await sb().from("sponsors").insert({ name: nm, amount: amt, photo_url, tournament_id: tid });
      if (error) {
        await deletePhoto(photo_url); // gagal disimpan → foto yang terlanjur ke-upload dibuang
        throw error;
      }
      setName(""); setAmount(""); setLogo(NO_PHOTO_CHANGE);
      notify(amt > 0 ? `${nm} masuk, hadiah juara nambah ${yen(gain)}.` : `${nm} masuk daftar sponsor.`);
      nameRef.current?.focus();
      await reload();
    } catch (err) {
      setAddErr("Sponsor gagal disimpan: " + (err as Error).message);
    }
    setBusy(false);
  }

  async function remove(s: Sponsor) {
    const after = prizeOf({ registration, sponsors: total - s.amount });
    const ok = await confirm({
      title: `Hapus sponsor ${s.name}?`,
      body: "Langsung hilang dari halaman penonton.",
      points: [
        ...(s.amount > 0 ? [`Total hadiah turun ${yen(prize.total - after.total)}, jadi ${yen(after.total)}.`] : []),
        ...(s.photo_url ? ["Logonya ikut dihapus dari storage."] : []),
        "Gak bisa dibatalin.",
      ],
      confirmLabel: "Hapus sponsor",
      tone: "danger",
    });
    if (!ok) return false;
    const { error } = await sb().from("sponsors").delete().eq("id", s.id);
    if (error) { notify("Gagal hapus sponsor: " + error.message, true); return false; }
    await deletePhoto(s.photo_url); // file fotonya ikut dibuang
    notify(`Sponsor ${s.name} dihapus.`);
    await reload();
    return true;
  }

  return (
    <>
      <section className="card prize-card" aria-labelledby="prize-title">
        <h3 id="prize-title">Hadiah juara</h3>
        <div className="prize-grid">
          <dl className="ledger">
            <div><dt>Uang pendaftaran <small>{paidFighters.length} fighter lunas</small></dt><dd>{yen(prize.registration)}</dd></div>
            <div><dt>Sponsor <small>{sponsors.length} sponsor</small></dt><dd><span className="op" aria-hidden="true">+</span>{yen(prize.sponsors)}</dd></div>
            <div className="is-cut"><dt>Kas panitia <small>{PRIZE_CUT_PCT}%</small></dt><dd><span className="op" aria-hidden="true">−</span>{yen(prize.cut)}</dd></div>
            <div className="is-total"><dt>Total hadiah</dt><dd>{yen(prize.total)}</dd></div>
          </dl>
          <ol className="prize-places">
            {PLACES.map((label, i) => (
              <li key={label} className={"place-" + (i + 1)}>
                <span className="place-k">{label} <small>{PRIZE_SPLIT_PCT[i]}%</small></span>
                <b>{yen(prize.places[i])}</b>
              </li>
            ))}
          </ol>
        </div>
        <p className="hint">Angkanya ikut berubah tiap ada fighter lunas atau sponsor baru. Hadiah per juara tampil di papan Juara halaman penonton.</p>
      </section>

      <form className="card spon-form" onSubmit={add} noValidate>
        <h3>Tambah sponsor</h3>
        {tournament && <p className="hint">Buat turnamen <strong>{tournament.name}</strong>. Nama, logo, dan jumlahnya tampil di bagian Sponsor halaman penonton.</p>}
        <div className="form-grid">
          <label className="f">Nama sponsor<input ref={nameRef} type="text" value={name} onChange={(e) => { setName(e.target.value); setAddErr(null); }} maxLength={60} autoComplete="off" /></label>
          <label className="f">Jumlah
            <MoneyInput value={amount} onChange={(v) => { setAmount(v); setAddErr(null); }} placeholder="0" aria-describedby="spon-amount-hint" />
          </label>
        </div>
        <p className="hint" id="spon-amount-hint">
          {typed ? <>Hadiah juara nambah <b>{yen(gain)}</b> jadi {yen(prize.total + gain)}.</> : "Tulis 0 kalau sponsornya barang atau jasa. Jumlahnya gak ditampilkan."}
        </p>
        <div className="reg-row">
          <PhotoField label="Logo (opsional)" name={name} value={logo} onChange={setLogo} shape="logo" disabled={busy} hint="Logo kotak atau foto. JPG, PNG, WebP, atau GIF, maksimal 5 MB." />
          <div className="reg-submit">
            <button className="btn" disabled={busy}>{busy ? "Menyimpan…" : "Tambah sponsor"}</button>
          </div>
        </div>
        {addErr && <div className="notice err admin-modal-err" role="alert">{addErr}</div>}
      </form>

      <div className="list-head">
        <h3>Sponsor <span className="count">{sponsors.length}</span></h3>
        {total > 0 && <span className="hint-inline">Total {yen(total)}</span>}
      </div>

      {sponsors.length === 0 ? (
        <div className="empty-state">Belum ada sponsor. Bagian Sponsor di halaman penonton muncul begitu sponsor pertama masuk.</div>
      ) : (
        <ul className="spon-list">
          {sponsors.map((s) => (
            <li key={s.id} className="spon-row">
              <span className="spon-row-logo"><Mugshot name={s.name} url={s.photo_url} size="md" empty="initial" /></span>
              <span className="spon-row-name">
                <strong>{s.name}</strong>
                <small className="sub-line">{s.amount > 0 ? `${total ? Math.round((s.amount / total) * 100) : 0}% dari total sponsor` : "Sponsor barang / jasa"}</small>
              </span>
              <span className="spon-row-amount mono">{s.amount > 0 ? yen(s.amount) : "-"}</span>
              <button type="button" className="btn ghost sm" onClick={() => setEditing(s)} aria-label={`Edit sponsor ${s.name}`}>Edit</button>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <EditSponsor
          key={editing.id}
          sponsor={editing}
          onClose={() => setEditing(null)}
          onRemove={async () => { if (await remove(editing)) setEditing(null); }}
          onSave={async (changes, photo) => {
            let url: string | null = null;
            try {
              if (photo.file) url = await uploadPhoto(photo.file, "sponsors");
              const withPhoto = photo.file ? { photo_url: url } : photo.remove ? { photo_url: null } : {};
              const { error } = await sb().from("sponsors").update({ ...changes, ...withPhoto }).eq("id", editing.id);
              if (error) { await deletePhoto(url); return error.message; }
              if (photo.file || photo.remove) await deletePhoto(editing.photo_url); // logo lama dibuang
            } catch (err) {
              await deletePhoto(url);
              return (err as Error).message;
            }
            notify(`Sponsor ${changes.name ?? editing.name} disimpan.`);
            setEditing(null);
            await reload();
            return null;
          }}
        />
      )}
    </>
  );
}

/** Popup edit sponsor: nama, jumlah, logo, dan hapus. onSave balikin pesan gagal, atau null kalau berhasil. */
function EditSponsor({ sponsor, onSave, onClose, onRemove }: {
  sponsor: Sponsor;
  onSave: (c: Partial<Sponsor>, photo: PhotoChange) => Promise<string | null>;
  onClose: () => void;
  onRemove: () => Promise<void>;
}) {
  const [name, setName] = useState(sponsor.name);
  const [amount, setAmount] = useState(formatMoney(sponsor.amount));
  const [logo, setLogo] = useState<PhotoChange>(NO_PHOTO_CHANGE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const nm = name.trim();
    const amt = amount.trim() === "" ? null : parseMoney(amount);
    if (!nm) return setError("Nama sponsor wajib diisi.");
    if (amt === null) return setError("Isi jumlah sponsornya. Tulis 0 kalau sponsornya bukan uang.");
    if (amt > MAX_AMOUNT) return setError(`Jumlah maksimal ${yen(MAX_AMOUNT)}.`);
    setBusy(true);
    setError(null);
    const err = await onSave({ name: nm, amount: amt }, logo);
    if (err) setError("Gagal nyimpan: " + err);
    setBusy(false);
  }

  return (
    <EditModal
      title={`Edit ${sponsor.name}`}
      onClose={onClose}
      onSubmit={submit}
      busy={busy}
      error={error}
      submitLabel="Simpan sponsor"
      changed={!!logo.file || logo.remove}
      extra={<button type="button" className="btn danger" disabled={busy} onClick={onRemove}>Hapus sponsor…</button>}
    >
      <div className="form-grid">
        <label className="f">Nama sponsor<input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></label>
        <label className="f">Jumlah<MoneyInput value={amount} onChange={setAmount} placeholder="0" /></label>
      </div>
      <div className="modal-photo">
        <PhotoField label="Logo" name={name} currentUrl={sponsor.photo_url} value={logo} onChange={setLogo} shape="logo" disabled={busy} />
      </div>
    </EditModal>
  );
}
