"use client";
import Mugshot from "@/components/ui/Mugshot";
import Reveal from "@/components/ui/Reveal";
import { yen } from "@/lib/betting";
import { tilt, tornClip } from "@/lib/codes";
import type { Sponsor } from "@/lib/types";

/** Sponsor turnamen: flyer kecil ditempel di tembok. Foto/logo dicetak gaya fotokopi, nama, dan jumlah sponsornya. */
export default function Sponsors({ sponsors }: { sponsors: Sponsor[] }) {
  return (
    <ul className="spons">
      {sponsors.map((s, i) => (
        <Reveal as="li" key={s.id} kind="up" delay={Math.min(i, 5) * 70}>
          <article
            className="spon"
            style={{ "--tilt": `${tilt("spon" + s.id, 1.6)}deg`, clipPath: tornClip("spon" + s.id, { top: true, bottom: true }, 5, 16) } as React.CSSProperties}
          >
            <span className="tape spon-tape" aria-hidden="true" />
            <span className="spon-photo">
              <Mugshot name={s.name} url={s.photo_url} size="xl" surface="print" empty="initial" />
            </span>
            <h3 className="spon-name">{s.name}</h3>
            {s.amount > 0 && (
              <p className="spon-amount">
                <span>Sponsor</span>
                <b>{yen(s.amount)}</b>
              </p>
            )}
          </article>
        </Reveal>
      ))}
    </ul>
  );
}
