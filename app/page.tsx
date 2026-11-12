"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { sb } from "@/lib/supabase";
import type { Fighter, Match, Pool, Settings } from "@/lib/types";
import { podium, roundLabel, totalRounds } from "@/lib/bracket";
import Hero from "@/components/site/Hero";
import FightPoster from "@/components/site/FightPoster";
import BracketBoard from "@/components/site/BracketBoard";
import BettingBoard from "@/components/site/BettingBoard";
import Podium from "@/components/site/Podium";
import { ChainRule, SectionTitle, SiteFooter, SiteNav } from "@/components/site/SiteChrome";

type Data = { settings: Settings | null; fighters: Fighter[]; matches: Match[]; pools: Pool[] };

export default function SpectatorPage() {
  const [data, setData] = useState<Data>({ settings: null, fighters: [], matches: [], pools: [] });
  const [status, setStatus] = useState<"loading" | "live" | "error">("loading");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [, setTick] = useState(0);

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

  const playable = matches.filter((m) => !(m.kind === "main" && m.round === 1 && m.fighter1_id && !m.fighter2_id)); // tanpa BYE
  const doneCount = playable.filter((m) => m.winner_id).length;
  const poolTotal = pools.reduce((s, p) => s + p.pool1 + p.pool2, 0);
  const featured = matches.filter((m) => m.featured && m.fighter1_id && m.fighter2_id);
  const pod = podium(matches);
  const decided = !!pod.first;
  const hasBets = pools.some((p) => p.bet_count > 0);

  const ago = updatedAt ? Math.round((Date.now() - updatedAt) / 1000) : null;
  const agoText = ago === null ? null : ago < 5 ? "barusan" : ago < 60 ? `${ago} detik lalu` : `${Math.round(ago / 60)} menit lalu`;

  const champions = (
    <section className="block block-podium" aria-labelledby="juara">
      <div className="wrap">
        <SectionTitle id="juara" aside={decided ? "Turnamen selesai." : "Muncul otomatis setelah final."}>Juara</SectionTitle>
        <Podium
          first={pod.first ? byId.get(pod.first) : undefined}
          second={pod.second ? byId.get(pod.second) : undefined}
          third={pod.third ? byId.get(pod.third) : undefined}
        />
      </div>
    </section>
  );

  const sections = [
    ...(featured.length ? [{ id: "ring", label: "Ring" }] : []),
    ...(decided ? [{ id: "juara", label: "Juara" }] : []),
    { id: "bracket", label: "Bracket" },
    { id: "taruhan", label: "Taruhan" },
    ...(!decided ? [{ id: "juara", label: "Juara" }] : []),
  ];

  return (
    <>
      <SiteNav status={status} ago={agoText} sections={sections} />
      <Hero
        eventName={settings?.event_name ?? "Underground"}
        tagline={settings?.tagline}
        heroUrl={settings?.hero_url}
        fighters={fighters.length}
        done={doneCount}
        total={playable.length}
        pool={poolTotal}
      />
      <ChainRule />

      <main>
        {status === "error" && (
          <div className="wrap"><p className="alert">Data gak bisa dimuat. Cek koneksi, halaman ini nyoba lagi tiap 30 detik.</p></div>
        )}

        {featured.length > 0 && (
          <section className="block block-ring" aria-labelledby="ring">
            <div className="wrap">
              <SectionTitle id="ring" aside={featured.length > 1 ? `${featured.length} fight dipanggil` : "Dipanggil panitia"}>
                Lagi di ring
              </SectionTitle>
              <div className={`posters${featured.length === 1 ? " is-single" : ""}`}>
                {featured.map((m) => (
                  <FightPoster
                    key={m.id}
                    m={m}
                    f1={m.fighter1_id ? byId.get(m.fighter1_id) : undefined}
                    f2={m.fighter2_id ? byId.get(m.fighter2_id) : undefined}
                    pool={poolOf.get(m.id)}
                    round={roundLabel(m.round, total, m.kind)}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {decided && champions}

        <section className="block block-bracket" aria-labelledby="bracket">
          <div className="wrap">
            <SectionTitle id="bracket" aside={matches.length ? `${doneCount} dari ${playable.length} fight selesai` : undefined}>
              Bracket
            </SectionTitle>
            <BracketBoard matches={matches} byId={byId} />
          </div>
        </section>

        <section className="block block-bets" aria-labelledby="taruhan">
          <div className="wrap">
            <SectionTitle
              id="taruhan"
              aside={hasBets ? "Jagoan menang: modal balik utuh, ditambah bagian dari uang pihak yang kalah." : undefined}
            >
              Meja taruhan
            </SectionTitle>
            <BettingBoard matches={matches} byId={byId} poolOf={poolOf} />
            <p className="bets-how">Pasang taruhan langsung ke Finance Betting di lokasi. Nama kamu gak bakal muncul di sini.</p>
          </div>
        </section>

        {!decided && champions}
      </main>

      <SiteFooter />
    </>
  );
}
