"use client";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { sb } from "@/lib/supabase";
import { api } from "@/lib/api";
import type { AdminData, Intent, Me, TabKey, TabProps } from "@/lib/adminTypes";
import { loadAdmin } from "@/lib/data";
import { isBye, isReady, matchCode, statusOf } from "@/lib/fight";
import { settleMatch, yen } from "@/lib/betting";
import FightersTab from "@/components/admin/FightersTab";
import BracketTab from "@/components/admin/BracketTab";
import BettingTab from "@/components/admin/BettingTab";
import ArchiveTab from "@/components/admin/ArchiveTab";
import TournamentTab from "@/components/admin/TournamentTab";
import SponsorsTab from "@/components/admin/SponsorsTab";
import SettingsTab from "@/components/admin/SettingsTab";
import AccountsTab from "@/components/admin/AccountsTab";
import Toasts, { useToasts } from "@/components/admin/Toasts";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import Modal from "@/components/ui/Modal";
import { BrandMark } from "@/components/site/SiteChrome";
import Stamp from "@/components/ui/Stamp";

type TabDef = {
  key: TabKey;
  /** alamat tab di URL: /admin#taruhan. Refresh atau kirim link tetap di tab yang sama. */
  slug: string;
  label: string;
  /** label pendek buat menu bawah di HP */
  short: string;
  superOnly: boolean;
  hint: (isSuper: boolean) => string;
  view: React.ComponentType<TabProps>;
};

const TABS: TabDef[] = [
  { key: "fighters", slug: "pendaftaran", label: "Pendaftaran", short: "Daftar", superOnly: false, view: FightersTab,
    hint: () => "Daftarin fighter, lalu tandai yang udah bayar. Cuma yang udah bayar yang masuk bracket." },
  { key: "bracket", slug: "bracket", label: "Bracket", short: "Bracket", superOnly: false, view: BracketTab,
    hint: (s) => (s ? "Buat bracket sekali setelah pendaftaran ditutup. Tiap fight: mulai, lalu catat pemenangnya." : "Tiap fight: mulai, lalu catat pemenangnya.") },
  { key: "betting", slug: "taruhan", label: "Taruhan", short: "Taruhan", superOnly: false, view: BettingTab,
    hint: () => "Catat taruhan sebelum fight mulai. Setelah fight selesai, bayar yang menang lalu tandai sudah dibayar." },
  { key: "archive", slug: "arsip", label: "Arsip", short: "Arsip", superOnly: false, view: ArchiveTab,
    hint: () => "Catatan resmi semua fight yang udah selesai. Keisi sendiri tiap hasil dicatat." },
  { key: "tournament", slug: "turnamen", label: "Turnamen", short: "Turnamen", superOnly: true, view: TournamentTab,
    hint: () => "Nama turnamen yang lagi jalan, mulai turnamen baru, dan arsip turnamen lama." },
  { key: "sponsors", slug: "sponsor", label: "Sponsor & Hadiah", short: "Sponsor", superOnly: true, view: SponsorsTab,
    hint: () => "Sponsor turnamen ini dan hitungan hadiah juara. Dua-duanya tampil di halaman penonton." },
  { key: "settings", slug: "pengaturan", label: "Pengaturan", short: "Atur", superOnly: true, view: SettingsTab,
    hint: () => "Foto hero, nama event, tagline, biaya daftar, dan potongan kas taruhan." },
  { key: "accounts", slug: "akun", label: "Akun Admin", short: "Akun", superOnly: true, view: AccountsTab,
    hint: () => "Tambah, hapus, atau ganti password akun panitia." },
];
/** jumlah tab yang muat di menu bawah HP; sisanya masuk "Lainnya" */
const BAR_TABS = 4;

type Phase =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "setup" }
  | { kind: "login" }
  | { kind: "notadmin" }
  | { kind: "ready"; me: Me };

export default function AdminPage() {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const ready = useRef(false);

  /** quiet = cek ulang di belakang layar: kalau gagal (misal koneksi putus sebentar), panel yang lagi kebuka gak diganggu. */
  const evaluate = useCallback(async (session: Session | null, quiet = false) => {
    try {
      const { needsSetup } = await api<{ needsSetup: boolean }>("/api/setup", "GET");
      if (needsSetup) { ready.current = false; return setPhase({ kind: "setup" }); }
      if (!session) { ready.current = false; return setPhase({ kind: "login" }); }
      const { data, error } = await sb().from("admin_accounts").select("user_id,username,role").eq("user_id", session.user.id).maybeSingle();
      if (error) throw error;
      const me = data as Me | null;
      ready.current = !!me;
      setPhase((prev) => {
        if (!me) return { kind: "notadmin" };
        // akun & role sama → objek lama dipakai lagi, biar panel gak dirender ulang tanpa perlu
        if (prev.kind === "ready" && prev.me.user_id === me.user_id && prev.me.role === me.role && prev.me.username === me.username) return prev;
        return { kind: "ready", me };
      });
    } catch (e) {
      if (quiet && ready.current) return;
      setPhase({ kind: "error", message: (e as Error).message });
    }
  }, []);

  useEffect(() => {
    let unsub = () => {};
    try {
      sb().auth.getSession().then(({ data }) => evaluate(data.session));
      const { data } = sb().auth.onAuthStateChange((event, s) => {
        // jangan panggil query Supabase langsung di dalam callback auth (bisa saling nunggu) → tunda sebentar
        if (event === "SIGNED_OUT") setTimeout(() => evaluate(null), 0);
        else if (event === "SIGNED_IN") setTimeout(() => evaluate(s, true), 0);
      });
      unsub = () => data.subscription.unsubscribe();
    } catch (e) {
      setPhase({ kind: "error", message: (e as Error).message });
    }
    return () => unsub();
  }, [evaluate]);

  switch (phase.kind) {
    case "loading": return <div className="gate-msg"><p className="admin-loading" role="status">Ngecek akses…</p></div>;
    case "error": return (
      <div className="gate-msg">
        <div className="notice err" role="alert">Panel gak bisa dibuka: {phase.message}</div>
        <button className="btn ghost" onClick={() => location.reload()}>Coba lagi</button>
      </div>
    );
    case "setup": return <Setup />;
    case "login": return <Login />;
    case "notadmin": return (
      <div className="gate-msg">
        <div className="notice err" role="alert">Akun ini bukan akun panitia, atau aksesnya udah dicabut.</div>
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
    if (busy) return;
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
        <label className="f">Password (minimal 6 karakter)<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" /></label>
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
    if (busy) return;
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

type NowItem = { key: string; tone: "live" | "warn" | "todo"; text: string; action: string; tab: TabKey; intent?: Intent };

function Dashboard({ me }: { me: Me }) {
  const isSuper = me.role === "superadmin";
  const tabs = useMemo(() => TABS.filter((t) => isSuper || !t.superOnly), [isSuper]);

  /* ---------- tab aktif: disimpan di alamat (#taruhan), jadi refresh & tombol Back tetap nyambung ---------- */
  const [tab, setTab] = useState<TabKey>("fighters");
  const [opened, setOpened] = useState<TabKey[]>(["fighters"]); // tab yang udah pernah dibuka tetap hidup di belakang
  const [intent, setIntent] = useState<(Intent & { tab: TabKey; nonce: number }) | null>(null);
  const nonce = useRef(0);
  const [moreOpen, setMoreOpen] = useState(false);

  const show = useCallback((key: TabKey) => {
    setTab(key);
    setOpened((list) => (list.includes(key) ? list : [...list, key]));
  }, []);

  useEffect(() => {
    const fromHash = () => {
      const slug = decodeURIComponent(location.hash.replace(/^#/, ""));
      const t = tabs.find((x) => x.slug === slug);
      if (t) show(t.key);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [tabs, show]);

  const go = useCallback((key: TabKey, withIntent?: Intent) => {
    const t = TABS.find((x) => x.key === key);
    if (!t) return;
    setMoreOpen(false);
    if (withIntent) setIntent({ ...withIntent, tab: key, nonce: ++nonce.current });
    show(key);
    if (location.hash !== "#" + t.slug) history.pushState(null, "", "#" + t.slug);
    // tab baru mulai dari atas, kecuali niatnya nunjuk ke satu fight (tab tujuan yang nge-scroll ke sana)
    if (!withIntent?.matchId) window.scrollTo(0, 0);
  }, [show]);

  /* ---------- data ---------- */
  const [data, setData] = useState<AdminData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const { toasts, notify, dismiss } = useToasts();
  const { confirm, host: confirmHost } = useConfirm();

  const reload = useCallback(async () => {
    try {
      const { error, warning: warn, ...d } = await loadAdmin();
      if (error) {
        // gagal ambil data inti → data terakhir yang berhasil tetap dipakai, jangan diganti daftar kosong
        setLoadError(error);
        return;
      }
      setLoadError(null);
      setWarning(warn);
      setData(d);
    } catch (e) {
      setLoadError((e as Error).message);
    }
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

  /* ---------- ringkasan: angka di menu + "yang perlu diurus sekarang" ---------- */
  const summary = useMemo(() => {
    if (!data) return null;
    const byId = new Map(data.fighters.map((f) => [f.id, f]));
    const name = (id: string | null) => (id ? byId.get(id)?.name : undefined) ?? "?";
    const playable = data.matches.filter((m) => !isBye(m));
    const done = playable.filter((m) => m.winner_id).length;
    const live = data.matches.filter((m) => isReady(m) && statusOf(m) === "live");
    let owed = 0, slips = 0;
    for (const m of data.matches) {
      const c = settleMatch(m, data.bets.filter((b) => b.match_id === m.id));
      for (const b of c.bets) {
        const p = c.results.get(b.id)?.payout ?? 0;
        if (p > 0 && !b.paid_out) { owed += p; slips++; }
      }
    }
    const unpaid = data.fighters.filter((f) => !f.paid).length;
    const paid = data.fighters.length - unpaid;

    const now: NowItem[] = [];
    for (const m of live) {
      now.push({ key: "live" + m.id, tone: "live", text: `Fight ${matchCode(m.match_no)} lagi jalan: ${name(m.fighter1_id)} lawan ${name(m.fighter2_id)}`, action: "Catat hasil", tab: "bracket", intent: { matchId: m.id } });
    }
    // tandai dibayar cuma superadmin; admin lain cukup lihat daftarnya
    if (slips) now.push({ key: "owed", tone: "warn", text: `${slips} taruhan menang belum dibayar, total ${yen(owed)}`, action: isSuper ? "Bayar" : "Lihat", tab: "betting", intent: { view: "payouts" } });
    if (isSuper && data.schemaReady && !data.matches.length && paid >= 2) {
      now.push({ key: "nobracket", tone: "todo", text: `Bracket belum dibuat. ${paid} fighter udah bayar.`, action: "Buat bracket", tab: "bracket" });
    }
    if (unpaid) now.push({ key: "unpaid", tone: "todo", text: `${unpaid} fighter belum bayar`, action: "Lihat", tab: "fighters", intent: { filter: "unpaid" } });

    const badge: Partial<Record<TabKey, { text: string; say: string; alert?: boolean }>> = {
      fighters: { text: String(data.fighters.length), say: `${data.fighters.length} fighter terdaftar` },
      bracket: playable.length ? { text: `${done}/${playable.length}`, say: `${done} dari ${playable.length} fight selesai${live.length ? `, ${live.length} lagi jalan` : ""}`, alert: live.length > 0 } : undefined,
      betting: slips
        ? { text: String(slips), say: `${slips} taruhan menang belum dibayar`, alert: true }
        : data.bets.length ? { text: String(data.bets.length), say: `${data.bets.length} taruhan` } : undefined,
      archive: data.history?.length ? { text: String(data.history.length), say: `${data.history.length} fight tercatat` } : undefined,
      sponsors: data.sponsors.length ? { text: String(data.sponsors.length), say: `${data.sponsors.length} sponsor` } : undefined,
    };
    return { now, badge };
  }, [data, isSuper]);

  const current = tabs.find((t) => t.key === tab) ?? tabs[0];
  const barTabs = tabs.slice(0, BAR_TABS);
  const moreTabs = tabs.slice(BAR_TABS);
  const inMore = moreTabs.some((t) => t.key === current.key);
  const now = summary?.now.filter((n) => tabs.some((t) => t.key === n.tab)) ?? [];

  const tabButton = (t: TabDef, cls: string, label: string) => {
    const b = summary?.badge[t.key];
    return (
      <button key={t.key} type="button" className={cls + (current.key === t.key ? " is-on" : "")} aria-current={current.key === t.key ? "page" : undefined} onClick={() => go(t.key)}>
        <span>{label}</span>
        {b && (
          <small className={b.alert ? "is-alert" : undefined}>
            <span aria-hidden="true">{b.text}</span>
            <span className="sr-only">, {b.say}</span>
          </small>
        )}
      </button>
    );
  };

  return (
    <div className="admin">
      <aside className="admin-side">
        <a className="admin-brand" href="/" target="_blank" rel="noreferrer" aria-label="Buka halaman penonton di tab baru">
          <BrandMark />
          <span><span className="nav-name">Panel panitia</span><small>Underground</small></span>
        </a>
        <div className="admin-who">
          <b>{me.username}</b>
          <span className={`role-${me.role}`}>{isSuper ? "Superadmin" : "Admin"}</span>
        </div>
        <nav className="admin-tabs" aria-label="Menu panel">
          {tabs.map((t, i) => (
            <Fragment key={t.key}>
              {t.superOnly && i > 0 && !tabs[i - 1].superOnly && <span className="admin-tabs-sep">Khusus superadmin</span>}
              {tabButton(t, "admin-tab", t.label)}
            </Fragment>
          ))}
        </nav>
        <div className="admin-side-foot">
          <a className="btn ghost sm" href="/" target="_blank" rel="noreferrer">Halaman penonton</a>
          <button type="button" className="btn ghost sm" onClick={() => sb().auth.signOut()}>Keluar</button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-head">
          <h1>{current.label}</h1>
          <p>{current.hint(isSuper)}</p>
        </header>

        {loadError && data && (
          <div className="notice err admin-stale" role="status">
            <span>Data terbaru gagal diambil, jadi yang tampil data terakhir yang berhasil dimuat. Panel nyoba lagi sendiri tiap 10 detik.</span>
            <button type="button" className="btn ghost sm" onClick={reload}>Coba sekarang</button>
          </div>
        )}
        {data && !data.schemaReady && (
          <div className="notice err" role="status">
            <strong>Database belum di-update.</strong>{" "}
            {isSuper
              ? <>Status fight, cara menang, arsip, turnamen, dan riwayat transaksi baru aktif setelah isi <code>supabase/schema.sql</code> di-Run ulang di Supabase &gt; SQL Editor. Data lama aman, gak ada yang kehapus.</>
              : <>Beberapa fitur baru belum aktif. Kasih tahu superadmin buat update database.</>}
          </div>
        )}
        {data && warning && <div className="notice" role="status">Sebagian data gagal dimuat: {warning}</div>}

        {now.length > 0 && (
          <ul className="now" aria-label="Yang perlu diurus sekarang">
            {now.map((n) => (
              <li key={n.key} className={`now-item is-${n.tone}`}>
                {n.tone === "live" && <span className="live-dot" aria-hidden="true" />}
                <span className="now-text">{n.text}</span>
                {!(n.tab === current.key && !n.intent) && (
                  <button type="button" className="btn ghost sm" onClick={() => go(n.tab, n.intent)}>{n.action}</button>
                )}
              </li>
            ))}
          </ul>
        )}

        {!data ? (
          loadError ? (
            <div className="admin-first-error">
              <div className="notice err" role="alert">Data panel gak bisa dimuat: {loadError}</div>
              <button type="button" className="btn" onClick={reload}>Coba lagi</button>
            </div>
          ) : (
            <p className="admin-loading" role="status">Ngambil data panel…</p>
          )
        ) : (
          tabs.filter((t) => opened.includes(t.key)).map((t) => {
            const View = t.view;
            const on = t.key === current.key;
            return (
              <section key={t.key} hidden={!on} aria-label={t.label}>
                <View
                  me={me}
                  data={data}
                  reload={reload}
                  notify={notify}
                  confirm={confirm}
                  go={go}
                  intent={intent && intent.tab === t.key ? intent : null}
                  active={on}
                />
              </section>
            );
          })
        )}
      </main>

      {/* menu bawah di HP: tab hari-H selalu satu ketukan */}
      <nav className="admin-bar" aria-label="Menu panel">
        {barTabs.map((t) => tabButton(t, "admin-bar-tab", t.short))}
        <button type="button" className={"admin-bar-tab" + (inMore ? " is-on" : "")} aria-haspopup="dialog" onClick={() => setMoreOpen(true)}>
          <span>{moreTabs.length ? "Lainnya" : "Akun"}</span>
        </button>
      </nav>

      {moreOpen && (
        <Modal onClose={() => setMoreOpen(false)} labelledBy="admin-more-title" className="admin-modal admin-more">
          <h3 id="admin-more-title">{moreTabs.length ? "Menu lainnya" : "Akun"}</h3>
          <p className="admin-more-who">{me.username}, {isSuper ? "superadmin" : "admin"}</p>
          {moreTabs.length > 0 && (
            <div className="admin-more-tabs">
              {moreTabs.map((t) => tabButton(t, "admin-tab", t.label))}
            </div>
          )}
          <div className="row-actions admin-modal-actions">
            <a className="btn ghost" href="/" target="_blank" rel="noreferrer">Halaman penonton</a>
            <button type="button" className="btn ghost" onClick={() => sb().auth.signOut()}>Keluar</button>
          </div>
        </Modal>
      )}

      <Toasts toasts={toasts} onDismiss={dismiss} />
      {confirmHost}
    </div>
  );
}
