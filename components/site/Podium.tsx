import Mugshot from "@/components/ui/Mugshot";
import Stamp from "@/components/ui/Stamp";
import { fighterCode } from "@/lib/codes";
import type { Fighter } from "@/lib/types";

type Props = { first?: Fighter; second?: Fighter; third?: Fighter };

/** Tiga juara, ditampilin kayak foto tahanan + papan nama. */
export default function Podium({ first, second, third }: Props) {
  const slots: { rank: number; f?: Fighter; title: string }[] = [
    { rank: 1, f: first, title: "Juara 1" },
    { rank: 2, f: second, title: "Juara 2" },
    { rank: 3, f: third, title: "Juara 3" },
  ];
  return (
    <ol className={"podium" + (first || second || third ? "" : " is-pending")}>
      {slots.map(({ rank, f, title }) => (
        <li key={rank} className={`pod pod-${rank}${f ? "" : " is-empty"}`}>
          <div className="pod-frame">
            <span className="pod-chart" aria-hidden="true" />
            {f ? <Mugshot name={f.name} url={f.photo_url} size="xl" /> : <span className="pod-unknown" aria-hidden="true">?</span>}
            {rank === 1 && f && <Stamp tone="seal" tilt={-6} className="pod-seal">王者</Stamp>}
          </div>
          <div className="placard">
            <span className="placard-rank">{title}</span>
            <span className="placard-name">{f?.name ?? "Belum ada"}</span>
            <span className="placard-code">{f ? fighterCode(f.id) : rank === 3 ? "Nunggu perebutan juara 3" : "Nunggu final"}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
