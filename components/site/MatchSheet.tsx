"use client";
import { useId } from "react";
import Modal from "@/components/ui/Modal";
import Mugshot from "@/components/ui/Mugshot";
import Stamp from "@/components/ui/Stamp";
import { StatusChip } from "@/components/ui/Chips";
import { useUi } from "@/components/site/Ui";
import { fighterCode } from "@/lib/codes";
import { stageLabel } from "@/lib/bracket";
import { poolSum, yen } from "@/lib/betting";
import { METHOD_LABEL, bettingNote, fmtClock, fmtWhen, isReady, matchCode } from "@/lib/fight";
import type { Fighter, Match, MatchStatus, Pool, ResultMethod } from "@/lib/types";

/** Data yang ditampilin lembar detail: bisa dari match yang masih ada, atau dari catatan arsip. */
export type SheetData = {
  matchNo: number;
  stage: string;
  tournamentName: string | null;
  status: MatchStatus;
  a: { id: string | null; name: string | null };
  b: { id: string | null; name: string | null };
  winnerSide: 1 | 2 | null;
  method: ResultMethod | null;
  durationSec: number | null;
  completedAt: string | null;
  /** teks "nunggu pemenang fight ..." kalau slotnya belum keisi */
  waiting?: string | null;
  /** match aslinya (kalau masih ada) → tombol meja taruhan */
  match?: Match;
  pool?: Pool;
};

/** Lembar detail satu fight: dua fighter, status, dan hasil resminya. */
export default function MatchSheet({ data: d, byId, onClose }: { data: SheetData; byId: Map<string, Fighter>; onClose: () => void }) {
  const ui = useUi();
  const uid = useId();
  const done = d.status === "completed" && d.winnerSide !== null;
  const clock = fmtClock(d.durationSec);
  const winner = d.winnerSide === 1 ? d.a : d.winnerSide === 2 ? d.b : null;

  const corner = (c: SheetData["a"], n: 1 | 2) => {
    const f = c.id ? byId.get(c.id) : undefined;
    const win = done && d.winnerSide === n;
    const lose = done && d.winnerSide !== n;
    const body = (
      <>
        <span className="ms-photo">
          <Mugshot name={c.name} url={f?.photo_url} size="xl" surface="print" />
          {win && <Stamp tone="red" tilt={n === 1 ? -8 : 8} slam className="ms-result">Win</Stamp>}
          {lose && <Stamp tone="ink" tilt={n === 1 ? 6 : -6} slam className="ms-result is-loss">Loss</Stamp>}
        </span>
        <span className="ms-name">{c.name ?? "Belum ada"}</span>
        <span className="ms-code">{c.id ? fighterCode(c.id) : c.name ? "Fighter udah gak terdaftar" : d.waiting ?? "Nunggu lawan"}</span>
      </>
    );
    return f ? (
      <button type="button" className={"ms-corner" + (win ? " is-win" : "") + (lose ? " is-lose" : "")} onClick={() => ui.openFighter(f.id)}>
        {body}
        <span className="ms-open">Buka dossier</span>
      </button>
    ) : (
      <div className={"ms-corner is-static" + (win ? " is-win" : "") + (lose ? " is-lose" : "")}>{body}</div>
    );
  };

  return (
    <Modal onClose={onClose} labelledBy={uid} className="sheet sheet-match">
      <header className="sheet-head">
        <p className="sheet-kicker">
          {stageLabel(d.stage)}
          {d.tournamentName ? `, ${d.tournamentName}` : ""}
        </p>
        <h2 id={uid} className="sheet-title">Match {matchCode(d.matchNo)}</h2>
        <p className="sheet-state"><StatusChip status={d.status} className="on-paper" /></p>
      </header>

      <div className="ms-versus">
        {corner(d.a, 1)}
        <span className="ms-vs" aria-hidden="true">VS</span>
        {corner(d.b, 2)}
      </div>

      <section className="sheet-sec" aria-label="Info fight">
        <dl className="facts">
          {done ? (
            <>
              <div><dt>Winner</dt><dd>{winner?.name ?? "?"}</dd></div>
              <div><dt>Method</dt><dd>{d.method ? METHOD_LABEL[d.method] : "Gak dicatat"}</dd></div>
              <div><dt>Durasi</dt><dd>{clock ?? "Gak dicatat"}</dd></div>
              <div><dt>Hasil masuk</dt><dd>{fmtWhen(d.completedAt) ?? "Gak dicatat"}</dd></div>
            </>
          ) : (
            <div>
              <dt>Hasil</dt>
              <dd>
                {d.status === "cancelled"
                  ? "Gak ada, fight batal"
                  : d.status === "live"
                    ? "Belum ada, fight lagi jalan"
                    : d.status === "postponed"
                      ? "Belum ada, fight ditunda"
                      : "Belum ada"}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {d.match && isReady(d.match) && (
        <section className="sheet-sec ms-bet" aria-label="Taruhan">
          <p className="sheet-note">
            {poolSum(d.pool) ? `Pool taruhan ${yen(poolSum(d.pool))} dari ${d.pool?.bet_count ?? 0} taruhan. ` : ""}
            {bettingNote(d.match)}
          </p>
          <button type="button" className="ink-btn" onClick={() => ui.openBet(d.match!.id)}>Buka meja taruhan</button>
        </section>
      )}
    </Modal>
  );
}
