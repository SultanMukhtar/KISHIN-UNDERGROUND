"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Avatar from "@/components/Avatar";
import EditModal from "@/components/admin/EditModal";
import { deletePhoto, sb, uploadPhoto } from "@/lib/supabase";
import { yen } from "@/lib/betting";
import { fighterCode } from "@/lib/codes";
import { buildRecords, fighterStateOf, fighterStats, statusOf, type FighterState } from "@/lib/fight";
import type { TabProps } from "@/lib/adminTypes";
import type { Fighter, FighterFlag } from "@/lib/types";
import PhotoField, { NO_PHOTO_CHANGE, type PhotoChange } from "./PhotoField";

const FLAGS: { value: FighterFlag; label: string }[] = [
  { value: "active", label: "Aktif" },
  { value: "injured", label: "Cedera" },
  { value: "suspended", label: "Diskors" },
  { value: "retired", label: "Pensiun" },
];
/** label status di panel, bahasa panitia (halaman penonton tetap pakai label Inggris) */
const STATE_ID: Record<FighterState, string> = {
  champion: "Juara 1",
  runner_up: "Juara 2",
  third_place: "Juara 3",
  eliminated: "Gugur",
  active: "Aktif",
  injured: "Cedera",
  suspended: "Diskors",
  retired: "Pensiun",
};
type Filter = "all" | "unpaid" | "paid";

export default function FightersTab({ data, reload, notify, confirm, intent }: TabProps) {
  const fee = data.settings?.registration_fee ?? 0;
  const ready = data.schemaReady;
  const fighters = data.fighters;
  const paidList = fighters.filter((f) => f.paid);
  const unpaidCount = fighters.length - paidList.length;
  const income = paidList.reduce((s, f) => s + (f.fee ?? 0), 0);
  const byId = useMemo(() => new Map(fighters.map((f) => [f.id, f])), [fighters]);
  const records = useMemo(
    () => buildRecords(data.history, data.matches, byId, data.tournament?.name ?? null),
    [data.history, data.matches, byId, data.tournament],
  );

  /* ---------- daftar baru ---------- */
  const [name, setName] = useState("");
  const [group, setGroup] = useState("");
  const [paid, setPaid] = useState(true);
  const [photo, setPhoto] = useState<PhotoChange>(NO_PHOTO_CHANGE);
  const [busy, setBusy] = useState(false);
  const [addErr, setAddErr] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!name.trim()) { setAddErr("Nama fighter wajib diisi."); nameRef.current?.focus(); return; }
    setBusy(true);
    setAddErr(null);
    let photo_url: string | null = null;
    try {
      photo_url = photo.file ? await uploadPhoto(photo.file, "fighters") : null;
      const { error } = await sb().from("fighters").insert({
        name: name.trim(), group_name: group.trim() || null, paid, fee: paid ? fee : 0, photo_url,
      });
      if (error) {
        await deletePhoto(photo_url); // pendaftaran gagal → foto yang terlanjur ke-upload dibuang
        throw new Error(error.code === "23505" ? `Nama ${name.trim()} udah terdaftar.` : error.message);
      }
      notify(`${name.trim()} terdaftar${paid ? ", udah bayar" : ", belum bayar"}.`);
      setName(""); setGroup(""); setPhoto(NO_PHOTO_CHANGE); setPaid(true);
      nameRef.current?.focus();
      await reload();
    } catch (err) {
      setAddErr("Gagal daftar: " + (err as Error).message);
    }
    setBusy(false);
  }

  /* ---------- daftar fighter ---------- */
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<Fighter | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  useEffect(() => {
    if (intent?.filter === "unpaid" || intent?.filter === "paid" || intent?.filter === "all") setFilter(intent.filter);
  }, [intent?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const needle = q.trim().toLowerCase();
  const shown = fighters.filter((f) =>
    (filter === "all" || (filter === "paid" ? f.paid : !f.paid)) &&
    (!needle || f.name.toLowerCase().includes(needle) || (f.group_name ?? "").toLowerCase().includes(needle) || fighterCode(f.id).toLowerCase().includes(needle)));

  const inBracket = (f: Fighter) => data.matches.some((m) => m.fighter1_id === f.id || m.fighter2_id === f.id);

  async function setPaidFor(f: Fighter, value: boolean) {
    if (!value) {
      const ok = await confirm({
        title: `${f.name} belum bayar?`,
        body: `Tanda lunas ${yen(f.fee ?? 0)} dicabut.`,
        points: inBracket(f) ? ["Dia udah ada di bracket. Bracket gak berubah, tapi dia gak dihitung di uang pendaftaran."] : undefined,
        confirmLabel: "Cabut tanda lunas",
      });
      if (!ok) return;
    }
    setRowBusy(f.id);
    const { error } = await sb().from("fighters").update({ paid: value, fee: value ? fee : 0 }).eq("id", f.id);
    if (error) notify("Gagal ubah status bayar: " + error.message, true);
    else notify(value ? `${f.name} lunas ${yen(fee)}.` : `${f.name} ditandai belum bayar.`);
    await reload();
    setRowBusy(null);
  }

  async function remove(f: Fighter) {
    const fights = data.matches.filter((m) => m.fighter1_id === f.id || m.fighter2_id === f.id);
    const liveOrDone = fights.filter((m) => m.winner_id || statusOf(m) === "live").length;
    const betsOn = data.bets.filter((b) => b.fighter_id === f.id).length;
    const ok = await confirm({
      title: `Hapus ${f.name}?`,
      body: "Fighter dihapus dari pendaftaran.",
      points: [
        ...(fights.length ? [`Slot dia di ${fights.length} fight jadi kosong.`] : []),
        ...(liveOrDone ? [`${liveOrDone} fight yang udah jalan atau selesai ikut kehilangan fighter-nya.`] : []),
        ...(betsOn ? [`${betsOn} taruhan ke dia ikut terhapus. Uangnya harus dikembalikan manual.`] : []),
        "Catatan arsip tetap ada, cuma gak nyambung lagi ke profilnya.",
        ...(f.photo_url ? ["Fotonya ikut dihapus dari storage."] : []),
      ],
      confirmLabel: "Hapus fighter",
      tone: "danger",
      typeToConfirm: fights.length || betsOn ? "HAPUS" : undefined,
    });
    if (!ok) return false;
    const { error } = await sb().from("fighters").delete().eq("id", f.id);
    if (error) { notify("Gagal hapus fighter: " + error.message, true); return false; }
    await deletePhoto(f.photo_url); // file fotonya ikut dibuang
    notify(`${f.name} dihapus.`);
    await reload();
    return true;
  }

  return (
    <>
      <div className="stats is-compact">
        <div className="stat"><div className="k">Terdaftar</div><div className="v">{fighters.length}</div></div>
        <div className="stat"><div className="k">Udah bayar</div><div className="v">{paidList.length}</div></div>
        <div className={"stat" + (unpaidCount ? " is-alert" : "")}><div className="k">Belum bayar</div><div className="v">{unpaidCount}</div></div>
        <div className="stat"><div className="k">Uang pendaftaran</div><div className="v">{yen(income)}</div></div>
      </div>

      <form className="card reg-form" onSubmit={add} noValidate>
        <h3>Daftarkan fighter</h3>
        <div className="form-grid">
          <label className="f">Nama fighter<input ref={nameRef} type="text" value={name} onChange={(e) => { setName(e.target.value); setAddErr(null); }} maxLength={60} autoComplete="off" /></label>
          <label className="f">Kelas / grup RP (opsional)<input type="text" value={group} onChange={(e) => setGroup(e.target.value)} maxLength={60} autoComplete="off" /></label>
        </div>
        <div className="reg-row">
          <PhotoField label="Foto fighter (opsional)" name={name} value={photo} onChange={setPhoto} disabled={busy} />
          <div className="reg-submit">
            <label className="check"><input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} /> Udah bayar {yen(fee)}</label>
            <button className="btn" disabled={busy}>{busy ? "Menyimpan…" : "Daftarkan"}</button>
          </div>
        </div>
        {addErr && <div className="notice err admin-modal-err" role="alert">{addErr}</div>}
      </form>

      <div className="list-head">
        <h3>Fighter <span className="count">{fighters.length}</span></h3>
        <div className="list-tools">
          <div className="tabs" role="group" aria-label="Saring fighter">
            {([["all", `Semua`], ["unpaid", `Belum bayar (${unpaidCount})`], ["paid", `Udah bayar (${paidList.length})`]] as [Filter, string][]).map(([k, label]) => (
              <button key={k} type="button" className={"tab" + (filter === k ? " active" : "")} aria-pressed={filter === k} onClick={() => setFilter(k)}>{label}</button>
            ))}
          </div>
          <input type="search" className="list-search" placeholder="Cari nama, kelas, atau kode" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari fighter" />
        </div>
      </div>

      {fighters.length === 0 ? (
        <div className="empty-state">Belum ada fighter yang daftar.</div>
      ) : shown.length === 0 ? (
        <div className="empty-state">
          {needle ? <>Gak ada fighter yang cocok sama &quot;{q}&quot;.</> : filter === "unpaid" ? "Semua fighter udah bayar." : "Belum ada yang bayar."}{" "}
          {(needle || filter !== "all") && <button type="button" className="link-btn" onClick={() => { setQ(""); setFilter("all"); }}>Tampilkan semua</button>}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="rtable">
            <thead>
              <tr><th>Fighter</th><th>Status</th><th>Rekor</th><th>Bayar</th><th>Daftar</th><th></th></tr>
            </thead>
            <tbody>
              {shown.map((f) => {
                const st = fighterStats(f.id, records);
                return (
                  <tr key={f.id}>
                    <td className="cell-wide">
                      <span className="fighter-id">
                        <Avatar name={f.name} url={f.photo_url} />
                        <span className="who">
                          <strong>{f.name}</strong>
                          <small className="sub-line"><span className="mono">{fighterCode(f.id)}</span>{f.group_name ? ` · ${f.group_name}` : ""}</small>
                        </span>
                      </span>
                    </td>
                    <td data-label="Status" className="nowrap">{STATE_ID[fighterStateOf(f, data.matches)]}</td>
                    <td data-label="Rekor" className="mono nowrap">{st.wins}–{st.losses}</td>
                    <td data-label="Bayar">
                      {f.paid ? (
                        <span className="paid-cell">
                          <span className="paid-tag">Lunas {yen(f.fee ?? 0)}</span>
                          <button type="button" className="link-btn" disabled={rowBusy === f.id} onClick={() => setPaidFor(f, false)} aria-label={`Cabut tanda lunas ${f.name}`}>Batal</button>
                        </span>
                      ) : (
                        <button type="button" className="btn sm" disabled={rowBusy === f.id} onClick={() => setPaidFor(f, true)} aria-label={`Tandai ${f.name} udah bayar ${yen(fee)}`}>
                          {rowBusy === f.id ? "Nyimpan…" : "Tandai lunas"}
                        </button>
                      )}
                    </td>
                    <td data-label="Daftar" className="nowrap">{f.created_at ? new Date(f.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" }) : "-"}</td>
                    <td className="cell-action">
                      <button className="btn ghost sm" onClick={() => setEditing(f)} aria-label={`Edit ${f.name}`}>Edit</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <EditFighter
          key={editing.id}
          fighter={editing}
          ready={ready}
          onClose={() => setEditing(null)}
          onRemove={async () => { if (await remove(editing)) setEditing(null); }}
          onSave={async (changes, photoChange) => {
            let url: string | null = null;
            try {
              if (photoChange.file) url = await uploadPhoto(photoChange.file, "fighters");
              const withPhoto = photoChange.file ? { photo_url: url } : photoChange.remove ? { photo_url: null } : {};
              const { error } = await sb().from("fighters").update({ ...changes, ...withPhoto }).eq("id", editing.id);
              if (error) {
                await deletePhoto(url);
                return error.code === "23505" ? "Nama itu udah dipakai fighter lain." : error.message;
              }
              if (photoChange.file || photoChange.remove) await deletePhoto(editing.photo_url); // foto lama dibuang
            } catch (err) {
              await deletePhoto(url);
              return (err as Error).message;
            }
            notify(`Profil ${changes.name ?? editing.name} disimpan.`);
            setEditing(null);
            await reload();
            return null;
          }}
        />
      )}
    </>
  );
}

/** Popup edit profil fighter. onSave balikin pesan gagal, atau null kalau berhasil. */
function EditFighter({ fighter, ready, onSave, onClose, onRemove }: {
  fighter: Fighter;
  ready: boolean;
  onSave: (c: Partial<Fighter>, photo: PhotoChange) => Promise<string | null>;
  onClose: () => void;
  onRemove: () => Promise<void>;
}) {
  const [name, setName] = useState(fighter.name);
  const [group, setGroup] = useState(fighter.group_name ?? "");
  const [status, setStatus] = useState<FighterFlag>(fighter.status ?? "active");
  const [notes, setNotes] = useState(fighter.notes ?? "");
  const [photo, setPhoto] = useState<PhotoChange>(NO_PHOTO_CHANGE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) return setError("Nama fighter wajib diisi.");
    setBusy(true);
    setError(null);
    const err = await onSave({
      name: name.trim(),
      group_name: group.trim() || null,
      notes: notes.trim() || null,
      ...(ready ? { status } : {}),
    }, photo);
    if (err) setError("Gagal nyimpan: " + err);
    setBusy(false);
  }

  return (
    <EditModal
      title={`Edit ${fighter.name}`}
      onClose={onClose}
      onSubmit={submit}
      busy={busy}
      error={error}
      submitLabel="Simpan profil"
      changed={!!photo.file || photo.remove}
      extra={<button type="button" className="btn danger" disabled={busy} onClick={onRemove}>Hapus fighter…</button>}
    >
      <div className="form-grid">
        <label className="f">Nama fighter<input type="text" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} /></label>
        <label className="f">Kelas / grup RP (opsional)<input type="text" value={group} onChange={(e) => setGroup(e.target.value)} maxLength={60} /></label>
        {ready && (
          <label className="f">Status
            <select value={status} onChange={(e) => setStatus(e.target.value as FighterFlag)} aria-describedby="fighter-status-hint">
              {FLAGS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
            </select>
          </label>
        )}
      </div>
      {ready && <p className="hint" id="fighter-status-hint">Gugur dan Juara keisi sendiri dari hasil fight.</p>}
      <div className="modal-photo">
        <PhotoField label="Foto" name={name} currentUrl={fighter.photo_url} value={photo} onChange={setPhoto} disabled={busy} />
      </div>
      <label className="f modal-notes">Catatan panitia (gak tampil ke penonton)<textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
    </EditModal>
  );
}
