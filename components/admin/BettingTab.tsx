"use client";
import { useMemo, useState } from "react";
import { sb } from "@/lib/supabase";
import { multiplier, payout, yen } from "@/lib/betting";
import { roundLabel, totalRounds } from "@/lib/bracket";
import type { TabProps } from "@/lib/adminTypes";
import type { Bet, Match } from "@/lib/types";

type MatchCalc = {
  m: Match; bets: Bet[]; pool1: number; pool2: number;
  results: Map<string, { status: "Menang" | "Kalah" | "Menunggu" | "Batal"; payout: number }>;
  house: number; paidOutTotal: number;
};

function calc(m: Match, bets: Bet[]): MatchCalc {
  const pool1 = bets.filter((b) => b.fighter_id === m.fighter1_id).reduce((s, b) => s + b.amount, 0);
  const pool2 = bets.filter((b) => b.fighter_id === m.fighter2_id).reduce((s, b) => s + b.amount, 0);
  const results: MatchCalc["results"] = new Map();
  let house = 0;
  let paidOutTotal = 0;
  if (!m.winner_id) {
    bets.forEach((b) => results.set(b.id, { status: "Menunggu", payout: 0 }));
  } else {
    const winPool = m.winner_id === m.fighter1_id ? pool1 : pool2;
    const losePool = m.winner_id === m.fighter1_id ? pool2 : pool1;
    for (const b of bets) {
      if (b.fighter_id !== m.fighter1_id && b.fighter_id !== m.fighter2_id) {
        results.set(b.id, { status: "Batal", payout: b.amount }); // fighter-nya udah gak di match ini, refund
        paidOutTotal += b.amount;
      } else if (b.fighter_id === m.winner_id) {
        const p = payout(b.amount, winPool, losePool, m.house_cut);
        results.set(b.id, { status: "Menang", payout: p });
        paidOutTotal += p;
      } else {
        results.set(b.id, { status: "Kalah", payout: 0 });
      }
    }
    const totalIn = bets.reduce((s, b) => s + b.amount, 0);
    house = totalIn - paidOutTotal; // termasuk sisa pembulatan
  }
  return { m, bets, pool1, pool2, results, house, paidOutTotal };
}

export default function BettingTab({ data, reload, notify }: TabProps) {
  const { matches, fighters, bets } = data;
  const byId = useMemo(() => new Map(fighters.map((f) => [f.id, f])), [fighters]);
  const total = totalRounds(matches);
  const open = matches.filter((m) => m.fighter1_id && m.fighter2_id);
  const firstOpen = open.find((m) => !m.winner_id) ?? open[0];
  const [matchId, setMatchId] = useState<string | null>(null);
  const selected = open.find((m) => m.id === (matchId ?? firstOpen?.id));

  const [bettor, setBettor] = useState("");
  const [pick, setPick] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const allCalcs = useMemo(() => matches.map((m) => calc(m, bets.filter((b) => b.match_id === m.id))), [matches, bets]);
  const totalBet = bets.reduce((s, b) => s + b.amount, 0);
  const houseTotal = allCalcs.reduce((s, c) => s + c.house, 0);
  const unpaid = allCalcs.reduce((s, c) => s + c.bets.filter((b) => !b.paid_out && (c.results.get(b.id)?.payout ?? 0) > 0).reduce((x, b) => x + (c.results.get(b.id)!.payout), 0), 0);

  const cur = selected ? allCalcs.find((c) => c.m.id === selected.id)! : null;
  const name = (id: string | null) => (id ? byId.get(id)?.name ?? "?" : "-");

  async function addBet(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const amt = parseInt(amount.replace(/\D/g, ""), 10);
    if (!bettor.trim() || !pick || !amt) return notify("Isi nama bettor, jagoan, dan nominal.", true);
    setBusy(true);
    const { error } = await sb().from("bets").insert({ match_id: selected.id, bettor_name: bettor.trim(), fighter_id: pick, amount: amt });
    if (error) notify(error.message, true);
    else {
      notify(`Taruhan ${bettor.trim()} ${yen(amt)} ke ${name(pick)} dicatat.`);
      setBettor(""); setAmount("");
      await reload();
    }
    setBusy(false);
  }

  async function togglePaid(b: Bet) {
    const { error } = await sb().from("bets").update({ paid_out: !b.paid_out }).eq("id", b.id);
    if (error) return notify(error.message, true);
    await reload();
  }

  async function removeBet(b: Bet) {
    if (!confirm(`Hapus taruhan ${b.bettor_name} ${yen(b.amount)}?`)) return;
    const { error } = await sb().from("bets").delete().eq("id", b.id);
    if (error) return notify(error.message, true);
    await reload();
  }

  async function setCut(m: Match, pct: string) {
    const v = Math.min(Math.max(parseFloat(pct) || 0, 0), 90) / 100;
    const { error } = await sb().from("matches").update({ house_cut: v }).eq("id", m.id);
    if (error) return notify(error.message, true);
    await reload();
  }

  return (
    <>
      <div className="stats">
        <div className="stat"><div className="k">Total uang taruhan</div><div className="v mono">{yen(totalBet)}</div></div>
        <div className="stat"><div className="k">Untung kas 1C</div><div className="v mono" style={{ color: "var(--green)" }}>{yen(houseTotal)}</div></div>
        <div className="stat"><div className="k">Belum dibayar ke bettor</div><div className="v mono" style={{ color: unpaid ? "var(--red)" : undefined }}>{yen(unpaid)}</div></div>
        <div className="stat"><div className="k">Jumlah taruhan</div><div className="v">{bets.length}</div></div>
      </div>

      {open.length === 0 ? (
        <div className="empty-state">Belum ada match yang kedua fighternya sudah ditentukan. Generate bracket dulu.</div>
      ) : (
        <>
          <div className="card">
            <label className="f">Pilih match
              <select value={selected?.id ?? ""} onChange={(e) => { setMatchId(e.target.value); setPick(""); }}>
                {open.map((m) => (
                  <option key={m.id} value={m.id}>
                    Match {m.match_no} · {roundLabel(m.round, total, m.kind)} — {name(m.fighter1_id)} vs {name(m.fighter2_id)}{m.winner_id ? " (selesai)" : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selected && cur && (
            <>
              <div className="stats">
                <div className="stat"><div className="k">{name(selected.fighter1_id)}</div><div className="v mono">{yen(cur.pool1)}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>kalau menang x{multiplier(cur.pool1, cur.pool2, selected.house_cut)?.toFixed(2) ?? "-"}</div></div>
                <div className="stat"><div className="k">{name(selected.fighter2_id)}</div><div className="v mono">{yen(cur.pool2)}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>kalau menang x{multiplier(cur.pool2, cur.pool1, selected.house_cut)?.toFixed(2) ?? "-"}</div></div>
                <div className="stat"><div className="k">House cut (%)</div>
                  <input type="number" min={0} max={90} step={1} defaultValue={Math.round(selected.house_cut * 100)} key={selected.id + selected.house_cut}
                    onBlur={(e) => setCut(selected, e.target.value)} style={{ marginTop: 4 }} />
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>dipotong dari uang pihak kalah</div></div>
                <div className="stat"><div className="k">Untung 1C match ini</div><div className="v mono">{selected.winner_id ? yen(cur.house) : "-"}</div></div>
              </div>

              {!selected.winner_id ? (
                <form className="card" onSubmit={addBet}>
                  <h3>Catat taruhan baru</h3>
                  <div className="form-grid">
                    <label className="f">Nama bettor<input type="text" value={bettor} onChange={(e) => setBettor(e.target.value)} required /></label>
                    <label className="f">Jagoan
                      <select value={pick} onChange={(e) => setPick(e.target.value)} required>
                        <option value="">Pilih…</option>
                        <option value={selected.fighter1_id!}>{name(selected.fighter1_id)}</option>
                        <option value={selected.fighter2_id!}>{name(selected.fighter2_id)}</option>
                      </select>
                    </label>
                    <label className="f">Nominal (¥)<input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} required /></label>
                    <button className="btn" disabled={busy}>Catat</button>
                  </div>
                </form>
              ) : (
                <div className="notice">Match selesai — pemenang <strong>{name(selected.winner_id)}</strong>. Taruhan ditutup. Centang &quot;Sudah dibayar&quot; setelah Yen ditransfer ke bettor.</div>
              )}

              {cur.bets.length === 0 ? (
                <div className="empty-state">Belum ada taruhan di match ini.</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Bettor</th><th>Jagoan</th><th>Taruhan</th><th>Status</th><th>Payout</th><th>Dibayar</th><th></th></tr></thead>
                    <tbody>
                      {cur.bets.map((b) => {
                        const r = cur.results.get(b.id)!;
                        return (
                          <tr key={b.id}>
                            <td><strong>{b.bettor_name}</strong></td>
                            <td>{name(b.fighter_id)}</td>
                            <td className="mono">{yen(b.amount)}</td>
                            <td><span className={"pill " + (r.status === "Menang" || r.status === "Batal" ? "ok" : r.status === "Kalah" ? "no" : "neutral")}>{r.status}</span></td>
                            <td className="mono">{r.payout ? yen(r.payout) : "-"}</td>
                            <td>{r.payout > 0 ? <label className="check"><input type="checkbox" checked={b.paid_out} onChange={() => togglePaid(b)} /> {b.paid_out ? "Sudah" : "Belum"}</label> : "-"}</td>
                            <td><button className="btn danger sm" onClick={() => removeBet(b)}>Hapus</button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
