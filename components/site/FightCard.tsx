"use client";
import Mugshot from "@/components/ui/Mugshot";
import Countdown from "@/components/ui/Countdown";
import { StatusChip } from "@/components/ui/Chips";
import { useUi } from "@/components/site/Ui";
import { fighterCode } from "@/lib/codes";
import { METHOD_SHORT, fmtWhen, matchCode, statusOf } from "@/lib/fight";
import type { Fighter, Match } from "@/lib/types";

type Props = { m: Match; f1?: Fighter; f2?: Fighter; round: string };

/** Kartu fight ringkas (tembok gelap): nomor, babak, dua fighter, status, jadwal. */
export default function FightCard({ m, f1, f2, round }: Props) {
  const ui = useUi();
  const st = statusOf(m);
  const when = fmtWhen(m.scheduled_at);

  const row = (f: Fighter | undefined) => {
    const win = !!m.winner_id && f?.id === m.winner_id;
    const lose = !!m.winner_id && !!f && f.id !== m.winner_id;
    return (
      <li className={"fc-row" + (win ? " is-win" : "") + (lose ? " is-lose" : "")}>
        <button type="button" className="fc-fighter" disabled={!f} onClick={() => f && ui.openFighter(f.id)}>
          <Mugshot name={f?.name} url={f?.photo_url} size="md" />
          <span className="fc-who">
            <span className="fc-name">{f?.name ?? "Belum ada"}</span>
            <span className="fc-code">{fighterCode(f?.id)}</span>
          </span>
        </button>
        {win && <span className="mark mark-win">Win</span>}
        {lose && <span className="mark mark-loss">Loss</span>}
      </li>
    );
  };

  return (
    <article className={`fc is-${st}`}>
      <header className="fc-head">
        <b className="fc-no">{matchCode(m.match_no)}</b>
        <span className="fc-stage">{round}</span>
        <StatusChip status={st} />
      </header>
      <ul className="fc-rows">
        {row(f1)}
        {row(f2)}
      </ul>
      <footer className="fc-foot">
        <p className="fc-when">
          {st === "upcoming" && (when ? <><span>{when}</span><Countdown to={m.scheduled_at} /></> : "Jam mulai nyusul")}
          {st === "live" && "Lagi jalan"}
          {st === "postponed" && (when ? `Jadwal baru: ${when}` : "Jadwal baru nyusul")}
          {st === "cancelled" && "Gak jadi tanding"}
          {st === "completed" && (m.result_method ? `Selesai, ${METHOD_SHORT[m.result_method]}` : "Selesai")}
        </p>
        <button type="button" className="link-btn" onClick={() => ui.openMatch(m.id)}>
          Detail<span className="sr-only"> fight {matchCode(m.match_no)}</span>
        </button>
      </footer>
    </article>
  );
}
