"use client";
import Reveal from "@/components/ui/Reveal";
import FightPoster from "@/components/site/FightPoster";
import FightCard from "@/components/site/FightCard";
import { SectionTitle } from "@/components/site/SiteChrome";
import { roundLabel } from "@/lib/bracket";
import { isReady, statusOf } from "@/lib/fight";
import type { Fighter, Match, Pool } from "@/lib/types";

type Props = { matches: Match[]; byId: Map<string, Fighter>; poolOf: Map<string, Pool>; total: number; loading: boolean };

const NEXT_LIMIT = 6;

/**
 * LAGI DI RING: fight yang lagi jalan / dipanggil tampil sebagai poster,
 * fight berikutnya (dua fighter-nya udah ketahuan) tampil sebagai kartu ringkas.
 */
export default function RingSection({ matches, byId, poolOf, total, loading }: Props) {
  const ready = matches.filter(isReady);
  const live = ready.filter((m) => statusOf(m) === "live");
  const called = ready.filter((m) => m.featured && statusOf(m) !== "live");
  const posters = [...live, ...called.filter((m) => !m.winner_id), ...called.filter((m) => m.winner_id)];
  const shown = new Set(posters.map((m) => m.id));
  const time = (m: Match) => (m.scheduled_at ? Date.parse(m.scheduled_at) : Infinity);
  const next = ready
    .filter((m) => !shown.has(m.id) && !m.winner_id)
    .sort((a, b) => time(a) - time(b) || a.match_no - b.match_no);
  const nextShown = next.slice(0, NEXT_LIMIT);

  const aside = live.length
    ? `${live.length} fight lagi jalan`
    : posters.length
      ? "Dipanggil panitia"
      : next.length
        ? "Belum ada yang dipanggil"
        : undefined;
  const f = (id: string | null) => (id ? byId.get(id) : undefined);

  return (
    <section className="block block-ring" data-spy="ring" aria-labelledby="ring">
      <div className="wrap">
        <SectionTitle id="ring" aside={aside}>Lagi di ring</SectionTitle>

        {loading ? (
          <p className="empty-note is-loading" role="status">Ngambil data fight…</p>
        ) : !posters.length && !next.length ? (
          <p className="empty-note">
            {matches.length
              ? "Ring lagi kosong. Fight berikutnya muncul di sini begitu dua fighter-nya ketahuan."
              : "Ring masih kosong. Bracket belum dibuat, panitia masih ngumpulin fighter."}
          </p>
        ) : (
          <>
            {posters.length > 0 && (
              <div className={`posters${posters.length === 1 ? " is-single" : ""}`}>
                {posters.map((m, i) => (
                  <Reveal key={m.id} kind={i % 2 ? "right" : "left"} delay={Math.min(i, 3) * 90}>
                    <FightPoster m={m} f1={f(m.fighter1_id)} f2={f(m.fighter2_id)} pool={poolOf.get(m.id)} round={roundLabel(m.round, total, m.kind)} />
                  </Reveal>
                ))}
              </div>
            )}

            {nextShown.length > 0 && (
              <div className="ring-next">
                <h3 className="sub-title">Fight berikutnya</h3>
                <div className="fcs">
                  {nextShown.map((m, i) => (
                    <Reveal key={m.id} kind={i % 2 ? "right" : "left"} delay={Math.min(i, 5) * 70}>
                      <FightCard m={m} f1={f(m.fighter1_id)} f2={f(m.fighter2_id)} round={roundLabel(m.round, total, m.kind)} />
                    </Reveal>
                  ))}
                </div>
                {next.length > nextShown.length && (
                  <p className="ring-more">
                    Masih ada {next.length - nextShown.length} fight lagi. <a href="#bracket">Lihat semuanya di bracket</a>
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
