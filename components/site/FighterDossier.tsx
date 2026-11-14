"use client";
import { useId } from "react";
import Modal from "@/components/ui/Modal";
import Mugshot from "@/components/ui/Mugshot";
import Stamp from "@/components/ui/Stamp";
import Barcode from "@/components/ui/Barcode";
import { useUi } from "@/components/site/Ui";
import { fighterCode, pad2 } from "@/lib/codes";
import { roundLabel, stageLabel } from "@/lib/bracket";
import {
  FIGHTER_STATE_LABEL, METHOD_SHORT, fighterStateOf, fighterStats, fmtClock, fmtDate, matchCode, nextMatchOf, statusOf,
  type FightRecord,
} from "@/lib/fight";
import type { Fighter, Match } from "@/lib/types";

type Props = {
  fighter: Fighter;
  matches: Match[];
  records: FightRecord[];
  byId: Map<string, Fighter>;
  total: number;
  onClose: () => void;
};

/** FIGHTER DOSSIER: berkas identitas satu fighter. Semua angka dihitung dari catatan fight resmi. */
export default function FighterDossier({ fighter: f, matches, records, byId, total, onClose }: Props) {
  const ui = useUi();
  const uid = useId();
  const stats = fighterStats(f.id, records);
  const state = fighterStateOf(f, matches);
  const next = nextMatchOf(f.id, matches);
  const nextFoe = next ? byId.get((next.fighter1_id === f.id ? next.fighter2_id : next.fighter1_id) ?? "") : undefined;
  const good = state === "champion" || state === "active" || state === "runner_up" || state === "third_place";

  return (
    <Modal onClose={onClose} labelledBy={uid} className="sheet sheet-dossier">
      <header className="dos-head">
        <p className="dos-kicker">Fighter dossier</p>
        <Barcode value={f.id} className="dos-bar" />
      </header>

      <div className="dos-top">
        <figure className="dos-photo">
          <Mugshot name={f.name} url={f.photo_url} size="xl" surface="print" />
          <figcaption>{fighterCode(f.id)}</figcaption>
          <Stamp tone={good ? "red" : "ink"} tilt={state === "champion" ? -9 : 7} slam className="dos-stamp">
            {state === "champion" && <span className="jp">王者</span>}
            <span>{FIGHTER_STATE_LABEL[state]}</span>
          </Stamp>
        </figure>

        <div className="dos-id">
          <h2 id={uid} className="dos-name">{f.name}</h2>
          <dl className="dos-fields">
            <div><dt>Fighter ID</dt><dd>{fighterCode(f.id)}</dd></div>
            <div><dt>Status</dt><dd>{FIGHTER_STATE_LABEL[state]}</dd></div>
            <div><dt>Kelas / grup</dt><dd>{f.group_name || "Gak dicatat"}</dd></div>
            <div><dt>Fighting style</dt><dd>{f.fighting_style || "Gak dicatat"}</dd></div>
          </dl>
        </div>
      </div>

      <dl className="dos-stats">
        <div><dt>Total fights</dt><dd>{pad2(stats.fights)}</dd></div>
        <div><dt>Wins</dt><dd>{pad2(stats.wins)}</dd></div>
        <div><dt>Losses</dt><dd>{pad2(stats.losses)}</dd></div>
        <div><dt>Win rate</dt><dd>{stats.winRate === null ? "–" : `${stats.winRate}%`}</dd></div>
      </dl>

      {next && (
        <section className="sheet-sec" aria-label="Fight berikutnya">
          <h3 className="sheet-sub">Fight berikutnya</h3>
          <button type="button" className="dos-next" onClick={() => ui.openMatch(next.id)}>
            <b>{matchCode(next.match_no)}</b>
            <span>
              {roundLabel(next.round, total, next.kind)}, lawan {nextFoe?.name ?? "yang belum ketahuan"}
            </span>
            <span className="dos-next-when">
              {statusOf(next) === "live" ? "Lagi jalan" : statusOf(next) === "postponed" ? "Ditunda" : "Belum mulai"}
            </span>
          </button>
        </section>
      )}

      <section className="sheet-sec" aria-label="Riwayat fight">
        <h3 className="sheet-sub">Riwayat fight</h3>
        {stats.records.length === 0 ? (
          <p className="sheet-note">Belum pernah turun ke ring. Catatan muncul begitu fight pertamanya selesai.</p>
        ) : (
          <ol className="dos-log">
            {stats.records.map((r) => {
              const mineIsA = r.a.id === f.id;
              const won = (r.winnerSide === 1) === mineIsA;
              const foe = mineIsA ? r.b : r.a;
              const clock = fmtClock(r.durationSec);
              return (
                <li key={r.key}>
                  <button type="button" className={"dos-rec " + (won ? "is-win" : "is-loss")} onClick={() => ui.openRecord(r)}>
                    <span className={"mark " + (won ? "mark-win" : "mark-loss")}>{won ? "Win" : "Loss"}</span>
                    <span className="dos-rec-main">
                      <b>lawan {foe.name}</b>
                      <span>
                        {matchCode(r.matchNo)}, {stageLabel(r.stage)}
                        {r.tournamentName ? `, ${r.tournamentName}` : ""}
                      </span>
                    </span>
                    <span className="dos-rec-how">
                      <b>{r.method ? METHOD_SHORT[r.method] : "–"}</b>
                      <span>{[clock, fmtDate(r.completedAt)].filter(Boolean).join(", ")}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </Modal>
  );
}
