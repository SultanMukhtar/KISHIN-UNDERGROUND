"use client";
import { useCallback, useEffect, useState } from "react";
import EditModal from "@/components/admin/EditModal";
import { sb } from "@/lib/supabase";
import { api } from "@/lib/api";
import type { TabProps } from "@/lib/adminTypes";

type Row = { user_id: string; username: string; role: "admin" | "superadmin"; created_at: string };

export default function AccountsTab({ me, notify, confirm }: TabProps) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [addErr, setAddErr] = useState<string | null>(null);
  const [pwFor, setPwFor] = useState<Row | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await sb().from("admin_accounts").select("user_id,username,role,created_at").order("created_at");
    if (error) return setLoadErr(error.message);
    setLoadErr(null);
    setRows((data ?? []) as Row[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const name = username.trim();
    if (name.length < 3) return setAddErr("Username minimal 3 karakter.");
    if (password.length < 6) return setAddErr("Password minimal 6 karakter.");
    setBusy(true);
    setAddErr(null);
    try {
      await api("/api/admins", "POST", { username: name, password });
      notify(`Akun ${name} dibuat. Kasih username dan password-nya ke orangnya.`);
      setUsername(""); setPassword("");
      await load();
    } catch (er) {
      setAddErr("Akun gagal dibuat: " + (er as Error).message);
    }
    setBusy(false);
  }

  /** Dipanggil popup ganti password. Balikin pesan gagal, atau null kalau berhasil. */
  async function changePw(r: Row, pw: string): Promise<string | null> {
    try {
      await api("/api/admins", "PATCH", { user_id: r.user_id, password: pw });
    } catch (e) {
      return (e as Error).message;
    }
    notify(`Password ${r.username} diganti.`);
    setPwFor(null);
    return null;
  }

  async function remove(r: Row) {
    const ok = await confirm({
      title: `Hapus akun ${r.username}?`,
      points: ["Orangnya langsung keluar dan gak bisa ngedit apa pun.", "Catatan taruhan yang dia input tetap ada."],
      confirmLabel: "Hapus akun",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api("/api/admins", "DELETE", { user_id: r.user_id });
      notify(`Akun ${r.username} dihapus.`);
      await load();
    } catch (er) {
      notify("Gagal hapus akun: " + (er as Error).message, true);
    }
    setBusy(false);
  }

  return (
    <>
      <form className="card" onSubmit={add} noValidate>
        <h3>Tambah akun admin</h3>
        <p className="hint">Admin bisa ngurus Pendaftaran, Bracket, Taruhan, dan lihat Arsip. Menu lainnya cuma buat superadmin.</p>
        <div className="form-grid settings-actions">
          <label className="f">Username<input type="text" value={username} onChange={(e) => { setUsername(e.target.value); setAddErr(null); }} maxLength={30} autoComplete="off" autoCapitalize="none" spellCheck={false} /></label>
          <label className="f">Password (minimal 6 karakter)<input type="text" value={password} onChange={(e) => { setPassword(e.target.value); setAddErr(null); }} maxLength={72} autoComplete="new-password" spellCheck={false} /></label>
          <button className="btn" disabled={busy}>{busy ? "Membuat…" : "Tambah akun"}</button>
        </div>
        {addErr && <div className="notice err admin-modal-err" role="alert">{addErr}</div>}
      </form>

      <div className="list-head">
        <h3>Akun panitia {rows && <span className="count">{rows.length}</span>}</h3>
      </div>
      {loadErr ? (
        <div className="admin-first-error">
          <div className="notice err" role="alert">Daftar akun gagal dimuat: {loadErr}</div>
          <button type="button" className="btn ghost" onClick={load}>Coba lagi</button>
        </div>
      ) : !rows ? (
        <p className="admin-loading" role="status">Ngambil daftar akun…</p>
      ) : (
        <div className="table-wrap">
          <table className="rtable">
            <thead><tr><th>Username</th><th>Role</th><th>Dibuat</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.user_id}>
                  <td className="cell-wide"><strong>{r.username}</strong>{r.user_id === me.user_id && <span className="muted"> (kamu)</span>}</td>
                  <td data-label="Role"><span className={"pill is-static " + (r.role === "superadmin" ? "ok" : "neutral")}>{r.role === "superadmin" ? "Superadmin" : "Admin"}</span></td>
                  <td data-label="Dibuat" className="nowrap">{new Date(r.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</td>
                  <td className="cell-action">
                    <button className="btn ghost sm" onClick={() => setPwFor(r)} aria-label={`Ganti password ${r.username}`}>Ganti password</button>
                    {r.role !== "superadmin" && <button className="btn danger sm" disabled={busy} onClick={() => remove(r)} aria-label={`Hapus akun ${r.username}`}>Hapus</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pwFor && <ChangePassword key={pwFor.user_id} row={pwFor} onClose={() => setPwFor(null)} onSave={(pw) => changePw(pwFor, pw)} />}
    </>
  );
}

/** Popup ganti password satu akun. */
function ChangePassword({ row, onSave, onClose }: { row: Row; onSave: (pw: string) => Promise<string | null>; onClose: () => void }) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (pw.length < 6) return setError("Password minimal 6 karakter.");
    setBusy(true);
    setError(null);
    const err = await onSave(pw);
    if (err) setError("Gagal ganti password: " + err);
    setBusy(false);
  }

  return (
    <EditModal title={`Ganti password ${row.username}`} onClose={onClose} onSubmit={submit} busy={busy} error={error} submitLabel="Simpan password">
      <label className="f">Password baru
        <input type="text" value={pw} onChange={(e) => setPw(e.target.value)} minLength={6} maxLength={72} autoComplete="new-password" spellCheck={false} />
      </label>
      <p className="hint">Minimal 6 karakter. Kasih password barunya langsung ke orangnya.</p>
    </EditModal>
  );
}
