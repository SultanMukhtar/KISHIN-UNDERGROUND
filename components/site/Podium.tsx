"use client";
import Mugshot from "@/components/ui/Mugshot";
import Stamp from "@/components/ui/Stamp";
import Reveal from "@/components/ui/Reveal";
import { useUi } from "@/components/site/Ui";
import { fighterCode } from "@/lib/codes";
import type { Fighter, Tournament } from "@/lib/types";

type Props = {
  first?: Fighter;
  second?: Fighter;
  third?: Fighter;
  /** jumlah menang tiap fighter di turnamen ini */
  winsOf: (fighterId: string) => number;
  tournamentName: string | null;
  /** ada perebutan juara 3 di bracket ini? */
  hasThird: boolean;
  /** turnamen sebelumnya yang udah punya juara */
  past: Tournament[];
};

/** Tiga juara, ditampilin kayak foto tahanan + papan nama. Keisi sendiri dari hasil resmi final. */
export default function Podium({ first, second, third, winsOf, tournamentName, hasThird, past }: Props) {
  const ui = useUi();
  const slots: { rank: 1 | 2 | 3; f?: Fighter; title: string; wait: string }[] = [
    { rank: 1, f: first, title: "First place", wait: "Menunggu final" },
    { rank: 2, f: second, title: "Second place", wait: "Menunggu final" },
    { rank: 3, f: third, title: "Third place", wait: hasThird ? "Menunggu perebutan juara 3" : "Menunggu final" },
  ];
  const decided = !!first;

  return (
    <>
      <ol className={"podium" + (first || second || third ? "" : " is-pending")}>
        {slots.map(({ rank, f, title, wait }, i) => (
          <Reveal as="li" key={rank} kind="scale" delay={rank === 1 ? 0 : 120 + i * 60} className={`pod pod-${rank}${f ? "" : " is-empty"}`}>
            <div className="pod-frame">
              <span className="pod-chart" aria-hidden="true" />
              {f ? (
                <button type="button" className="pod-open" onClick={() => ui.openFighter(f.id)} aria-label={`Buka dossier ${f.name}`}>
                  <Mugshot name={f.name} url={f.photo_url} size="xl" />
                </button>
              ) : (
                <span className="pod-unknown" aria-hidden="true">?</span>
              )}
              {rank === 1 && f && (
                <Stamp tone="red" tilt={-8} slam className="pod-winner" key={f.id}>
                  <span className="jp">王者</span>
                  <span className="stamp-sub">Winner</span>
                </Stamp>
              )}
            </div>
            <div className="placard">
              <span className="placard-rank">{title}</span>
              <span className="placard-name">{f?.name ?? "Belum ada"}</span>
              <span className="placard-code">
                {f ? `${fighterCode(f.id)} / ${winsOf(f.id)} menang` : wait}
              </span>
            </div>
          </Reveal>
        ))}
      </ol>
      {tournamentName && (
        <p className="pod-title">
          {decided ? "Juara" : "Turnamen yang lagi jalan"}: <b>{tournamentName}</b>
        </p>
      )}

      {past.length > 0 && (
        <Reveal className="pasts" kind="up">
          <h3 className="sub-title">Juara turnamen sebelumnya</h3>
          <ul>
            {past.map((t) => (
              <li key={t.id}>
                <span className="past-name">{t.name}</span>
                <span className="past-champ">
                  {t.champion_id ? (
                    <button type="button" className="link-btn" onClick={() => ui.openFighter(t.champion_id!)}>{t.champion_name}</button>
                  ) : (
                    t.champion_name
                  )}
                </span>
                <span className="past-rest">
                  {[t.runner_up_name && `2. ${t.runner_up_name}`, t.third_name && `3. ${t.third_name}`].filter(Boolean).join("  ")}
                </span>
              </li>
            ))}
          </ul>
        </Reveal>
      )}
    </>
  );
}
