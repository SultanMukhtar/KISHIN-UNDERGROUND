import Mugshot from "@/components/ui/Mugshot";
import Stamp from "@/components/ui/Stamp";
import Barcode from "@/components/ui/Barcode";
import { fighterCode, pad2, tilt, times, tornClip } from "@/lib/codes";
import { multiplier, yen } from "@/lib/betting";
import type { Fighter, Match, Pool } from "@/lib/types";

type Props = { m: Match; f1?: Fighter; f2?: Fighter; pool?: Pool; round: string };

/** Poster fotokopian buat match yang lagi dipanggil ke ring. */
export default function FightPoster({ m, f1, f2, pool, round }: Props) {
  const done = !!m.winner_id;
  const side = (f?: Fighter) => (!done || !f ? "" : m.winner_id === f.id ? "is-win" : "is-lose");
  const winner = done ? (m.winner_id === f1?.id ? f1 : f2) : undefined;
  const p1 = pool?.pool1 ?? 0;
  const p2 = pool?.pool2 ?? 0;
  const hasBets = (pool?.bet_count ?? 0) > 0;
  const first = (f?: Fighter, fallback = "?") => (f?.name ?? fallback).split(/[\s_]+/)[0];
  // kata terpanjang dipakai buat ngecilin font, biar nama gak patah di tengah kata
  const longest = Math.max(4, ...[f1?.name, f2?.name].flatMap((n) => (n ?? "TBD").split(/[\s_]+/)).map((w) => w.length));
  // username Roblox kayak Takeshi_Ryuzaki boleh patah di garis bawah, bukan di tengah kata
  const breakable = (n?: string) => (n ? n.replace(/_/g, "_\u200b") : "TBD");

  return (
    <article
      className={`poster ${done ? "is-done" : "is-live"}`}
      style={{ "--tilt": `${tilt(m.id, 1.1)}deg`, clipPath: tornClip("poster" + m.id, { top: true, bottom: true }, 8) } as React.CSSProperties}
    >
      <span className="tape tape-a" aria-hidden="true" />
      <span className="tape tape-b" aria-hidden="true" />

      <header className="poster-head">
        <span className="poster-no">Fight {pad2(m.match_no)}</span>
        <span className="poster-round">{round}</span>
      </header>

      <div className="poster-photos" aria-hidden="true">
        {[f1, f2].map((f, i) => (
          <figure key={i} className={`pp pp-${i ? "b" : "a"} ${side(f)}`}>
            <Mugshot name={f?.name} url={f?.photo_url} size="xl" surface="print" />
            {done && f && m.winner_id === f.id && <Stamp tone="seal" tilt={7} className="pp-seal">勝</Stamp>}
            {done && f && m.winner_id !== f.id && <span className="pp-cross" />}
          </figure>
        ))}
        <span className="poster-vs">VS</span>
      </div>

      <h3 className="poster-names" style={{ "--len": longest } as React.CSSProperties}>
        <span className={`pn pn-a ${side(f1)}`}>{breakable(f1?.name)}</span>
        <span className="sr-only"> lawan </span>
        <span className={`pn pn-b ${side(f2)}`}>{breakable(f2?.name)}</span>
      </h3>
      <p className="poster-codes" aria-hidden="true">
        <span>{fighterCode(f1?.id)}</span>
        <span>{fighterCode(f2?.id)}</span>
      </p>

      <footer className="poster-foot">
        {hasBets ? (
          <dl className="poster-pool">
            <div><dt>Pool</dt><dd>{yen(p1 + p2)}</dd></div>
            <div><dt>{first(f1, "Kiri")} menang</dt><dd>{times(multiplier(p1, p2, m.house_cut))}</dd></div>
            <div><dt>{first(f2, "Kanan")} menang</dt><dd>{times(multiplier(p2, p1, m.house_cut))}</dd></div>
          </dl>
        ) : (
          <p className="poster-nobet">Taruhan dibuka di lokasi. Cari Finance Betting.</p>
        )}
        <Barcode value={m.id} className="poster-bar" />
      </footer>

      {done ? (
        <Stamp tone="red" tilt={-9} slam className="poster-stamp" key="ko">
          <b>KO</b>
          <span>{first(winner)} menang</span>
        </Stamp>
      ) : (
        <Stamp tone="red" tilt={6} className="poster-stamp is-live" key="live">
          <b>Live</b>
          <span>lagi di ring</span>
        </Stamp>
      )}
    </article>
  );
}
