"use client";
import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { sb } from "@/lib/supabase";
import { api } from "@/lib/api";
import type { AdminData, Me, TabProps } from "@/lib/adminTypes";
import { loadAdmin } from "@/lib/data";
import { isBye } from "@/lib/fight";
import FightersTab from "@/components/admin/FightersTab";
import BracketTab from "@/components/admin/BracketTab";
import BettingTab from "@/components/admin/BettingTab";
import ArchiveTab from "@/components/admin/ArchiveTab";
import TournamentTab from "@/components/admin/TournamentTab";
import SponsorsTab from "@/components/admin/SponsorsTab";
import SettingsTab from "@/components/admin/SettingsTab";
import AccountsTab from "@/components/admin/AccountsTab";
import { BrandMark } from "@/components/site/SiteChrome";
import Stamp from "@/components/ui/Stamp";

const TABS = [
  { key: "fighters", label: "Pendaftaran", superOnly: false },
  { key: "bracket", label: "Bracket", superOnly: false },
  { key: "betting", label: "Taruhan", superOnly: false },
  { key: "archive", label: "Arsip", superOnly: false },
  { key: "tournament", label: "Turnamen", superOnly: true },
  { key: "sponsors", label: "Sponsor", superOnly: true },
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
    case "loading": return <div className="gate-msg"><p className="empty-state">Ngecek akses…</p></div>;
    case "error": return (
      <div className="gate-msg">
        <div className="notice err">{phase.message}</div>
        <button className="btn ghost" onClick={() => location.reload()}>Coba lagi</button>
      </div>
    );
    case "setup": return <Setup />;
    case "login": return <Login />;
    case "notadmin": return (
      <div className="gate-msg">
        <div className="notice err">Akun ini bukan akun panitia.</div>
        <button className="btn" onClick={() => sb().auth.signOut()}>Keluar</button>
      </div>
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
    <div className="gate">
      <div className="gate-type">
        <h1>Kunci<br />basement</h1>
        <p>Halaman ini cuma muncul sekali. Akun pertama jadi superadmin: pegang semua operasional, pengaturan, dan akun panitia lain.</p>
        <Stamp tone="red" tilt={-5}><span className="jp">地下</span><span>Khusus panitia</span></Stamp>
      </div>
      <form className="gate-form" onSubmit={submit}>
        <h2>Bikin akun superadmin</h2>
        <p className="hint">Email cuma buat sistem Supabase. Login tetap pakai username.</p>
        {err && <div className="notice err" role="alert">{err}</div>}
        <label className="f">Username<input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="username" /></label>
        <label className="f">Email kamu<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label>
        <label className="f">Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" /></label>
        <label className="f">Ulangi password<input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} autoComplete="new-password" /></label>
        <button className="btn" disabled={busy}>{busy ? "Membuat akun…" : "Bikin akun & masuk"}</button>
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
    <div className="gate">
      <div className="gate-type">
        <h1>Khusus<br />panitia</h1>
        <p>Penonton gak perlu login. Balik ke <a href="/">halaman utama</a> buat lihat bracket dan hasil.</p>
        <Stamp tone="red" tilt={-5}><span className="jp">地下格闘</span><span>Dilarang masuk</span></Stamp>
      </div>
      <form className="gate-form" onSubmit={submit}>
        <h2>Masuk panel</h2>
        <p className="hint">Pakai username dan password dari superadmin.</p>
        {err && <div className="notice err" role="alert">{err}</div>}
        <label className="f">Username<input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} /></label>
        <label className="f">Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" /></label>
        <button className="btn" disabled={busy}>{busy ? "Masuk…" : "Masuk"}</button>
      </form>
    </div>
  );
}

function Dashboard({ me }: { me: Me }) {
  const isSuper = me.role === "superadmin";
  const tabs = TABS.filter((t) => isSuper || !t.superOnly);
  const [tab, setTab] = useState<TabKey>("fighters");
  const [data, setData] = useState<AdminData>({
    settings: null, fighters: [], matches: [], bets: [], betLog: [], tournaments: [], tournament: null, history: null,
    sponsors: [], sponsorsReady: true, schemaReady: true,
  });
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);

  const reload = useCallback(async () => {
    const { error, ...d } = await loadAdmin();
    if (error) setMsg({ text: "Gagal memuat data: " + error, err: true });
    setData(d);
    setLoaded(true);
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

  const playable = data.matches.filter((m) => !isBye(m));
  const counts: Partial<Record<TabKey, string>> = {
    fighters: String(data.fighters.length),
    bracket: playable.length ? `${playable.filter((m) => m.winner_id).length}/${playable.length}` : undefined,
    betting: data.bets.length ? String(data.bets.length) : undefined,
    archive: data.history?.length ? String(data.history.length) : undefined,
    sponsors: data.sponsors.length ? String(data.sponsors.length) : undefined,
  };
  const hints: Record<TabKey, string> = {
    fighters: "Daftarin fighter, upload fotonya, terus tandai yang udah bayar.",
    bracket: isSuper
      ? "Generate bracket sekali setelah pendaftaran ditutup. Tiap fight: panggil ke ring, mulai, lalu klik Menang buat fighter yang menang."
      : "Tiap fight: panggil ke ring, mulai, lalu klik Menang buat fighter yang menang.",
    betting: "Catat taruhan sebelum fight mulai. Setelah fight selesai, transfer payout lalu tandai Sudah dibayar.",
    archive: "Catatan resmi semua fight yang udah selesai. Keisi sendiri tiap hasil dimasukin.",
    tournament: "Ganti nama turnamen, tutup turnamen yang jalan, dan mulai yang baru.",
    sponsors: "Sponsor turnamen yang lagi jalan. Nama, foto, dan jumlah sponsornya tampil di halaman penonton.",
    settings: "Foto hero, nama event, tagline, biaya daftar, dan house cut default.",
    accounts: "Tambah, hapus, atau ganti password akun panitia.",
  };
  const current = tabs.find((t) => t.key === tab) ?? tabs[0];

  return (
    <div className="admin">
      <aside className="admin-side">
        <a className="admin-brand" href="/" target="_blank" rel="noreferrer" aria-label="Buka halaman penonton">
          <BrandMark />
          <span><span className="nav-name">Panel panitia</span><small>Underground</small></span>
        </a>
        <div className="admin-who">
          <b>{me.username}</b>
          <span className={`role-${me.role}`}>{isSuper ? "Superadmin" : "Admin"}</span>
        </div>
        <nav className="admin-tabs" aria-label="Menu panel">
          {tabs.map((t) => (
            <button key={t.key} className={"admin-tab" + (tab === t.key ? " is-on" : "")} aria-current={tab === t.key ? "page" : undefined} onClick={() => setTab(t.key)}>
              {t.label}
              {counts[t.key] && <small>{counts[t.key]}</small>}
            </button>
          ))}
        </nav>
        <div className="admin-side-foot">
          <a className="btn ghost sm" href="/" target="_blank" rel="noreferrer">Halaman penonton</a>
          <button className="btn ghost sm" onClick={() => sb().auth.signOut()}>Keluar</button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-head">
          <h1>{current.label}</h1>
          <p>{hints[current.key]}</p>
        </header>
        {loaded && !data.schemaReady && (
          <div className="notice err" role="alert">
            <strong>Database belum di-update.</strong> Status fight, cara menang, arsip, turnamen, dan riwayat transaksi baru aktif
            setelah isi <code>supabase/schema.sql</code> di-Run ulang di Supabase &gt; SQL Editor. Data lama aman, gak ada yang kehapus.
          </div>
        )}
        {msg && <div className={"notice" + (msg.err ? " err" : "")} role="status">{msg.text}</div>}
        {tab === "fighters" && <FightersTab {...props} />}
        {tab === "bracket" && <BracketTab {...props} />}
        {tab === "betting" && <BettingTab {...props} />}
        {tab === "archive" && <ArchiveTab {...props} />}
        {tab === "tournament" && isSuper && <TournamentTab {...props} />}
        {tab === "sponsors" && isSuper && <SponsorsTab {...props} />}
        {tab === "settings" && isSuper && <SettingsTab {...props} />}
        {tab === "accounts" && isSuper && <AccountsTab {...props} />}
      </main>
    </div>
  );
}
