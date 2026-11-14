"use client";
import Mugshot from "@/components/ui/Mugshot";
import Stamp from "@/components/ui/Stamp";
import Barcode from "@/components/ui/Barcode";
import { StatusChip } from "@/components/ui/Chips";
import { useUi } from "@/components/site/Ui";
import { fighterCode, tilt, times, tornClip } from "@/lib/codes";
import { multiplier, yen } from "@/lib/betting";
import { METHOD_SHORT, fmtClock, pad3, statusOf } from "@/lib/fight";
import type { Fighter, Match, Pool } from "@/lib/types";

type Props = { m: Match; f1?: Fighter; f2?: Fighter; pool?: Pool; round: string };

/** Poster fotokopian buat fight yang lagi jalan atau dipanggil ke ring. */
export default function FightPoster({ m, f1, f2, pool, round }: Props) {
  const ui = useUi();
  const st = statusOf(m);
  const done = st === "completed";
  const side = (f?: Fighter) => (!done || !f ? "" : m.winner_id === f.id ? "is-win" : "is-lose");
  const winner = done ? (m.winner_id === f1?.id ? f1 : f2) : undefined;
  const p1 = pool?.pool1 ?? 0;
  const p2 = pool?.pool2 ?? 0;
  const hasBets = (pool?.bet_count ?? 0) > 0;
  const first = (f?: Fighter, fallback = "?") => (f?.name ?? fallback).split(/[\s_]+/)[0];
  // kata terpanjang dipakai buat ngecilin font, biar nama gak patah di tengah kata
  const longest = Math.max(4, ...[f1?.name, f2?.name].flatMap((n) => (n ?? "TBD").split(/[\s_]+/)).map((w) => w.length));
  // username Roblox kayak Takeshi_Ryuzaki boleh patah di garis bawah, bukan di tengah kata
  const breakable = (n?: string) => (n ? n.replace(/_/g, "_​") : "TBD");
  const clock = fmtClock(m.duration_sec);

  return (
    <article
      className={`poster is-${st}${done ? " is-done" : ""}`}
      style={{ "--tilt": `${tilt(m.id, 1.1)}deg`, clipPath: tornClip("poster" + m.id, { top: true, bottom: true }, 8) } as React.CSSProperties}
    >
      <span className="tape tape-a" aria-hidden="true" />
      <span className="tape tape-b" aria-hidden="true" />

      <header className="poster-head">
        <span className="poster-no">Fight {pad3(m.match_no)}</span>
        <span className="poster-round">{round}</span>
        <StatusChip status={st} className="on-paper" />
      </header>

      <div className="poster-photos">
        {[f1, f2].map((f, i) => (
          <figure key={i} className={`pp pp-${i ? "b" : "a"} ${side(f)}`}>
            <button type="button" className="pp-open" tabIndex={-1} aria-hidden="true" disabled={!f} onClick={() => f && ui.openFighter(f.id)}>
              <Mugshot name={f?.name} url={f?.photo_url} size="xl" surface="print" />
            </button>
            {done && f && m.winner_id === f.id && (
              <Stamp tone="red" tilt={7} slam className="pp-result">
                <span className="jp">勝</span>
                <span className="stamp-sub">Win</span>
              </Stamp>
            )}
            {done && f && m.winner_id !== f.id && (
              <>
                <span className="pp-cross" />
                <Stamp tone="ink" tilt={-6} slam className="pp-result is-loss">Loss</Stamp>
              </>
            )}
          </figure>
        ))}
        <span className="poster-vs" aria-hidden="true">VS</span>
      </div>

      <h3 className="poster-names" style={{ "--len": longest } as React.CSSProperties}>
        <button type="button" className={`pn pn-a ${side(f1)}`} disabled={!f1} onClick={() => f1 && ui.openFighter(f1.id)}>
          {breakable(f1?.name)}
        </button>
        <span className="sr-only"> lawan </span>
        <button type="button" className={`pn pn-b ${side(f2)}`} disabled={!f2} onClick={() => f2 && ui.openFighter(f2.id)}>
          {breakable(f2?.name)}
        </button>
      </h3>
      <p className="poster-codes" aria-hidden="true">
        <span>{fighterCode(f1?.id)}</span>
        <span>{fighterCode(f2?.id)}</span>
      </p>

      <p className="poster-when">
        {st === "live" && <>Fight lagi jalan.</>}
        {st === "upcoming" && <>Dipanggil panitia. Sebentar lagi naik ring.</>}
        {st === "postponed" && <>Ditunda panitia.</>}
        {st === "cancelled" && <>Fight ini dibatalkan. Taruhan dikembalikan utuh.</>}
        {done && (
          <>
            {winner?.name ?? "?"} menang{m.result_method ? `, ${METHOD_SHORT[m.result_method]}` : ""}
            {clock ? ` dalam ${clock}` : ""}.
          </>
        )}
      </p>

      <footer className="poster-foot">
        {hasBets ? (
          <dl className="poster-pool">
            <div><dt>Pool</dt><dd>{yen(p1 + p2)}</dd></div>
            <div><dt>{first(f1, "Kiri")} menang</dt><dd>{times(multiplier(p1, p2, m.house_cut))}</dd></div>
            <div><dt>{first(f2, "Kanan")} menang</dt><dd>{times(multiplier(p2, p1, m.house_cut))}</dd></div>
          </dl>
        ) : (
          <p className="poster-nobet">{st === "upcoming" || st === "postponed" ? "Taruhan dibuka di lokasi. Cari Finance Betting." : "Gak ada taruhan di fight ini."}</p>
        )}
        <div className="poster-actions">
          <button type="button" className="ink-btn" onClick={() => ui.openMatch(m.id)}>Detail fight</button>
          <Barcode value={m.id} className="poster-bar" />
        </div>
      </footer>

      {done && (
        <Stamp tone="red" tilt={-9} slam className="poster-stamp" key="done">
          <b>{m.result_method ? METHOD_SHORT[m.result_method] : "Win"}</b>
          <span>{first(winner)} menang</span>
        </Stamp>
      )}
      {st === "live" && (
        <Stamp tone="red" tilt={6} slam className="poster-stamp is-live" key="live">
          <b>Live</b>
          <span>lagi di ring</span>
        </Stamp>
      )}
      {st === "postponed" && (
        <Stamp tone="ink" tilt={5} slam className="poster-stamp" key="postponed">
          <b>Tunda</b>
          <span>nanti lanjut</span>
        </Stamp>
      )}
      {st === "cancelled" && (
        <Stamp tone="ink" tilt={-7} slam className="poster-stamp" key="cancelled">
          <b>Batal</b>
          <span>gak jadi tanding</span>
        </Stamp>
      )}
    </article>
  );
}
