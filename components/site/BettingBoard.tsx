"use client";
import { useState } from "react";
import Reveal from "@/components/ui/Reveal";
import CountUp from "@/components/ui/CountUp";
import { BetChip } from "@/components/ui/Chips";
import { useUi } from "@/components/site/Ui";
import { betOutcome, multiplier, yen } from "@/lib/betting";
import { times } from "@/lib/codes";
import { bettingStateOf, fmtWhen, isReady, matchCode, pad3, type BettingState } from "@/lib/fight";
import { sb } from "@/lib/supabase";
import type { BetSlip, Fighter, Match, Pool } from "@/lib/types";

type Props = { matches: Match[]; byId: Map<string, Fighter>; poolOf: Map<string, Pool>; loading: boolean };

const ORDER: Record<BettingState, number> = { open: 0, closed: 1, settled: 2 };

/**
 * Papan taruhan: semua fight yang bisa ditaruhin, total uang per sisi, dan kelipatan kalau menang.
 * Nama bettor dan nominal per orang gak pernah tampil di sini. Klik satu baris buat buka detailnya.
 */
export default function BettingBoard({ matches, byId, poolOf, loading }: Props) {
  const ui = useUi();
  if (loading) return <p className="empty-note is-loading" role="status">Ngambil data taruhan…</p>;

  const rows = matches
    .filter(isReady)
    .map((m) => ({ m, state: bettingStateOf(m), p: poolOf.get(m.id) }))
    .sort((a, b) => ORDER[a.state] - ORDER[b.state] || (a.state === "settled" ? b.m.match_no - a.m.match_no : a.m.match_no - b.m.match_no));
  const active = rows.filter((r) => r.state !== "settled");
  const settled = rows.filter((r) => r.state === "settled");
  const poolTotal = rows.reduce((s, r) => s + (r.p ? r.p.pool1 + r.p.pool2 : 0), 0);
  const betTotal = rows.reduce((s, r) => s + (r.p?.bet_count ?? 0), 0);

  const slip = ({ m, state, p }: (typeof rows)[number], i: number) => {
    const p1 = p?.pool1 ?? 0;
    const p2 = p?.pool2 ?? 0;
    const sum = p1 + p2;
    const pctA = sum ? Math.round((p1 / sum) * 100) : 50;
    const f1 = byId.get(m.fighter1_id!);
    const f2 = byId.get(m.fighter2_id!);
    const done = !!m.winner_id;
    const cls = (id: string | null) => (done ? (m.winner_id === id ? " is-win" : " is-lose") : "");
    const money = (n: number) => (n ? yen(n) : "Belum ada");
    const count = p?.bet_count ?? 0;
    return (
      <Reveal as="li" key={m.id} kind="up" delay={Math.min(i, 6) * 60} className="slip-li">
        <button type="button" className={`slip is-${state}${sum ? "" : " is-empty"}`} onClick={() => ui.openBet(m.id)}>
          <span className="slip-no">{pad3(m.match_no)}</span>
          <span className={"slip-side slip-a" + cls(m.fighter1_id)}>
            <span className="slip-name">{f1?.name ?? "?"}</span>
            <span className="slip-money">{money(p1)}</span>
            <span className="slip-x">{times(multiplier(p1, p2, m.house_cut))}</span>
          </span>
          <span className="slip-bar" aria-hidden="true"><i style={{ width: `${pctA}%` }} /></span>
          <span className={"slip-side slip-b" + cls(m.fighter2_id)}>
            <span className="slip-name">{f2?.name ?? "?"}</span>
            <span className="slip-money">{money(p2)}</span>
            <span className="slip-x">{times(multiplier(p2, p1, m.house_cut))}</span>
          </span>
          <span className="slip-state">
            <BetChip state={state} />
            <span>
              {done
                ? `${byId.get(m.winner_id!)?.name ?? "?"} menang`
                : count
                  ? `${count} taruhan dari ${p?.bettors ?? count} orang`
                  : state === "open" ? "Belum ada yang pasang" : "Gak ada taruhan"}
            </span>
            <span className="sr-only">. Buka detail taruhan fight {matchCode(m.match_no)}.</span>
          </span>
        </button>
      </Reveal>
    );
  };

  return (
    <>
      <Reveal as="div" kind="up" className="bet-sum">
        <dl>
          <div><dt>Total pool</dt><dd><CountUp value={poolTotal} format={yen} duration={1100} /></dd></div>
          <div><dt>Fight buka taruhan</dt><dd><CountUp value={rows.filter((r) => r.state === "open").length} /></dd></div>
          <div><dt>Taruhan masuk</dt><dd><CountUp value={betTotal} /></dd></div>
        </dl>
        <p className="bet-sum-note">Mata uang RP. Bukan uang asli.</p>
      </Reveal>

      {rows.length === 0 ? (
        <p className="empty-note">Meja taruhan belum buka. Begitu ada fight yang dua fighter-nya ketahuan, taruhannya dibuka di sini.</p>
      ) : (
        <>
          {active.length > 0 ? (
            <ul className="ledger">{active.map(slip)}</ul>
          ) : (
            <p className="empty-note">Gak ada fight yang lagi buka taruhan. Semua taruhan udah dihitung.</p>
          )}
          {settled.length > 0 && (
            <details className="ledger-closed">
              <summary>Taruhan yang udah dihitung ({settled.length})</summary>
              <ul className="ledger">{settled.map(slip)}</ul>
            </details>
          )}
        </>
      )}

      <SlipCheck matches={matches} byId={byId} poolOf={poolOf} />
      <p className="bets-how">Pasang taruhan langsung ke Finance Betting di lokasi. Nama dan nominal kamu gak bakal muncul di halaman ini.</p>
    </>
  );
}

type SlipState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "found"; slips: BetSlip[] };

/** Bettor ngecek taruhannya sendiri pakai kode slip dari Finance Betting. */
function SlipCheck({ matches, byId, poolOf }: Pick<Props, "matches" | "byId" | "poolOf">) {
  const ui = useUi();
  const [code, setCode] = useState("");
  const [state, setState] = useState<SlipState>({ kind: "idle" });

  async function check(e: React.FormEvent) {
    e.preventDefault();
    const hex = code.replace(/^\s*tx/i, "").replace(/[^0-9a-f]/gi, "");
    if (hex.length !== 8) {
      return setState({ kind: "error", message: "Kode slip itu 8 karakter setelah TX-, misal TX-7F3A9C21. Cek lagi tulisannya." });
    }
    setState({ kind: "loading" });
    try {
      const { data, error } = await sb().rpc("bet_slip", { p_code: hex });
      if (error) {
        const missing = error.code === "PGRST202" || /could not find|does not exist/i.test(error.message);
        return setState({
          kind: "error",
          message: missing ? "Cek slip belum aktif di website ini. Tanya langsung ke Finance Betting." : "Slip gak bisa dicek sekarang. Coba lagi sebentar.",
        });
      }
      const slips = (data ?? []) as BetSlip[];
      setState(slips.length ? { kind: "found", slips } : { kind: "error", message: "Gak ada taruhan dengan kode itu. Cek lagi kodenya, atau tanya Finance Betting." });
    } catch {
      setState({ kind: "error", message: "Koneksi putus. Coba lagi sebentar." });
    }
  }

  return (
    <Reveal className="slipcheck" kind="up">
      <form onSubmit={check} noValidate>
        <label htmlFor="slip-code">Udah pasang? Cek taruhanmu pakai kode slip</label>
        <div className="slipcheck-row">
          <input
            id="slip-code"
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="TX-7F3A9C21"
            maxLength={14}
            value={code}
            onChange={(e) => { setCode(e.target.value); if (state.kind === "error") setState({ kind: "idle" }); }}
            aria-describedby={state.kind === "error" ? "slip-err" : undefined}
            aria-invalid={state.kind === "error" || undefined}
          />
          <button type="submit" className="btn" disabled={state.kind === "loading" || !code.trim()}>
            {state.kind === "loading" ? "Ngecek…" : "Cek slip"}
          </button>
        </div>
        {state.kind === "error" && <p className="field-err" id="slip-err" role="alert">{state.message}</p>}
      </form>

      {state.kind === "found" && (
        <ul className="slipcheck-out" role="status">
          {state.slips.map((s) => {
            const m = matches.find((x) => x.id === s.match_id);
            const pool = poolOf.get(s.match_id);
            const out = m ? betOutcome(m, pool?.pool1 ?? 0, pool?.pool2 ?? 0, s) : null;
            const tone = out?.status === "Menang" ? "win" : out?.status === "Kalah" ? "loss" : "wait";
            return (
              <li key={s.code} className={`ticket is-${tone}`}>
                <p className="ticket-code">TX-{s.code}</p>
                <dl>
                  <div><dt>Atas nama</dt><dd>{s.bettor_name}</dd></div>
                  <div><dt>Jagoan</dt><dd>{byId.get(s.fighter_id)?.name ?? "?"}</dd></div>
                  <div><dt>Nominal</dt><dd>{yen(s.amount)}</dd></div>
                  <div><dt>Dicatat</dt><dd>{fmtWhen(s.created_at) ?? "–"}</dd></div>
                  <div>
                    <dt>Status</dt>
                    <dd>
                      {!out && "Fight-nya udah masuk arsip. Tanya Finance Betting."}
                      {out?.status === "Menunggu" && "Nunggu hasil fight"}
                      {out?.status === "Menang" && `Menang, kamu dapat ${yen(out.payout)}`}
                      {out?.status === "Kalah" && "Kalah"}
                      {out?.status === "Batal" && `Batal, ${yen(out.payout)} dikembalikan`}
                    </dd>
                  </div>
                  {out && out.payout > 0 && (
                    <div><dt>Pembayaran</dt><dd>{s.paid_out ? "Udah ditransfer" : "Belum ditransfer"}</dd></div>
                  )}
                </dl>
                {m && (
                  <button type="button" className="ink-btn" onClick={() => ui.openBet(m.id)}>
                    Lihat fight {matchCode(m.match_no)}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Reveal>
  );
}
