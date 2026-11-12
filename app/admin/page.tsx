"use client";
import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { sb } from "@/lib/supabase";
import type { AdminData, TabProps } from "@/lib/adminTypes";
import FightersTab from "@/components/admin/FightersTab";
import BracketTab from "@/components/admin/BracketTab";
import BettingTab from "@/components/admin/BettingTab";
import SettingsTab from "@/components/admin/SettingsTab";

const TABS = [
  { key: "fighters", label: "Pendaftaran" },
  { key: "bracket", label: "Bracket" },
  { key: "betting", label: "Taruhan" },
  { key: "settings", label: "Pengaturan" },
] as const;

export default function AdminPage() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [envError, setEnvError] = useState<string | null>(null);

  useEffect(() => {
    try {
      sb().auth.getSession().then(({ data }) => setSession(data.session));
      const { data } = sb().auth.onAuthStateChange((_e, s) => setSession(s));
      return () => data.subscription.unsubscribe();
    } catch (e) {
      setEnvError((e as Error).message);
      setSession(null);
    }
  }, []);

  if (envError) return <div className="wrap"><div className="notice err">{envError}</div></div>;
  if (session === undefined) return <div className="wrap"><div className="empty-state">Memuat…</div></div>;
  if (!session) return <Login />;
  return <Dashboard />;
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { error } = await sb().auth.signInWithPassword({ email, password });
    if (error) setErr("Email atau password salah.");
    setBusy(false);
  }

  return (
    <div className="wrap">
      <form className="card login-box" onSubmit={submit}>
        <h1 className="display" style={{ fontSize: 32, margin: "0 0 4px" }}>Panel Panitia 1C</h1>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0 }}>Khusus panitia. Penonton balik ke halaman utama.</p>
        {err && <div className="notice err">{err}</div>}
        <label className="f" style={{ marginBottom: 10 }}>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" /></label>
        <label className="f" style={{ marginBottom: 14 }}>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" /></label>
        <button className="btn" style={{ width: "100%" }} disabled={busy}>{busy ? "Masuk…" : "Masuk"}</button>
      </form>
    </div>
  );
}

function Dashboard() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("fighters");
  const [data, setData] = useState<AdminData>({ settings: null, fighters: [], matches: [], bets: [] });
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);

  const reload = useCallback(async () => {
    const c = sb();
    const [s, f, m, b] = await Promise.all([
      c.from("settings").select("*").eq("id", 1).maybeSingle(),
      c.from("fighters").select("*").order("created_at"),
      c.from("matches").select("*").order("match_no"),
      c.from("bets").select("*").order("created_at"),
    ]);
    const err = s.error || f.error || m.error || b.error;
    if (err) setMsg({ text: "Gagal memuat data: " + err.message, err: true });
    setData({ settings: s.data, fighters: f.data ?? [], matches: m.data ?? [], bets: b.data ?? [] });
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const notify = useCallback((text: string, err?: boolean) => {
    setMsg({ text, err });
    if (!err) setTimeout(() => setMsg(null), 3500);
  }, []);

  const props: TabProps = { data, reload, notify };

  return (
    <div className="wrap">
      <div className="admin-top">
        <h1>Panel Panitia 1C</h1>
        <div className="row-actions">
          <a className="btn ghost" href="/" target="_blank" rel="noreferrer">Lihat halaman penonton</a>
          <button className="btn ghost" onClick={() => sb().auth.signOut()}>Keluar</button>
        </div>
      </div>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={"tab" + (tab === t.key ? " active" : "")} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>
      {msg && <div className={"notice" + (msg.err ? " err" : "")} role="status">{msg.text}</div>}
      {tab === "fighters" && <FightersTab {...props} />}
      {tab === "bracket" && <BracketTab {...props} />}
      {tab === "betting" && <BettingTab {...props} />}
      {tab === "settings" && <SettingsTab {...props} />}
    </div>
  );
}
