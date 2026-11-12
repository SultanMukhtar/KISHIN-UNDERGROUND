"use client";
import { useCallback, useEffect, useState } from "react";
import { sb } from "@/lib/supabase";
import { api } from "@/lib/api";
import type { TabProps } from "@/lib/adminTypes";

type Row = { user_id: string; username: string; role: "admin" | "superadmin"; created_at: string };

export default function AccountsTab({ me, notify }: TabProps) {
  const [rows, setRows] = useState<Row[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [pwFor, setPwFor] = useState<string | null>(null);
  const [newPw, setNewPw] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await sb().from("admin_accounts").select("user_id,username,role,created_at").order("created_at");
    if (error) return notify(error.message, true);
    setRows((data ?? []) as Row[]);
  }, [notify]);

  useEffect(() => { load(); }, [load]);

  async function run(fn: () => Promise<unknown>, okMsg: string) {
    setBusy(true);
    try {
      await fn();
      notify(okMsg);
      await load();
      return true;
    } catch (e) {
      notify((e as Error).message, true);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const name = username.trim();
    const ok = await run(() => api("/api/admins", "POST", { username: name, password }), `Akun ${name} dibuat. Kasih username & password-nya ke orangnya.`);
    if (ok) { setUsername(""); setPassword(""); }
  }

  async function changePw(r: Row) {
    const ok = await run(() => api("/api/admins", "PATCH", { user_id: r.user_id, password: newPw }), `Password ${r.username} diganti.`);
    if (ok) { setPwFor(null); setNewPw(""); }
  }

  async function remove(r: Row) {
    if (!confirm(`Hapus akun ${r.username}? Orangnya langsung gak bisa ngedit apa pun.`)) return;
    await run(() => api("/api/admins", "DELETE", { user_id: r.user_id }), `Akun ${r.username} dihapus.`);
  }

  return (
    <>
      <form className="card" onSubmit={add}>
        <h3>Tambah akun admin</h3>
        <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0 }}>
          Admin bisa ngurus Pendaftaran, Bracket, dan Taruhan. Pengaturan dan Akun Admin cuma buat superadmin.
        </p>
        <div className="form-grid">
          <label className="f">Username<input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={30} autoComplete="off" /></label>
          <label className="f">Password<input type="text" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" /></label>
          <button className="btn" disabled={busy}>Tambah akun</button>
        </div>
      </form>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Username</th><th>Role</th><th>Dibuat</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.user_id}>
                <td><strong>{r.username}</strong>{r.user_id === me.user_id && <span style={{ color: "var(--muted)" }}> (kamu)</span>}</td>
                <td><span className={"pill " + (r.role === "superadmin" ? "ok" : "neutral")}>{r.role === "superadmin" ? "Superadmin" : "Admin"}</span></td>
                <td style={{ whiteSpace: "nowrap" }}>{new Date(r.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</td>
                <td>
                  {pwFor === r.user_id ? (
                    <div className="row-actions" style={{ flexWrap: "nowrap" }}>
                      <input type="text" placeholder="Password baru" value={newPw} onChange={(e) => setNewPw(e.target.value)} minLength={6} style={{ minWidth: 140 }} autoComplete="new-password" />
                      <button className="btn sm" disabled={busy || newPw.length < 6} onClick={() => changePw(r)}>Simpan</button>
                      <button className="btn ghost sm" onClick={() => { setPwFor(null); setNewPw(""); }}>Batal</button>
                    </div>
                  ) : (
                    <div className="row-actions" style={{ flexWrap: "nowrap" }}>
                      <button className="btn ghost sm" onClick={() => { setPwFor(r.user_id); setNewPw(""); }}>Ganti password</button>
                      {r.role !== "superadmin" && <button className="btn danger sm" disabled={busy} onClick={() => remove(r)}>Hapus</button>}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
