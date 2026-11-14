"use client";
import { useMemo, useRef, useState } from "react";
import { BetChip } from "@/components/ui/Chips";
import { sb } from "@/lib/supabase";
import { MAX_BET, multiplier, parseAmount, settleMatch, slipCode, yen } from "@/lib/betting";
import { roundLabel, totalRounds } from "@/lib/bracket";
import { bettingNote, bettingStateOf, fmtWhen, isReady, matchCode, statusOf } from "@/lib/fight";
import { placeBet } from "@/lib/staff";
import type { TabProps } from "@/lib/adminTypes";
import type { Bet, BetLog, Match } from "@/lib/types";

const ACTION_LABEL: Record<BetLog["action"], string> = {
  placed: "Dicatat",
  edited: "Diubah",
  paid: "Dibayar",
  unpaid: "Batal bayar",
  voided: "Dihapus",
};

export default function BettingTab({ me, data, reload, notify }: TabProps) {
  const { matches, fighters, bets, betLog, schemaReady } = data;
  const isSuper = me.role === "superadmin";
  const byId = useMemo(() => new Map(fighters.map((f) => [f.id, f])), [fighters]);
  const total = totalRounds(matches);
  const open = matches.filter(isReady);
  const [matchId, setMatchId] = useState<string | null>(null);

  const [bettor, setBettor] = useState("");
  const [account, setAccount] = useState("");
  const [pick, setPick] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  // id taruhan dibuat sekali per isian form: kirim ulang isian yang sama gak bakal kecatat dobel
  const draftId = useRef<string | null>(null);

  const allCalcs = useMemo(() => matches.map((m) => settleMatch(m, bets.filter((b) => b.match_id === m.id))), [matches, bets]);
  const totalBet = bets.reduce((s, b) => s + b.amount, 0);
  const houseTotal = allCalcs.reduce((s, c) => s + c.house, 0);
  const unpaid = allCalcs.reduce((s, c) => s + c.bets.filter((b) => !b.paid_out).reduce((x, b) => x + (c.results.get(b.id)?.payout ?? 0), 0), 0);

  const owes = (id: string) => {
    const c = allCalcs.find((x) => x.m.id === id);
    return !!c && c.bets.some((b) => !b.paid_out && (c.results.get(b.id)?.payout ?? 0) > 0);
  };
  const firstOpen =
    open.find((m) => bettingStateOf(m) === "open") ?? open.find((m) => owes(m.id)) ?? open.find((m) => !m.winner_id) ?? open[0];
  const selected = open.find((m) => m.id === (matchId ?? firstOpen?.id));
  const cur = selected ? allCalcs.find((c) => c.m.id === selected.id)! : null;
  const name = (id: string | null) => (id ? byId.get(id)?.name ?? "?" : "-");
  const state = selected ? bettingStateOf(selected) : "closed";
  const log = selected ? betLog.filter((l) => l.match_id === selected.id) : [];

  const resetDraft = () => { draftId.current = null; };

  async function addBet(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || busy) return;
    const amt = parseAmount(amount);
    if (!bettor.trim() || !pick) return notify("Isi nama bettor dan pilih jagoannya.", true);
    if (amt === null) return notify("Nominal harus angka lebih dari 0, tanpa koma. Contoh: 25000.", true);
    if (amt > MAX_BET) return notify(`Nominal maksimal ${yen(MAX_BET)} per taruhan.`, true);
    setBusy(true);
    draftId.current ??= crypto.randomUUID();
    const id = draftId.current;
    try {
      const { duplicate } = await placeBet({
        id, match_id: selected.id, bettor_name: bettor.trim(), bettor_account: account.trim() || null, fighter_id: pick, amount: amt,
      });
      notify(
        duplicate
          ? `Taruhan itu udah kecatat sebelumnya. Kode slip ${slipCode(id)}.`
          : `Taruhan ${bettor.trim()} ${yen(amt)} ke ${name(pick)} dicatat. Kode slip ${slipCode(id)}, kasih ke bettor-nya.`,
      );
      setBettor(""); setAccount(""); setAmount("");
      resetDraft();
      await reload();
    } catch (err) {
      notify((err as Error).message, true);
    }
    setBusy(false);
  }

  async function togglePaid(b: Bet) {
    const { error } = await sb().from("bets").update({ paid_out: !b.paid_out }).eq("id", b.id);
    if (error) return notify(error.message, true);
    await reload();
  }

  async function removeBet(b: Bet) {
    if (!confirm(`Hapus taruhan ${b.bettor_name} ${yen(b.amount)}? Penghapusan tetap tercatat di riwayat transaksi.`)) return;
    const { error } = await sb().from("bets").delete().eq("id", b.id);
    if (error) return notify(error.message, true);
    await reload();
  }

  async function setCut(m: Match, pct: string) {
    if (!isSuper) return;
    const v = Math.min(Math.max(parseFloat(pct) || 0, 0), 90) / 100;
    const { error } = await sb().from("matches").update({ house_cut: v }).eq("id", m.id);
    if (error) return notify(error.message, true);
    await reload();
  }

  async function setClosed(m: Match, closed: boolean) {
    const { error } = await sb().from("matches").update({ betting_closed: closed }).eq("id", m.id);
    if (error) return notify(error.message, true);
    notify(closed ? `Taruhan fight ${matchCode(m.match_no)} ditutup.` : `Taruhan fight ${matchCode(m.match_no)} dibuka lagi.`);
    await reload();
  }

  return (
    <>
      <div className="stats">
        <div className="stat"><div className="k">Total uang taruhan</div><div className="v mono">{yen(totalBet)}</div></div>
        {isSuper && <div className="stat"><div className="k">Untung kas</div><div className="v mono" style={{ color: "var(--green)" }}>{yen(houseTotal)}</div></div>}
        <div className="stat"><div className="k">Belum dibayar ke bettor</div><div className="v mono" style={{ color: unpaid ? "var(--red)" : undefined }}>{yen(unpaid)}</div></div>
        <div className="stat"><div className="k">Jumlah taruhan</div><div className="v">{bets.length}</div></div>
      </div>

      {open.length === 0 ? (
        <div className="empty-state">Belum ada match yang kedua fighternya sudah ditentukan. Generate bracket dulu.</div>
      ) : (
        <>
          <div className="card">
            <label className="f">Pilih match
              <select value={selected?.id ?? ""} onChange={(e) => { setMatchId(e.target.value); setPick(""); resetDraft(); }}>
                {open.map((m) => (
                  <option key={m.id} value={m.id}>
                    Match {matchCode(m.match_no)} · {roundLabel(m.round, total, m.kind)} — {name(m.fighter1_id)} vs {name(m.fighter2_id)}
                    {m.winner_id ? " (selesai)" : statusOf(m) === "live" ? " (live)" : statusOf(m) === "cancelled" ? " (batal)" : ""}
                  </option>
                ))}
              </select>
            </label>
            {selected && (
              <div className="row-actions" style={{ marginTop: 12 }}>
                <BetChip state={state} />
                <span style={{ fontSize: 14, color: "var(--muted)" }}>{bettingNote(selected)}</span>
                {schemaReady && !selected.winner_id && statusOf(selected) !== "live" && statusOf(selected) !== "cancelled" && (
                  <button className="btn ghost sm" onClick={() => setClosed(selected, !selected.betting_closed)}>
                    {selected.betting_closed ? "Buka lagi taruhan" : "Tutup taruhan sekarang"}
                  </button>
                )}
              </div>
            )}
          </div>

          {selected && cur && (
            <>
              <div className="stats">
                <div className="stat"><div className="k">{name(selected.fighter1_id)}</div><div className="v mono">{yen(cur.pool1)}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>kalau menang x{multiplier(cur.pool1, cur.pool2, selected.house_cut)?.toFixed(2) ?? "-"}</div></div>
                <div className="stat"><div className="k">{name(selected.fighter2_id)}</div><div className="v mono">{yen(cur.pool2)}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>kalau menang x{multiplier(cur.pool2, cur.pool1, selected.house_cut)?.toFixed(2) ?? "-"}</div></div>
                {isSuper && (
                  <>
                    <div className="stat"><div className="k">House cut (%)</div>
                      <input type="number" min={0} max={90} step={1} defaultValue={Math.round(selected.house_cut * 100)} key={selected.id + selected.house_cut}
                        onBlur={(e) => setCut(selected, e.target.value)} style={{ marginTop: 4 }} aria-label="House cut dalam persen" />
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>dipotong dari uang pihak kalah</div></div>
                    <div className="stat"><div className="k">Untung match ini</div><div className="v mono">{selected.winner_id ? yen(cur.house) : "-"}</div></div>
                  </>
                )}
              </div>

              {state === "open" ? (
                <form className="card" onSubmit={addBet}>
                  <h3>Catat taruhan baru</h3>
                  <div className="form-grid">
                    <label className="f">Nama bettor<input type="text" value={bettor} onChange={(e) => { setBettor(e.target.value); resetDraft(); }} required maxLength={60} /></label>
                    <label className="f">Rekening / Yentag<input type="text" value={account} onChange={(e) => { setAccount(e.target.value); resetDraft(); }} placeholder="buat transfer kalau menang" maxLength={100} /></label>
                    <label className="f">Jagoan
                      <select value={pick} onChange={(e) => { setPick(e.target.value); resetDraft(); }} required>
                        <option value="">Pilih…</option>
                        <option value={selected.fighter1_id!}>{name(selected.fighter1_id)}</option>
                        <option value={selected.fighter2_id!}>{name(selected.fighter2_id)}</option>
                      </select>
                    </label>
                    <label className="f">Nominal (¥)<input type="text" inputMode="numeric" value={amount} onChange={(e) => { setAmount(e.target.value); resetDraft(); }} required placeholder="25000" /></label>
                    <button className="btn" disabled={busy}>{busy ? "Nyatat…" : "Catat taruhan"}</button>
                  </div>
                </form>
              ) : (
                <div className="notice">
                  {selected.winner_id ? (
                    <>Match selesai — pemenang <strong>{name(selected.winner_id)}</strong>. Taruhan ditutup. Centang &quot;Sudah dibayar&quot; setelah Yen ditransfer ke bettor.</>
                  ) : statusOf(selected) === "cancelled" ? (
                    <>Fight dibatalkan. Semua taruhan dikembalikan utuh: transfer balik lalu centang &quot;Sudah dibayar&quot;.</>
                  ) : (
                    bettingNote(selected)
                  )}
                </div>
              )}

              {cur.bets.length === 0 ? (
                <div className="empty-state">Belum ada taruhan di match ini.</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Kode slip</th><th>Bettor</th><th>Rekening / Yentag</th><th>Jagoan</th><th>Taruhan</th><th>Status</th><th>Payout</th><th>Dibayar</th><th></th></tr></thead>
                    <tbody>
                      {cur.bets.map((b) => {
                        const r = cur.results.get(b.id)!;
                        return (
                          <tr key={b.id}>
                            <td className="mono" style={{ whiteSpace: "nowrap" }}>{slipCode(b.id)}</td>
                            <td><strong>{b.bettor_name}</strong></td>
                            <td className="mono">{b.bettor_account || <span style={{ color: "var(--muted)" }}>-</span>}</td>
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
              {cur.bets.length > 0 && <PayoutKey />}

              {schemaReady && (
                <details className="admin-details">
                  <summary>Riwayat transaksi fight ini ({log.length})</summary>
                  {log.length === 0 ? (
                    <div className="empty-state">Belum ada transaksi.</div>
                  ) : (
                    <div className="table-wrap">
                      <table>
                        <thead><tr><th>Waktu</th><th>Aksi</th><th>Bettor</th><th>Jagoan</th><th>Nominal</th><th>Oleh</th></tr></thead>
                        <tbody>
                          {log.map((l) => (
                            <tr key={l.id}>
                              <td style={{ whiteSpace: "nowrap" }}>{fmtWhen(l.created_at)}</td>
                              <td>{ACTION_LABEL[l.action]}</td>
                              <td>{l.bettor_name}</td>
                              <td>{l.fighter_name ?? "-"}</td>
                              <td className="mono">{yen(l.amount)}</td>
                              <td>{l.actor_name ?? "Sistem"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </details>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}

/** Penjelasan kolom Status, Payout, dan Dibayar di tabel taruhan. */
function PayoutKey() {
  return (
    <div className="card paykey-card">
      <h3>Arti Status, Payout, dan Dibayar</h3>
      <dl className="paykey">
        <dt>Status</dt>
        <dd>
          <ul className="paykey-status">
            <li><span className="pill neutral">Menunggu</span><span>Fight belum selesai. Belum ada yang perlu dibayar.</span></li>
            <li><span className="pill ok">Menang</span><span>Jagoannya menang. Bettor dapat payout.</span></li>
            <li><span className="pill no">Kalah</span><span>Jagoannya kalah. Gak dapat apa-apa, uangnya dibagi ke bettor yang menang.</span></li>
            <li><span className="pill ok">Batal</span><span>Fight dibatalkan, atau jagoannya udah gak ada di fight ini. Taruhannya dikembalikan utuh.</span></li>
          </ul>
        </dd>
        <dt>Payout</dt>
        <dd>
          Jumlah Yen yang harus ditransfer ke rekening / Yentag bettor. Kalau menang: modal balik utuh, ditambah bagian dari
          uang pihak yang kalah setelah dipotong house cut. Kalau batal: nominal taruhannya balik utuh. Tanda &quot;-&quot; berarti
          gak ada yang perlu ditransfer.
        </dd>
        <dt>Dibayar</dt>
        <dd>
          Centang setelah payout beneran ditransfer. <strong>Belum</strong> berarti masih utang ke bettor dan ikut dihitung di
          &quot;Belum dibayar ke bettor&quot; di atas. <strong>Sudah</strong> berarti beres. Bettor yang ngecek kode slip di
          halaman penonton langsung lihat &quot;Udah ditransfer&quot; atau &quot;Belum ditransfer&quot;. Salah centang? Klik lagi,
          semuanya tercatat di riwayat transaksi.
        </dd>
      </dl>
    </div>
  );
}
