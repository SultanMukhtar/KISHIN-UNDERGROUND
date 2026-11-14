"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { sb } from "@/lib/supabase";
import { EMPTY_PUBLIC, loadPublic, type PublicData } from "@/lib/data";
import { podium, roundLabel, stageKey, totalRounds } from "@/lib/bracket";
import { METHOD_SHORT, buildRecords, fighterStats, isBye, isReady, matchCode, statusOf, waitingFor, type FightRecord } from "@/lib/fight";
import { useStaff } from "@/lib/staff";
import type { Match } from "@/lib/types";
import Loader from "@/components/site/Loader";
import Hero from "@/components/site/Hero";
import Ticker, { type TickerItem } from "@/components/site/Ticker";
import RingSection from "@/components/site/RingSection";
import BracketBoard from "@/components/site/BracketBoard";
import BettingBoard from "@/components/site/BettingBoard";
import BetPanel from "@/components/site/BetPanel";
import FightHistory from "@/components/site/FightHistory";
import Podium from "@/components/site/Podium";
import Rules from "@/components/site/Rules";
import FighterDossier from "@/components/site/FighterDossier";
import MatchSheet, { type SheetData } from "@/components/site/MatchSheet";
import EventBanner from "@/components/site/EventBanner";
import { useMatchEvents } from "@/components/site/useMatchEvents";
import { UiProvider, type Ui } from "@/components/site/Ui";
import { ChainRule, SectionTitle, SiteFooter, SiteNav } from "@/components/site/SiteChrome";

type Sheet = { kind: "match"; id: string } | { kind: "record"; record: FightRecord } | null;

export default function SpectatorPage() {
  const [data, setData] = useState<PublicData>(EMPTY_PUBLIC);
  const [status, setStatus] = useState<"loading" | "live" | "error">("loading");
  const [loaded, setLoaded] = useState(false); // minimal sekali berhasil ambil data
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [booted, setBooted] = useState(false);
  const [fighterId, setFighterId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [betId, setBetId] = useState<string | null>(null);
  const staff = useStaff();

  const load = useCallback(async () => {
    try {
      setData(await loadPublic());
      setStatus("live");
      setLoaded(true);
      setUpdatedAt(Date.now());
    } catch (e) {
      console.error(e);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
    const poll = setInterval(load, 30000); // pool taruhan & data fighter diperbarui tiap 30 detik
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    let timer: ReturnType<typeof setTimeout> | null = null;
    const soon = () => { if (timer) clearTimeout(timer); timer = setTimeout(load, 250); };
    const channels: ReturnType<ReturnType<typeof sb>["channel"]>[] = [];
    try {
      const c = sb();
      channels.push(
        c.channel("public-live")
          .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, soon)
          .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, soon)
          .subscribe(),
        // channel terpisah: di database lama tabel ini belum ada, jangan sampai ikut matiin channel utama
        c.channel("public-archive")
          .on("postgres_changes", { event: "*", schema: "public", table: "tournaments" }, soon)
          .on("postgres_changes", { event: "*", schema: "public", table: "fight_history" }, soon)
          .subscribe(),
      );
    } catch {}
    return () => {
      clearInterval(poll);
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      channels.forEach((ch) => sb().removeChannel(ch));
    };
  }, [load]);

  const { settings, fighters, matches, pools, tournaments, tournament, history } = data;
  const byId = useMemo(() => new Map(fighters.map((f) => [f.id, f])), [fighters]);
  const poolOf = useMemo(() => new Map(pools.map((p) => [p.match_id, p])), [pools]);
  const total = totalRounds(matches);
  const records = useMemo(() => buildRecords(history, matches, byId, tournament?.name ?? null), [history, matches, byId, tournament]);
  const { events, fresh, arrived, dismiss } = useMatchEvents(matches, loaded);

  const playable = matches.filter((m) => !isBye(m));
  const doneCount = playable.filter((m) => m.winner_id).length;
  const liveMatches = matches.filter((m) => isReady(m) && statusOf(m) === "live");
  const poolTotal = matches.reduce((s, m) => { const p = poolOf.get(m.id); return s + (p ? p.pool1 + p.pool2 : 0); }, 0);
  const pod = podium(matches);
  const decided = !!pod.first;
  const name = useCallback((id: string | null) => (id ? byId.get(id)?.name : undefined) ?? "?", [byId]);

  /* ---------- ticker: cuma dari status match yang beneran ---------- */
  const ticker = useMemo<TickerItem[]>(() => {
    if (!loaded) return [{ kind: "idle", text: "Nyambung ke sistem fight…" }];
    const line = (m: Match) => `${name(m.fighter1_id)} vs ${name(m.fighter2_id)} — ${roundLabel(m.round, total, m.kind)} — Match ${matchCode(m.match_no)}`;
    const ready = matches.filter((m) => isReady(m) && !m.winner_id && statusOf(m) !== "cancelled");
    const live = ready.filter((m) => statusOf(m) === "live");
    const next = ready.filter((m) => statusOf(m) !== "live").sort((a, b) => a.match_no - b.match_no);
    const items: TickerItem[] = live.length
      ? live.map((m) => ({ kind: "live" as const, text: `Live now — ${line(m)}` }))
      : [{ kind: "idle", text: "No active match — waiting for the next fight." }];
    next.slice(0, 2).forEach((m) => {
      items.push({ kind: "next", text: `Next — ${line(m)}` });
    });
    const last = records.find((r) => r.tournamentId === (tournament?.id ?? null) || !tournament);
    if (last) {
      const w = last.winnerSide === 1 ? last.a : last.b;
      const l = last.winnerSide === 1 ? last.b : last.a;
      items.push({ kind: "result", text: `Result — Match ${matchCode(last.matchNo)} — ${w.name} menang atas ${l.name}${last.method ? ` — ${METHOD_SHORT[last.method]}` : ""}` });
    }
    return items;
  }, [loaded, matches, records, total, tournament, name]);

  /* ---------- aksi global: buka dossier / detail fight / meja taruhan ---------- */
  const ui = useMemo<Ui>(
    () => ({
      booted,
      openFighter: (id) => setFighterId(id),
      openMatch: (id) => { setFighterId(null); setSheet({ kind: "match", id }); },
      openRecord: (record) => { setFighterId(null); setSheet({ kind: "record", record }); },
      openBet: (id) => { setFighterId(null); setBetId(id); },
    }),
    [booted],
  );

  const sheetData = useMemo<SheetData | null>(() => {
    if (!sheet) return null;
    const m = matches.find((x) => x.id === (sheet.kind === "match" ? sheet.id : sheet.record.matchId));
    if (m) {
      const who = (id: string | null) => ({ id, name: id ? byId.get(id)?.name ?? null : null });
      return {
        matchNo: m.match_no,
        stage: stageKey(m.round, total, m.kind),
        tournamentName: tournament?.name ?? null,
        status: statusOf(m),
        a: who(m.fighter1_id),
        b: who(m.fighter2_id),
        winnerSide: m.winner_id ? (m.winner_id === m.fighter1_id ? 1 : 2) : null,
        method: m.result_method ?? null,
        durationSec: m.duration_sec ?? null,
        completedAt: m.completed_at ?? null,
        waiting: isReady(m) ? null : waitingFor(m, matches),
        match: m,
        pool: poolOf.get(m.id),
      };
    }
    if (sheet.kind !== "record") return null; // match-nya udah dihapus
    const r = sheet.record;
    return {
      matchNo: r.matchNo, stage: r.stage, tournamentName: r.tournamentName, status: "completed",
      a: r.a, b: r.b, winnerSide: r.winnerSide, method: r.method, durationSec: r.durationSec,
      completedAt: r.completedAt,
    };
  }, [sheet, matches, byId, total, tournament, poolOf]);

  const fighter = fighterId ? byId.get(fighterId) : undefined;
  const betMatch = betId ? matches.find((m) => m.id === betId && isReady(m)) : undefined;
  const winsOf = useCallback(
    (id: string) => fighterStats(id, records.filter((r) => !tournament || r.tournamentId === tournament.id)).wins,
    [records, tournament],
  );
  const past = tournaments.filter((t) => t.id !== tournament?.id && t.champion_name);
  const loading = !loaded && status !== "error";

  const champions = (
    <section className="block block-podium" data-spy="juara" aria-labelledby="juara">
      <div className="wrap">
        <SectionTitle id="juara" aside={decided ? "Turnamen selesai." : "Keisi sendiri begitu final selesai."}>Juara</SectionTitle>
        <Podium
          first={pod.first ? byId.get(pod.first) : undefined}
          second={pod.second ? byId.get(pod.second) : undefined}
          third={pod.third ? byId.get(pod.third) : undefined}
          winsOf={winsOf}
          tournamentName={tournament?.name ?? null}
          hasThird={matches.some((m) => m.kind === "third")}
          past={past}
        />
      </div>
    </section>
  );

  const sections = [
    { id: "ring", label: "Ring" },
    ...(decided ? [{ id: "juara", label: "Juara" }] : []),
    { id: "bracket", label: "Bracket" },
    { id: "taruhan", label: "Taruhan" },
    { id: "arsip", label: "Arsip" },
    ...(!decided ? [{ id: "juara", label: "Juara" }] : []),
    { id: "aturan", label: "Aturan" },
  ];

  return (
    <UiProvider value={ui}>
      <Loader ready={loaded || status === "error"} onOpen={() => setBooted(true)} />
      <div className={"site" + (booted ? " is-booted" : "")}>
        <SiteNav status={status} liveCount={liveMatches.length} sections={sections} />
        <Hero
          eventName={settings?.event_name ?? "Underground"}
          tagline={settings?.tagline}
          heroUrl={settings?.hero_url}
          stats={loaded ? { fighters: fighters.length, done: doneCount, total: playable.length, live: liveMatches.length, pool: poolTotal } : null}
        />
        <Ticker items={ticker} />
        <ChainRule />

        <main>
          {status === "error" && (
            <div className="wrap">
              <p className="alert" role="alert">
                {loaded ? "Koneksi ke data fight putus. Angka di bawah mungkin udah ketinggalan." : "Data fight gak bisa dimuat."}{" "}
                Halaman ini nyoba lagi tiap 30 detik. <button type="button" className="link-btn" onClick={load}>Coba sekarang</button>
              </p>
            </div>
          )}

          <RingSection matches={matches} byId={byId} poolOf={poolOf} total={total} loading={loading} />

          {decided && champions}

          <section className="block block-bracket" data-spy="bracket" aria-labelledby="bracket">
            <div className="wrap">
              <SectionTitle id="bracket" aside={matches.length ? `${doneCount} dari ${playable.length} fight selesai` : undefined}>
                Bracket
              </SectionTitle>
              <BracketBoard matches={matches} byId={byId} loading={loading} fresh={fresh} arrived={arrived} />
            </div>
          </section>

          <section className="block block-bets" data-spy="taruhan" aria-labelledby="taruhan">
            <div className="wrap">
              <SectionTitle id="taruhan" aside="Jagoan menang: modal balik utuh, ditambah bagian dari uang pihak yang kalah.">
                Meja taruhan
              </SectionTitle>
              <BettingBoard matches={matches} byId={byId} poolOf={poolOf} loading={loading} />
            </div>
          </section>

          <section className="block block-archive" data-spy="arsip" aria-labelledby="arsip">
            <div className="wrap">
              <SectionTitle id="arsip" aside={records.length ? "Catatan resmi tiap fight yang selesai." : undefined}>
                Fight history
              </SectionTitle>
              <FightHistory records={records} loading={loading} currentTournamentId={tournament?.id ?? null} />
            </div>
          </section>

          {!decided && champions}

          <section className="block block-rules" data-spy="aturan" aria-labelledby="aturan">
            <div className="wrap">
              <SectionTitle id="aturan" aside="Baca sebelum turun ke basement.">Aturan</SectionTitle>
              <Rules settings={settings} />
            </div>
          </section>
        </main>

        <SiteFooter updatedAt={updatedAt} />
      </div>

      <EventBanner events={booted ? events : []} matches={matches} byId={byId} total={total} onDismiss={dismiss} />

      {sheetData && <MatchSheet data={sheetData} byId={byId} onClose={() => setSheet(null)} />}
      {betMatch && (
        <BetPanel
          m={betMatch}
          f1={byId.get(betMatch.fighter1_id!)}
          f2={byId.get(betMatch.fighter2_id!)}
          pool={poolOf.get(betMatch.id)}
          round={roundLabel(betMatch.round, total, betMatch.kind)}
          staff={staff}
          onChanged={load}
          onClose={() => setBetId(null)}
        />
      )}
      {fighter && (
        <FighterDossier fighter={fighter} matches={matches} records={records} byId={byId} total={total} onClose={() => setFighterId(null)} />
      )}
    </UiProvider>
  );
}
