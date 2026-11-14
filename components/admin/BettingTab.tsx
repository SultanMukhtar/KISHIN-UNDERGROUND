"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { BetChip } from "@/components/ui/Chips";
import { sb } from "@/lib/supabase";
import { MAX_BET, multiplier, settleMatch, slipCode, yen, type BetOutcome } from "@/lib/betting";
import { roundLabel, totalRounds } from "@/lib/bracket";
import { bettingNote, bettingStateOf, fmtWhen, isReady, matchCode, statusOf } from "@/lib/fight";
import { placeBet } from "@/lib/staff";
import type { TabProps } from "@/lib/adminTypes";
import type { Bet, BetLog, Match } from "@/lib/types";
import MoneyInput, { parseMoney } from "./MoneyInput";

const ACTION_LABEL: Record<BetLog["action"], string> = {
  placed: "Dicatat",
  edited: "Diubah",
  paid: "Dibayar",
  unpaid: "Batal bayar",
  voided: "Dihapus",
};
const OUTCOME_LABEL: Record<BetOutcome["status"], string> = { Menang: "Menang", Kalah: "Kalah", Menunggu: "Menunggu", Batal: "Refund" };

type LastSlip = { code: string; bettor: string; amount: number; fighter: string; match: string; duplicate: boolean };

export default function BettingTab({ me, data, reload, notify, confirm, go, intent }: TabProps) {
  const { matches, fighters, bets, betLog, schemaReady } = data;
  const isSuper = me.role === "superadmin";
  const byId = useMemo(() => new Map(fighters.map((f) => [f.id, f])), [fighters]);
  const name = (id: string | null) => (id ? byId.get(id)?.name ?? "?" : "-");
  const total = totalRounds(matches);
  const open = useMemo(() => matches.filter(isReady), [matches]);

  const calcs = useMemo(() => matches.map((m) => settleMatch(m, bets.filter((b) => b.match_id === m.id))), [matches, bets]);
  const calcOf = (id: string) => calcs.find((c) => c.m.id === id);
  const totalBet = bets.reduce((s, b) => s + b.amount, 0);
  const houseTotal = calcs.reduce((s, c) => s + c.house, 0);

  /** semua taruhan yang harus dibayar (menang / refund) tapi belum ditandai dibayar */
  const owed = useMemo(() => {
    const rows: { b: Bet; m: Match; r: BetOutcome }[] = [];
    for (const c of calcs) for (const b of c.bets) {
      const r = c.results.get(b.id);
      if (r && r.payout > 0 && !b.paid_out) rows.push({ b, m: c.m, r });
    }
    return rows.sort((x, y) => x.m.match_no - y.m.match_no || x.b.created_at.localeCompare(y.b.created_at));
  }, [calcs]);
  const owedTotal = owed.reduce((s, o) => s + o.r.payout, 0);

  const [view, setView] = useState<"fight" | "payouts">("fight");

  /* ---------- fight yang dipilih: sekali kepilih, gak loncat sendiri waktu data dimuat ulang ---------- */
  const [matchId, setMatchId] = useState<string | null>(null);
  const owes = (id: string) => owed.some((o) => o.m.id === id);
  const firstOpen = open.find((m) => bettingStateOf(m) === "open") ?? open.find((m) => owes(m.id)) ?? open.find((m) => !m.winner_id) ?? open[0];
  const pinnedOk = !!matchId && open.some((m) => m.id === matchId);
  useEffect(() => {
    if (!pinnedOk && firstOpen) setMatchId(firstOpen.id);
  }, [pinnedOk, firstOpen?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const selected = open.find((m) => m.id === (pinnedOk ? matchId : firstOpen?.id));
  const cur = selected ? calcOf(selected.id) ?? null : null;
  const state = selected ? bettingStateOf(selected) : "closed";
  const log = selected ? betLog.filter((l) => l.match_id === selected.id) : [];

  // dari daftar "perlu diurus" / tab lain
  useEffect(() => {
    if (!intent) return;
    if (intent.view === "payouts") setView("payouts");
    if (intent.matchId) { setView("fight"); setMatchId(intent.matchId); }
    window.scrollTo(0, 0);
  }, [intent?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- catat taruhan ---------- */
  const [bettor, setBettor] = useState("");
  const [account, setAccount] = useState("");
  const [pick, setPick] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [lastSlip, setLastSlip] = useState<LastSlip | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  // id taruhan dibuat sekali per isian form: kirim ulang isian yang sama gak bakal kecatat dobel
  const draftId = useRef<string | null>(null);
  const edited = () => { draftId.current = null; setFormErr(null); };

  async function addBet(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || busy) return;
    const amt = parseMoney(amount);
    if (!bettor.trim()) return setFormErr("Nama bettor wajib diisi.");
    if (!pick) return setFormErr("Pilih jagoannya dulu.");
    if (!amt || amt <= 0) return setFormErr("Nominal harus lebih dari 0.");
    if (amt > MAX_BET) return setFormErr(`Nominal maksimal ${yen(MAX_BET)} per taruhan.`);
    setBusy(true);
    setFormErr(null);
    draftId.current ??= crypto.randomUUID();
    const id = draftId.current;
    try {
      const { duplicate } = await placeBet({
        id, match_id: selected.id, bettor_name: bettor.trim(), bettor_account: account.trim() || null, fighter_id: pick, amount: amt,
      });
      setLastSlip({ code: slipCode(id), bettor: bettor.trim(), amount: amt, fighter: name(pick), match: matchCode(selected.match_no), duplicate });
      notify(duplicate ? "Taruhan itu udah kecatat sebelumnya." : `Taruhan ${bettor.trim()} ${yen(amt)} dicatat.`);
      setBettor(""); setAccount(""); setAmount(""); setPick("");
      draftId.current = null;
      nameRef.current?.focus();
      await reload();
    } catch (err) {
      setFormErr("Taruhan gagal dicatat: " + (err as Error).message);
    }
    setBusy(false);
  }

  async function copySlip(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      notify(`Kode slip ${code} disalin.`);
    } catch {
      notify("Gak bisa nyalin otomatis. Salin manual kodenya.", true);
    }
  }

  /* ---------- bayar / hapus ---------- */
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  async function setPaid(b: Bet, paidOut: boolean, payout: number) {
    if (!paidOut) {
      const ok = await confirm({
        title: "Batalin tanda dibayar?",
        body: <>Slip {slipCode(b.id)} atas nama <b>{b.bettor_name}</b> balik ke daftar belum dibayar.</>,
        confirmLabel: "Batalin tanda",
      });
      if (!ok) return;
    }
    setRowBusy(b.id);
    const { error } = await sb().from("bets").update({ paid_out: paidOut }).eq("id", b.id);
    if (error) notify("Gagal nyimpan status bayar: " + error.message, true);
    else notify(paidOut ? `${b.bettor_name} ditandai udah dibayar ${yen(payout)}.` : `Slip ${slipCode(b.id)} balik ke belum dibayar.`);
    await reload();
    setRowBusy(null);
  }

  async function removeBet(b: Bet) {
    const ok = await confirm({
      title: "Hapus taruhan ini?",
      body: <><b>{b.bettor_name}</b>, {yen(b.amount)} ke {name(b.fighter_id)}. Slip {slipCode(b.id)}.</>,
      points: ["Uangnya harus dikembalikan manual ke bettor.", "Penghapusan tetap tercatat di riwayat transaksi."],
      confirmLabel: "Hapus taruhan",
      tone: "danger",
    });
    if (!ok) return;
    setRowBusy(b.id);
    const { error } = await sb().from("bets").delete().eq("id", b.id);
    if (error) notify("Gagal hapus taruhan: " + error.message, true);
    else notify(`Taruhan ${b.bettor_name} dihapus.`);
    await reload();
    setRowBusy(null);
  }

  async function setClosed(m: Match, closed: boolean) {
    const { error } = await sb().from("matches").update({ betting_closed: closed }).eq("id", m.id);
    if (error) return notify("Gagal ubah status taruhan: " + error.message, true);
    notify(closed ? `Taruhan fight ${matchCode(m.match_no)} ditutup.` : `Taruhan fight ${matchCode(m.match_no)} dibuka lagi.`);
    await reload();
  }

  /* ---------- tampilan ---------- */
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const shownBets = cur ? cur.bets.filter((b) => !needle || b.bettor_name.toLowerCase().includes(needle) || slipCode(b.id).toLowerCase().includes(needle) || (b.bettor_account ?? "").toLowerCase().includes(needle)) : [];
  const canRemove = selected ? !selected.winner_id && statusOf(selected) !== "cancelled" : false;

  // tandai dibayar cuma superadmin (dijaga juga di database); admin cuma lihat statusnya
  const payCell = (b: Bet, r: BetOutcome) =>
    r.payout > 0 && !isSuper ? (
      b.paid_out ? <span className="paid-tag">Dibayar</span> : <span className="muted">Belum dibayar</span>
    ) : r.payout > 0 ? (
      b.paid_out ? (
        <span className="paid-cell">
          <span className="paid-tag">Dibayar</span>
          <button type="button" className="link-btn" disabled={rowBusy === b.id} onClick={() => setPaid(b, false, r.payout)} aria-label={`Batalin tanda dibayar slip ${slipCode(b.id)}`}>Batal</button>
        </span>
      ) : (
        <button type="button" className="btn sm" disabled={rowBusy === b.id} onClick={() => setPaid(b, true, r.payout)} aria-label={`Tandai slip ${slipCode(b.id)} atas nama ${b.bettor_name} udah dibayar ${yen(r.payout)}`}>
          {rowBusy === b.id ? "Nyimpan…" : "Tandai dibayar"}
        </button>
      )
    ) : <span className="muted">-</span>;

  return (
    <>
      <div className="stats is-compact">
        <div className="stat"><div className="k">Total taruhan</div><div className="v">{yen(totalBet)}</div><div className="s">{bets.length} slip</div></div>
        <div className={"stat" + (owedTotal ? " is-alert" : "")}><div className="k">Belum dibayar</div><div className="v">{yen(owedTotal)}</div><div className="s">{owed.length} slip</div></div>
        {isSuper && <div className="stat"><div className="k">Untung kas</div><div className="v">{yen(houseTotal)}</div><div className="s">dari fight yang selesai</div></div>}
      </div>

      <div className="tabs view-switch" role="group" aria-label="Tampilan">
        <button type="button" className={"tab" + (view === "fight" ? " active" : "")} aria-pressed={view === "fight"} onClick={() => setView("fight")}>Per fight</button>
        <button type="button" className={"tab" + (view === "payouts" ? " active" : "")} aria-pressed={view === "payouts"} onClick={() => setView("payouts")}>
          Belum dibayar{owed.length ? ` (${owed.length})` : ""}
        </button>
      </div>

      {!isSuper && <p className="hint-inline">Yang bisa nandain taruhan udah dibayar cuma superadmin.</p>}

      {view === "payouts" ? (
        owed.length === 0 ? (
          <div className="empty-state">Semua taruhan yang menang atau refund udah dibayar.</div>
        ) : (
          <div className="table-wrap">
            <table className="rtable">
              <thead><tr><th>Slip</th><th>Bettor</th><th>Fight</th><th>Alasan</th><th className="num">Bayar</th><th></th></tr></thead>
              <tbody>
                {owed.map(({ b, m, r }) => (
                  <tr key={b.id}>
                    <td data-label="Slip" className="mono nowrap">{slipCode(b.id)}</td>
                    <td data-label="Bettor"><strong>{b.bettor_name}</strong>{b.bettor_account && <small className="sub-line mono">{b.bettor_account}</small>}</td>
                    <td data-label="Fight">
                      <button type="button" className="link-btn" onClick={() => { setView("fight"); setMatchId(m.id); }}>{matchCode(m.match_no)}</button>
                      <small className="sub-line">jagoan {name(b.fighter_id)}</small>
                    </td>
                    <td data-label="Alasan"><span className={"pill is-static " + (r.status === "Menang" ? "ok" : "neutral")}>{OUTCOME_LABEL[r.status]}</span></td>
                    <td data-label="Bayar" className="num mono"><strong>{yen(r.payout)}</strong></td>
                    <td className="cell-action">{payCell(b, r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : open.length === 0 ? (
        <div className="empty-state">
          Belum ada fight yang dua fighter-nya udah ketahuan.{" "}
          <button type="button" className="link-btn" onClick={() => go("bracket")}>Buka Bracket</button>
        </div>
      ) : (
        <>
          <div className="card bet-head">
            <label className="f">Fight
              <select value={selected?.id ?? ""} onChange={(e) => { setMatchId(e.target.value); setPick(""); edited(); setQ(""); }}>
                {open.map((m) => (
                  <option key={m.id} value={m.id}>
                    {matchCode(m.match_no)} · {roundLabel(m.round, total, m.kind)}: {name(m.fighter1_id)} lawan {name(m.fighter2_id)}
                    {m.winner_id ? " (selesai)" : statusOf(m) === "live" ? " (live)" : statusOf(m) === "cancelled" ? " (batal)" : ""}
                    {owes(m.id) ? " · ada yang belum dibayar" : ""}
                  </option>
                ))}
              </select>
            </label>
            {selected && (
              <div className="row-actions bet-state">
                <BetChip state={state} />
                <span className="hint-inline">{bettingNote(selected)}</span>
                {schemaReady && !selected.winner_id && statusOf(selected) !== "live" && statusOf(selected) !== "cancelled" && (
                  <button className="btn ghost sm" onClick={() => setClosed(selected, !selected.betting_closed)}>
                    {selected.betting_closed ? "Buka lagi taruhan" : "Tutup taruhan"}
                  </button>
                )}
              </div>
            )}
          </div>

          {selected && cur && (
            <>
              {state === "open" && (
                <form className="card bet-form" onSubmit={addBet} noValidate>
                  <h3>Catat taruhan</h3>
                  <fieldset className="choice">
                    <legend>Jagoan</legend>
                    <div className="choice-grid">
                      {[selected.fighter1_id!, selected.fighter2_id!].map((fid, i) => {
                        const own = i === 0 ? cur.pool1 : cur.pool2;
                        const other = i === 0 ? cur.pool2 : cur.pool1;
                        const x = multiplier(own, other, selected.house_cut);
                        return (
                          <label key={fid} className={"choice-opt is-fighter" + (pick === fid ? " is-on" : "")}>
                            <input type="radio" name="pick" value={fid} checked={pick === fid} onChange={() => { setPick(fid); edited(); }} />
                            <span>{name(fid)}<small>pool {yen(own)}{x ? ` · x${x.toFixed(2)}` : ""}</small></span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                  <div className="form-grid">
                    <label className="f">Nama bettor<input ref={nameRef} type="text" value={bettor} onChange={(e) => { setBettor(e.target.value); edited(); }} maxLength={60} autoComplete="off" /></label>
                    <label className="f">Rekening / Yentag (opsional)<input type="text" value={account} onChange={(e) => { setAccount(e.target.value); edited(); }} placeholder="buat transfer kalau menang" maxLength={100} autoComplete="off" /></label>
                    <label className="f">Nominal<MoneyInput value={amount} onChange={(v) => { setAmount(v); edited(); }} placeholder="25.000" maxDigits={9} /></label>
                  </div>
                  {formErr && <div className="notice err admin-modal-err" role="alert">{formErr}</div>}
                  <div className="row-actions settings-actions">
                    <button className="btn" disabled={busy}>{busy ? "Nyatat…" : "Catat taruhan"}</button>
                  </div>
                </form>
              )}

              {lastSlip && (
                <div className="last-slip" role="status">
                  <div>
                    <span className="last-slip-k">{lastSlip.duplicate ? "Udah kecatat sebelumnya" : "Slip baru"} · kasih kode ini ke bettor</span>
                    <b className="mono">{lastSlip.code}</b>
                    <span className="last-slip-d">{lastSlip.bettor}, {yen(lastSlip.amount)} ke {lastSlip.fighter} (fight {lastSlip.match})</span>
                  </div>
                  <div className="row-actions">
                    <button type="button" className="btn ghost sm" onClick={() => copySlip(lastSlip.code)}>Salin kode</button>
                    <button type="button" className="link-btn" onClick={() => setLastSlip(null)}>Tutup</button>
                  </div>
                </div>
              )}

              {state !== "open" && (
                <div className="notice">
                  {selected.winner_id ? (
                    <>Fight selesai, <strong>{name(selected.winner_id)}</strong> menang. Bayar yang menang, lalu tekan <b>Tandai dibayar</b>.</>
                  ) : statusOf(selected) === "cancelled" ? (
                    <>Fight dibatalkan. Kembalikan semua taruhan utuh, lalu tekan <b>Tandai dibayar</b>.</>
                  ) : (
                    bettingNote(selected)
                  )}
                </div>
              )}

              <div className="pools-admin">
                {[selected.fighter1_id!, selected.fighter2_id!].map((fid, i) => {
                  const own = i === 0 ? cur.pool1 : cur.pool2;
                  const other = i === 0 ? cur.pool2 : cur.pool1;
                  const x = multiplier(own, other, selected.house_cut);
                  return (
                    <div key={fid} className={"stat" + (selected.winner_id === fid ? " is-win" : "")}>
                      <div className="k">{name(fid)}</div>
                      <div className="v">{yen(own)}</div>
                      <div className="s">{selected.winner_id ? (selected.winner_id === fid ? "menang" : "kalah") : x ? `kalau menang x${x.toFixed(2)}` : "belum ada taruhan"}</div>
                    </div>
                  );
                })}
                {isSuper && <CutBox m={selected} locked={!!selected.winner_id || cur.bets.some((b) => b.paid_out)} notify={notify} reload={reload} house={cur.house} />}
              </div>

              <div className="list-head">
                <h3>Taruhan fight ini <span className="count">{cur.bets.length}</span></h3>
                {cur.bets.length > 5 && (
                  <input type="search" className="list-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama atau kode slip" aria-label="Cari taruhan" />
                )}
              </div>
              {cur.bets.length === 0 ? (
                <div className="empty-state">Belum ada taruhan di fight ini.</div>
              ) : shownBets.length === 0 ? (
                <div className="empty-state">Gak ada taruhan yang cocok sama &quot;{q}&quot;.</div>
              ) : (
                <div className="table-wrap">
                  <table className="rtable">
                    <thead><tr><th>Slip</th><th>Bettor</th><th>Jagoan</th><th className="num">Taruhan</th><th>Hasil</th><th className="num">Bayar</th><th>Status bayar</th>{canRemove && <th></th>}</tr></thead>
                    <tbody>
                      {shownBets.map((b) => {
                        const r = cur.results.get(b.id)!;
                        return (
                          <tr key={b.id}>
                            <td data-label="Slip" className="mono nowrap">{slipCode(b.id)}</td>
                            <td data-label="Bettor"><strong>{b.bettor_name}</strong>{b.bettor_account && <small className="sub-line mono">{b.bettor_account}</small>}</td>
                            <td data-label="Jagoan">{name(b.fighter_id)}</td>
                            <td data-label="Taruhan" className="num mono">{yen(b.amount)}</td>
                            <td data-label="Hasil"><span className={"pill is-static " + (r.status === "Menang" || r.status === "Batal" ? "ok" : r.status === "Kalah" ? "no" : "neutral")}>{OUTCOME_LABEL[r.status]}</span></td>
                            <td data-label="Bayar" className="num mono">{r.payout ? yen(r.payout) : "-"}</td>
                            <td data-label="Status bayar">{payCell(b, r)}</td>
                            {canRemove && (
                              <td className="cell-action">
                                <button className="btn danger sm" disabled={rowBusy === b.id} onClick={() => removeBet(b)} aria-label={`Hapus taruhan ${b.bettor_name} ${yen(b.amount)}`}>Hapus</button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {schemaReady && (
                <details className="admin-details">
                  <summary>Riwayat transaksi fight ini ({log.length})</summary>
                  {log.length === 0 ? (
                    <div className="empty-state">Belum ada transaksi.</div>
                  ) : (
                    <div className="table-wrap">
                      <table className="rtable">
                        <thead><tr><th>Waktu</th><th>Aksi</th><th>Bettor</th><th>Jagoan</th><th className="num">Nominal</th><th>Oleh</th></tr></thead>
                        <tbody>
                          {log.map((l) => (
                            <tr key={l.id}>
                              <td data-label="Waktu" className="nowrap">{fmtWhen(l.created_at)}</td>
                              <td data-label="Aksi">{ACTION_LABEL[l.action]}</td>
                              <td data-label="Bettor">{l.bettor_name}</td>
                              <td data-label="Jagoan">{l.fighter_name ?? "-"}</td>
                              <td data-label="Nominal" className="num mono">{yen(l.amount)}</td>
                              <td data-label="Oleh">{l.actor_name ?? "Sistem"}</td>
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

/** Potongan kas per fight (superadmin). Disimpan pakai tombol, bukan waktu kursor pindah. */
function CutBox({ m, locked, house, notify, reload }: { m: Match; locked: boolean; house: number; notify: TabProps["notify"]; reload: TabProps["reload"] }) {
  const saved = String(Math.round(m.house_cut * 100));
  const [v, setV] = useState(saved);
  const [busy, setBusy] = useState(false);
  useEffect(() => setV(saved), [saved, m.id]);
  const n = Number(v);
  const bad = v.trim() === "" || !Number.isFinite(n) || n < 0 || n > 90;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (bad || busy || v === saved) return;
    setBusy(true);
    const { error } = await sb().from("matches").update({ house_cut: Math.round(n) / 100 }).eq("id", m.id);
    if (error) notify("Gagal ubah potongan kas: " + error.message, true);
    else { notify(`Potongan kas fight ${matchCode(m.match_no)} jadi ${Math.round(n)}%.`); await reload(); }
    setBusy(false);
  }

  return (
    <form className="stat cut-box" onSubmit={save}>
      <label className="k" htmlFor={"cut-" + m.id}>Potongan kas fight ini</label>
      {locked ? (
        <>
          <div className="v">{saved}%</div>
          <div className="s">{m.winner_id ? `untung kas ${yen(house)}` : "dikunci, udah ada yang dibayar"}</div>
        </>
      ) : (
        <>
          <div className="cut-row">
            <input id={"cut-" + m.id} type="number" inputMode="numeric" min={0} max={90} step={1} value={v} onChange={(e) => setV(e.target.value)} aria-invalid={bad || undefined} />
            <span aria-hidden="true">%</span>
            {v !== saved && <button className="btn sm" disabled={bad || busy}>{busy ? "…" : "Simpan"}</button>}
          </div>
          <div className="s">dipotong dari uang pihak yang kalah</div>
        </>
      )}
    </form>
  );
}
