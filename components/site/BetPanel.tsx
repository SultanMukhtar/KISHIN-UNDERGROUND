"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import Stamp from "@/components/ui/Stamp";
import { BetChip } from "@/components/ui/Chips";
import { MAX_BET, betOutcome, multiplier, parseAmount, payout, slipCode, yen } from "@/lib/betting";
import { times } from "@/lib/codes";
import { bettingNote, bettingStateOf, fmtWhen, matchCode } from "@/lib/fight";
import { placeBet, type NewBet } from "@/lib/staff";
import { sb } from "@/lib/supabase";
import type { Me } from "@/lib/adminTypes";
import type { Bet, Fighter, Match, Pool } from "@/lib/types";

type Props = {
  m: Match;
  f1?: Fighter;
  f2?: Fighter;
  pool?: Pool;
  round: string;
  /** panitia yang lagi login di browser ini. null = penonton */
  staff: Me | null;
  onChanged: () => void;
  onClose: () => void;
};

type Step = "form" | "review" | "done";
type Errors = { pick?: string; bettor?: string; amount?: string; form?: string };

/** Detail taruhan satu fight. Penonton: angka & cara pasang. Panitia: catat taruhan + daftar transaksi. */
export default function BetPanel({ m, f1, f2, pool, round, staff, onChanged, onClose }: Props) {
  const uid = useId();
  const state = bettingStateOf(m);
  const p1 = pool?.pool1 ?? 0;
  const p2 = pool?.pool2 ?? 0;
  const sum = p1 + p2;
  const pctA = sum ? Math.round((p1 / sum) * 100) : 50;
  const name = (id: string | null) => (id === f1?.id ? f1?.name : id === f2?.id ? f2?.name : undefined) ?? "?";
  const winner = m.winner_id ? name(m.winner_id) : null;

  /* ---------- panitia: daftar transaksi fight ini ---------- */
  const [bets, setBets] = useState<Bet[] | null>(null);
  const loadBets = useCallback(async () => {
    if (!staff) return;
    const { data, error } = await sb().from("bets").select("*").eq("match_id", m.id).order("created_at", { ascending: false });
    if (!error) setBets((data ?? []) as Bet[]);
  }, [staff, m.id]);
  useEffect(() => { loadBets(); }, [loadBets]);

  /* ---------- panitia: catat taruhan ---------- */
  const [step, setStep] = useState<Step>("form");
  const [pick, setPick] = useState("");
  const [bettor, setBettor] = useState("");
  const [account, setAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<NewBet | null>(null);
  const sending = useRef(false);

  function review(e: React.FormEvent) {
    e.preventDefault();
    const errs: Errors = {};
    const amt = parseAmount(amount);
    if (pick !== m.fighter1_id && pick !== m.fighter2_id) errs.pick = "Pilih jagoannya dulu.";
    if (!bettor.trim()) errs.bettor = "Isi nama bettor.";
    else if (bettor.trim().length > 60) errs.bettor = "Nama maksimal 60 karakter.";
    if (amt === null) errs.amount = "Isi nominal pakai angka aja, lebih dari 0. Contoh: 25000.";
    else if (amt > MAX_BET) errs.amount = `Maksimal ${yen(MAX_BET)} per taruhan.`;
    setErrors(errs);
    if (Object.keys(errs).length || amt === null) return;
    // id dibuat sekali di sini: kirim ulang data yang sama gak bakal kecatat dobel
    setDraft({ id: crypto.randomUUID(), match_id: m.id, bettor_name: bettor.trim(), bettor_account: account.trim() || null, fighter_id: pick, amount: amt });
    setStep("review");
  }

  async function confirm() {
    if (!draft || sending.current) return;
    sending.current = true;
    setBusy(true);
    setErrors({});
    try {
      await placeBet(draft);
      setStep("done");
      onChanged();
      loadBets();
    } catch (err) {
      setErrors({ form: (err as Error).message });
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  function another() {
    setDraft(null);
    setBettor("");
    setAccount("");
    setAmount("");
    setPick("");
    setErrors({});
    setStep("form");
  }

  const ownPool = draft ? (draft.fighter_id === m.fighter1_id ? p1 : p2) : 0;
  const otherPool = draft ? (draft.fighter_id === m.fighter1_id ? p2 : p1) : 0;

  return (
    <Modal onClose={onClose} labelledBy={uid + "t"} className="sheet sheet-bet">
      <header className="sheet-head">
        <p className="sheet-kicker">Meja taruhan, fight {matchCode(m.match_no)}, {round}</p>
        <h2 id={uid + "t"} className="sheet-title">
          {f1?.name ?? "?"} <span className="vs">vs</span> {f2?.name ?? "?"}
        </h2>
        <p className="sheet-state">
          <BetChip state={state} className="on-paper" />
          <span>{bettingNote(m)}</span>
        </p>
      </header>

      <section className="sheet-sec" aria-label="Pool taruhan">
        <div className="pools">
          {[{ f: f1, own: p1, other: p2, id: m.fighter1_id }, { f: f2, own: p2, other: p1, id: m.fighter2_id }].map((s, i) => (
            <div key={i} className={"pool-side" + (m.winner_id ? (m.winner_id === s.id ? " is-win" : " is-lose") : "")}>
              <p className="pool-name">{s.f?.name ?? "?"}</p>
              <p className="pool-money">{s.own ? yen(s.own) : "Belum ada"}</p>
              {s.own > 0 && <p className="pool-x">{times(multiplier(s.own, s.other, m.house_cut))}<span> kalau menang</span></p>}
            </div>
          ))}
        </div>
        <div className="slip-bar on-paper" aria-hidden="true"><i style={{ width: `${pctA}%` }} /></div>
        <dl className="facts">
          <div><dt>Total pool</dt><dd>{yen(sum)}</dd></div>
          <div><dt>Taruhan masuk</dt><dd>{pool?.bet_count ?? 0}</dd></div>
          <div><dt>Peserta</dt><dd>{pool?.bettors ?? "–"}</dd></div>
          <div><dt>Potongan kas</dt><dd>{Math.round(m.house_cut * 100)}% dari pihak kalah</dd></div>
          {winner && <div><dt>Hasil</dt><dd>{winner} menang</dd></div>}
        </dl>
      </section>

      {!staff && (
        <section className="sheet-sec" aria-label="Cara pasang taruhan">
          <h3 className="sheet-sub">Cara pasang</h3>
          {state === "open" ? (
            <ol className="steps">
              <li>Datangi Finance Betting di lokasi sebelum fight mulai.</li>
              <li>Sebut nama, jagoan, dan nominal. Serahin Yen-nya.</li>
              <li>Simpan kode slip yang dikasih. Itu bukti taruhanmu.</li>
            </ol>
          ) : (
            <p className="sheet-note">{bettingNote(m)} Udah pasang? Cek hasilnya pakai kode slip di bagian Meja taruhan.</p>
          )}
          <p className="sheet-fine">Semua taruhan pakai mata uang RP. Nama dan nominal tiap orang gak ditampilkan.</p>
        </section>
      )}

      {staff && (
        <section className="sheet-sec" aria-label="Catat taruhan">
          <h3 className="sheet-sub">Catat taruhan <small>login sebagai {staff.username}</small></h3>

          {state !== "open" && step !== "done" ? (
            <p className="sheet-note">{bettingNote(m)}</p>
          ) : step === "form" ? (
            <form className="betform" onSubmit={review} noValidate>
              <fieldset className="pickset" aria-describedby={errors.pick ? uid + "ep" : undefined}>
                <legend>Jagoan</legend>
                {[f1, f2].map((f) => f && (
                  <label key={f.id} className={"pick" + (pick === f.id ? " is-on" : "")}>
                    <input type="radio" name={uid + "pick"} value={f.id} checked={pick === f.id} onChange={() => { setPick(f.id); setErrors((x) => ({ ...x, pick: undefined })); }} />
                    <span>{f.name}</span>
                  </label>
                ))}
              </fieldset>
              {errors.pick && <p className="field-err" id={uid + "ep"} role="alert">{errors.pick}</p>}

              <label className="pf" htmlFor={uid + "b"}>Nama bettor</label>
              <input id={uid + "b"} type="text" value={bettor} maxLength={60} autoComplete="off" onChange={(e) => setBettor(e.target.value)}
                aria-invalid={!!errors.bettor || undefined} aria-describedby={errors.bettor ? uid + "eb" : undefined} />
              {errors.bettor && <p className="field-err" id={uid + "eb"} role="alert">{errors.bettor}</p>}

              <label className="pf" htmlFor={uid + "a"}>Rekening / Yentag <small>opsional, buat transfer kalau menang</small></label>
              <input id={uid + "a"} type="text" value={account} maxLength={100} autoComplete="off" onChange={(e) => setAccount(e.target.value)} />

              <label className="pf" htmlFor={uid + "n"}>Nominal (¥)</label>
              <input id={uid + "n"} type="text" inputMode="numeric" value={amount} autoComplete="off" placeholder="25000" onChange={(e) => setAmount(e.target.value)}
                aria-invalid={!!errors.amount || undefined} aria-describedby={errors.amount ? uid + "en" : undefined} />
              {errors.amount && <p className="field-err" id={uid + "en"} role="alert">{errors.amount}</p>}

              <button type="submit" className="ink-btn is-solid">Periksa dulu</button>
            </form>
          ) : step === "review" && draft ? (
            <div className="betreview">
              <dl className="facts is-stack">
                <div><dt>Bettor</dt><dd>{draft.bettor_name}</dd></div>
                <div><dt>Rekening / Yentag</dt><dd>{draft.bettor_account ?? "Gak diisi"}</dd></div>
                <div><dt>Jagoan</dt><dd>{name(draft.fighter_id)}</dd></div>
                <div><dt>Nominal</dt><dd>{yen(draft.amount)}</dd></div>
                <div>
                  <dt>Kalau menang</dt>
                  <dd>sekitar {yen(payout(draft.amount, ownPool + draft.amount, otherPool, m.house_cut))}, bisa berubah sampai taruhan ditutup</dd>
                </div>
              </dl>
              {errors.form && <p className="field-err" role="alert">{errors.form}</p>}
              <div className="betactions">
                <button type="button" className="ink-btn is-solid" onClick={confirm} disabled={busy}>
                  {busy ? "Nyatat…" : "Catat taruhan"}
                </button>
                <button type="button" className="ink-btn" onClick={() => setStep("form")} disabled={busy}>Ubah</button>
              </div>
            </div>
          ) : draft ? (
            <div className="betdone" role="status">
              <Stamp tone="red" tilt={-5} slam className="betdone-stamp">Tercatat</Stamp>
              <p className="ticket-code">{slipCode(draft.id)}</p>
              <p className="sheet-note">
                Taruhan {draft.bettor_name} {yen(draft.amount)} ke {name(draft.fighter_id)} udah dicatat.
                Kasih kode slip ini ke bettor-nya.
              </p>
              <div className="betactions">
                {state === "open" && <button type="button" className="ink-btn is-solid" onClick={another}>Catat taruhan lain</button>}
                <button type="button" className="ink-btn" onClick={onClose}>Selesai</button>
              </div>
            </div>
          ) : null}
        </section>
      )}

      {staff && (
        <section className="sheet-sec" aria-label="Riwayat transaksi">
          <h3 className="sheet-sub">Riwayat transaksi <small>cuma kelihatan sama panitia</small></h3>
          {bets === null ? (
            <p className="sheet-note" role="status">Ngambil daftar taruhan…</p>
          ) : bets.length === 0 ? (
            <p className="sheet-note">Belum ada taruhan di fight ini.</p>
          ) : (
            <div className="txwrap">
              <table className="tx">
                <thead><tr><th>Kode slip</th><th>Bettor</th><th>Jagoan</th><th>Nominal</th><th>Hasil</th><th>Dicatat</th></tr></thead>
                <tbody>
                  {bets.map((b) => {
                    // pool dihitung dari daftar ini (paling baru), bukan dari angka publik yang di-refresh berkala
                    const side = (id: string | null) => bets.filter((x) => x.fighter_id === id).reduce((n, x) => n + x.amount, 0);
                    const out = betOutcome(m, side(m.fighter1_id), side(m.fighter2_id), b);
                    return (
                      <tr key={b.id}>
                        <td className="mono">{slipCode(b.id)}</td>
                        <td>{b.bettor_name}</td>
                        <td>{name(b.fighter_id)}</td>
                        <td className="mono">{yen(b.amount)}</td>
                        <td>
                          {out.status}
                          {out.payout > 0 && `, ${yen(out.payout)}${b.paid_out ? " (dibayar)" : " (belum dibayar)"}`}
                        </td>
                        <td>{fmtWhen(b.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="sheet-fine">Hapus taruhan dan tandai pembayaran dilakukan di <a href="/admin">panel panitia</a>.</p>
        </section>
      )}
    </Modal>
  );
}
