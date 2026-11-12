"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Avatar from "@/components/Avatar";
import { sb } from "@/lib/supabase";
import type { Fighter, Match, Pool, Settings } from "@/lib/types";
import { podium, roundLabel, totalRounds } from "@/lib/bracket";
import { multiplier, yen } from "@/lib/betting";

type Data = { settings: Settings | null; fighters: Fighter[]; matches: Match[]; pools: Pool[] };

export default function SpectatorPage() {
  const [data, setData] = useState<Data>({ settings: null, fighters: [], matches: [], pools: [] });
  const [status, setStatus] = useState<"loading" | "live" | "error">("loading");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const [roundKey, setRoundKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const c = sb();
      const [s, f, m, p] = await Promise.all([
        c.from("settings").select("*").eq("id", 1).maybeSingle(),
        c.from("fighters").select("id,name,group_name,photo_url"),
        c.from("matches").select("*").order("match_no"),
        c.from("match_pools").select("*"),
      ]);
      const err = s.error || f.error || m.error || p.error;
      if (err) throw err;
      setData({ settings: s.data, fighters: f.data ?? [], matches: m.data ?? [], pools: p.data ?? [] });
      setStatus("live");
      setUpdatedAt(Date.now());
    } catch (e) {
      console.error(e);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
    const poll = setInterval(load, 30000); // pool taruhan diperbarui tiap 30 detik
    const clock = setInterval(() => setTick((t) => t + 1), 5000);
    let channel: ReturnType<ReturnType<typeof sb>["channel"]> | null = null;
    try {
      channel = sb()
        .channel("public-live")
        .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => load())
        .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, () => load())
        .subscribe();
    } catch {}
    return () => {
      clearInterval(poll);
      clearInterval(clock);
      if (channel) sb().removeChannel(channel);
    };
  }, [load]);

  const { settings, fighters, matches, pools } = data;
  const byId = useMemo(() => new Map(fighters.map((f) => [f.id, f])), [fighters]);
  const poolOf = useMemo(() => new Map(pools.map((p) => [p.match_id, p])), [pools]);
  const total = totalRounds(matches);
  const name = (id: string | null) => (id ? byId.get(id)?.name ?? "?" : null);

  const rounds = useMemo(() => {
    const groups: { key: string; label: string; items: Match[] }[] = [];
    for (const m of matches) {
      const key = `${m.kind}-${m.round}`;
      let g = groups.find((x) => x.key === key);
      if (!g) groups.push((g = { key, label: roundLabel(m.round, total, m.kind), items: [] }));
      g.items.push(m);
    }
    return groups;
  }, [matches, total]);

  // default tab: ronde paling awal yang masih ada match belum selesai
  const activeKey = roundKey ?? rounds.find((g) => g.items.some((m) => !m.winner_id && m.fighter1_id && m.fighter2_id))?.key ?? rounds[0]?.key;
  const activeRound = rounds.find((g) => g.key === activeKey);
  const featured = matches.filter((m) => m.featured);
  const pod = podium(matches);
  const bettable = matches.filter((m) => m.fighter1_id && m.fighter2_id && (poolOf.get(m.id)?.bet_count ?? 0) > 0);
  const hero = settings?.hero_url;

  const ago = updatedAt ? Math.round((Date.now() - updatedAt) / 1000) : null;
  void tick;

  return (
    <div className="wrap">
      <div className={"hero" + (hero ? " has-image" : "")}>
        {hero && <div className="hero-bg" style={{ backgroundImage: `url("${hero}")` }} />}
        {hero && <div className="hero-scrim" />}
        <div className="hero-content">
          <div className="kicker">
            <span className="pulse-dot" aria-hidden="true" />
            <span>{status === "live" ? "LIVE" : status === "error" ? "GAGAL MEMUAT DATA" : "MEMUAT DATA..."}</span>
            {ago !== null && <span>· {ago < 5 ? "baru saja diperbarui" : ago < 60 ? `diperbarui ${ago} detik lalu` : `diperbarui ${Math.round(ago / 60)} menit lalu`}</span>}
          </div>
          <h1 className="display">
            {splitTitle(settings?.event_name ?? "1C UNDERGROUND FIGHT")}
          </h1>
          <p className="tag">{settings?.tagline}</p>
        </div>
      </div>

      {featured.length > 0 && (
        <section>
          <div className="sec-head"><h2>Pertandingan Hari Ini</h2><span className="sub">Dipanggil ke arena</span></div>
          <div className="today-scroll">
            {featured.map((m) => {
              const done = !!m.winner_id;
              const p = poolOf.get(m.id);
              const side = (fid: string | null) => (done ? (m.winner_id === fid ? "winner" : "loser") : "");
              return (
                <div className="poster-card" key={m.id}>
                  <div className={"poster-status" + (done ? " done" : "")}>
                    <span className="dot" />
                    {done ? `SELESAI · MENANG ${name(m.winner_id)}` : "SEDANG BERLANGSUNG"}
                  </div>
                  <div className="poster-face">
                    {[m.fighter1_id, m.fighter2_id].map((fid, i) => (
                      <PosterFighter key={i} f={fid ? byId.get(fid) : undefined} cls={side(fid)} />
                    )).reduce<React.ReactNode[]>((acc, el, i) => (i ? [...acc, <div className="poster-vs" key="vs">VS</div>, el] : [el]), [])}
                  </div>
                  <div className="poster-foot">
                    MATCH {m.match_no} · {roundLabel(m.round, total, m.kind)}
                    {p && p.bet_count > 0 ? ` · Pool ${yen(p.pool1 + p.pool2)}` : ""}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <div className="sec-head"><h2>Juara</h2><span className="sub">Final &amp; perebutan juara 3</span></div>
        <div className="podium">
          <PodiumCard cls="second" label="Juara 2" f={pod.second ? byId.get(pod.second) : undefined} />
          <PodiumCard cls="first" label="Juara 1" f={pod.first ? byId.get(pod.first) : undefined} />
          <PodiumCard cls="third" label="Juara 3" f={pod.third ? byId.get(pod.third) : undefined} />
        </div>
      </section>

      <section>
        <div className="sec-head"><h2>Bracket</h2><span className="sub">Pilih ronde untuk lihat matchup</span></div>
        {rounds.length === 0 ? (
          <div className="empty-state">Bracket belum dibuat panitia.</div>
        ) : (
          <>
            <div className="tabs">
              {rounds.map((g) => (
                <button key={g.key} className={"tab" + (g.key === activeKey ? " active" : "")} aria-pressed={g.key === activeKey} onClick={() => setRoundKey(g.key)}>
                  {g.label}
                </button>
              ))}
            </div>
            <div className="match-grid">
              {activeRound?.items.map((m) => <MatchCard key={m.id} m={m} byId={byId} />)}
            </div>
          </>
        )}
      </section>

      <section>
        <div className="sec-head"><h2>Odds Taruhan</h2><span className="sub">Modal balik utuh + bagian dari pool lawan kalau jagoanmu menang</span></div>
        {bettable.length === 0 ? (
          <div className="empty-state">Belum ada taruhan yang dibuka.</div>
        ) : (
          <div className="odds-list">
            {bettable.map((m) => {
              const p = poolOf.get(m.id)!;
              const sum = p.pool1 + p.pool2;
              const pctA = sum ? Math.round((p.pool1 / sum) * 100) : 50;
              const mA = multiplier(p.pool1, p.pool2, m.house_cut);
              const mB = multiplier(p.pool2, p.pool1, m.house_cut);
              const cls = (fid: string | null) => (m.winner_id ? (m.winner_id === fid ? "win" : "los") : "");
              const f1 = byId.get(m.fighter1_id!);
              const f2 = byId.get(m.fighter2_id!);
              return (
                <div className="odds-card" key={m.id}>
                  <div className="odds-top"><span>MATCH {m.match_no} · {roundLabel(m.round, total, m.kind)}</span><span>{m.winner_id ? "Selesai" : `${p.bet_count} taruhan`}</span></div>
                  <div className="odds-fighters">
                    <span className={"fighter-id " + cls(m.fighter1_id)}><Avatar name={f1?.name} url={f1?.photo_url} /><span className="nm">{f1?.name}</span></span>
                    <span className={"fighter-id " + cls(m.fighter2_id)}><span className="nm">{f2?.name}</span><Avatar name={f2?.name} url={f2?.photo_url} /></span>
                  </div>
                  <div className="pool-bar"><div className="a" style={{ width: `${pctA}%` }} /><div className="b" style={{ width: `${100 - pctA}%` }} /></div>
                  <div className="odds-bottom">
                    <span><span className="amt mono">{yen(p.pool1)}</span> · menang: <span className="amt mono">{mA ? `x${mA.toFixed(2)}` : "-"}</span></span>
                    <span><span className="amt mono">{yen(p.pool2)}</span> · menang: <span className="amt mono">{mB ? `x${mB.toFixed(2)}` : "-"}</span></span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <footer>Dikelola panitia Class 1-C. Data update otomatis — gak perlu refresh. Mau pasang taruhan? Cari Finance Betting di lokasi.</footer>
    </div>
  );
}

function splitTitle(t: string) {
  const words = t.trim().split(/\s+/);
  if (words.length < 2) return t;
  const last = words.pop();
  return (<>{words.join(" ")}<br /><span>{last}</span></>);
}

function PosterFighter({ f, cls }: { f?: Fighter; cls: string }) {
  return (
    <div className={"poster-fighter " + cls}>
      <Avatar name={f?.name ?? "?"} url={f?.photo_url} large />
      <div className="nm">{f?.name ?? "TBD"}</div>
    </div>
  );
}

function PodiumCard({ cls, label, f }: { cls: string; label: string; f?: Fighter }) {
  return (
    <div className={"podium-card " + cls}>
      {f && <Avatar name={f.name} url={f.photo_url} large />}
      <div className="rank-label">{label}</div>
      <div className={"rank-name" + (f ? "" : " pending")}>{f ? f.name : "Belum ditentukan"}</div>
    </div>
  );
}

function MatchCard({ m, byId }: { m: Match; byId: Map<string, Fighter> }) {
  const isBye = m.kind === "main" && m.round === 1 && m.fighter1_id && !m.fighter2_id;
  if (!m.fighter1_id && !m.fighter2_id) {
    return <div className="match-card empty"><div className="mno">MATCH {m.match_no}</div>Menunggu pemenang ronde sebelumnya</div>;
  }
  const row = (fid: string | null) => {
    const f = fid ? byId.get(fid) : undefined;
    const lose = m.winner_id && fid && m.winner_id !== fid;
    return (
      <div className={"fighter-row" + (lose ? " loser" : "")}>
        <span className="fighter-id">{f && <Avatar name={f.name} url={f.photo_url} />}<span className="nm">{f?.name ?? (isBye ? "BYE" : "TBD")}</span></span>
        {m.winner_id && fid === m.winner_id && !isBye && <span className="stamp">MENANG</span>}
      </div>
    );
  };
  return (
    <div className="match-card">
      <div className="mno">MATCH {m.match_no}{isBye ? " · LOLOS OTOMATIS" : ""}</div>
      {row(m.fighter1_id)}
      <div className="vs">VS</div>
      {row(m.fighter2_id)}
    </div>
  );
}
