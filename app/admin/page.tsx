"use client";
import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { sb } from "@/lib/supabase";
import { api } from "@/lib/api";
import type { AdminData, Me, TabProps } from "@/lib/adminTypes";
import FightersTab from "@/components/admin/FightersTab";
import BracketTab from "@/components/admin/BracketTab";
import BettingTab from "@/components/admin/BettingTab";
import SettingsTab from "@/components/admin/SettingsTab";
import AccountsTab from "@/components/admin/AccountsTab";

const TABS = [
  { key: "fighters", label: "Pendaftaran", superOnly: false },
  { key: "bracket", label: "Bracket", superOnly: false },
  { key: "betting", label: "Taruhan", superOnly: false },
  { key: "settings", label: "Pengaturan", superOnly: true },
  { key: "accounts", label: "Akun Admin", superOnly: true },
] as const;
type TabKey = (typeof TABS)[number]["key"];

type Phase =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "setup" }
  | { kind: "login" }
  | { kind: "notadmin" }
  | { kind: "ready"; me: Me };

export default function AdminPage() {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });

  const evaluate = useCallback(async (session: Session | null) => {
    try {
      const { needsSetup } = await api<{ needsSetup: boolean }>("/api/setup", "GET");
      if (needsSetup) return setPhase({ kind: "setup" });
      if (!session) return setPhase({ kind: "login" });
      const { data, error } = await sb().from("admin_accounts").select("user_id,username,role").eq("user_id", session.user.id).maybeSingle();
      if (error) throw error;
      setPhase(data ? { kind: "ready", me: data as Me } : { kind: "notadmin" });
    } catch (e) {
      setPhase({ kind: "error", message: (e as Error).message });
    }
  }, []);

  useEffect(() => {
    let unsub = () => {};
    try {
      sb().auth.getSession().then(({ data }) => evaluate(data.session));
      const { data } = sb().auth.onAuthStateChange((event, s) => {
        if (event === "SIGNED_IN" || event === "SIGNED_OUT") evaluate(s);
      });
      unsub = () => data.subscription.unsubscribe();
    } catch (e) {
      setPhase({ kind: "error", message: (e as Error).message });
    }
    return () => unsub();
  }, [evaluate]);

  switch (phase.kind) {
    case "loading": return <div className="wrap"><div className="empty-state">Memuat…</div></div>;
    case "error": return (
      <div className="wrap"><div className="notice err">{phase.message}</div>
        <button className="btn ghost" onClick={() => location.reload()}>Coba lagi</button></div>
    );
    case "setup": return <Setup />;
    case "login": return <Login />;
    case "notadmin": return (
      <div className="wrap"><div className="card login-box">
        <p>Akun ini bukan admin 1C.</p>
        <button className="btn" onClick={() => sb().auth.signOut()}>Keluar</button>
      </div></div>
    );
    case "ready": return <Dashboard me={phase.me} />;
  }
}

async function loginWith(username: string, password: string) {
  const t = await api<{ access_token: string; refresh_token: string }>("/api/login", "POST", { username, password });
  const { error } = await sb().auth.setSession(t);
  if (error) throw error;
}

function Setup() {
  const [username, setUsername] = useState("Hito Kassa");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) return setErr("Password dan ulangi password beda.");
    setBusy(true);
    setErr(null);
    try {
      await api("/api/setup", "POST", { username, email, password });
      await loginWith(username, password);
    } catch (e2) {
      setErr((e2 as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="wrap">
      <form className="card login-box" onSubmit={submit}>
        <h1 className="display" style={{ fontSize: 32, margin: "0 0 4px" }}>Bikin akun superadmin</h1>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0 }}>
          Cuma muncul sekali. Superadmin bisa ngelola semua operasional, pengaturan, dan akun admin.
        </p>
        {err && <div className="notice err">{err}</div>}
        <label className="f" style={{ marginBottom: 10 }}>Username<input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="username" /></label>
        <label className="f" style={{ marginBottom: 4 }}>Email kamu<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label>
        <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 10px" }}>Cuma buat sistem Supabase, gak dipakai login dan gak tampil di website.</p>
        <label className="f" style={{ marginBottom: 10 }}>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" /></label>
        <label className="f" style={{ marginBottom: 14 }}>Ulangi password<input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} autoComplete="new-password" /></label>
        <button className="btn" style={{ width: "100%" }} disabled={busy}>{busy ? "Membuat…" : "Bikin akun & masuk"}</button>
      </form>
    </div>
  );
}

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await loginWith(username, password);
    } catch (e2) {
      setErr((e2 as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="wrap">
      <form className="card login-box" onSubmit={submit}>
        <h1 className="display" style={{ fontSize: 32, margin: "0 0 4px" }}>Panel Panitia 1C</h1>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0 }}>Khusus panitia. Penonton balik ke halaman utama.</p>
        {err && <div className="notice err">{err}</div>}
        <label className="f" style={{ marginBottom: 10 }}>Username<input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} /></label>
        <label className="f" style={{ marginBottom: 14 }}>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" /></label>
        <button className="btn" style={{ width: "100%" }} disabled={busy}>{busy ? "Masuk…" : "Masuk"}</button>
      </form>
    </div>
  );
}

function Dashboard({ me }: { me: Me }) {
  const isSuper = me.role === "superadmin";
  const tabs = TABS.filter((t) => isSuper || !t.superOnly);
  const [tab, setTab] = useState<TabKey>("fighters");
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

  // Data dari admin lain ikut muncul tanpa refresh:
  // realtime buat matches & bets, plus polling tiap 10 detik + saat tab dibuka lagi (buat fighters dll).
  useEffect(() => {
    reload();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const soon = () => { if (timer) clearTimeout(timer); timer = setTimeout(reload, 300); };
    const onVisible = () => { if (document.visibilityState === "visible") reload(); };
    const poll = setInterval(() => { if (document.visibilityState === "visible") reload(); }, 10000);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    const c = sb();
    const channel = c
      .channel("admin-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, soon)
      .on("postgres_changes", { event: "*", schema: "public", table: "bets" }, soon)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      c.removeChannel(channel);
    };
  }, [reload]);

  const notify = useCallback((text: string, err?: boolean) => {
    setMsg({ text, err });
    if (!err) setTimeout(() => setMsg(null), 3500);
  }, []);

  const props: TabProps = { me, data, reload, notify };

  return (
    <div className="wrap">
      <div className="admin-top">
        <div>
          <h1>Panel Panitia 1C</h1>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>
            Masuk sebagai <strong style={{ color: "var(--ink)" }}>{me.username}</strong> · {isSuper ? "Superadmin" : "Admin"}
          </div>
        </div>
        <div className="row-actions">
          <a className="btn ghost" href="/" target="_blank" rel="noreferrer">Lihat halaman penonton</a>
          <button className="btn ghost" onClick={() => sb().auth.signOut()}>Keluar</button>
        </div>
      </div>
      <div className="tabs">
        {tabs.map((t) => (
          <button key={t.key} className={"tab" + (tab === t.key ? " active" : "")} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>
      {msg && <div className={"notice" + (msg.err ? " err" : "")} role="status">{msg.text}</div>}
      {tab === "fighters" && <FightersTab {...props} />}
      {tab === "bracket" && <BracketTab {...props} />}
      {tab === "betting" && <BettingTab {...props} />}
      {tab === "settings" && isSuper && <SettingsTab {...props} />}
      {tab === "accounts" && isSuper && <AccountsTab {...props} />}
    </div>
  );
}
