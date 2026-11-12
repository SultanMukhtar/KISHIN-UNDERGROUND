import { multiplier, yen } from "@/lib/betting";
import { pad2, times } from "@/lib/codes";
import type { Fighter, Match, Pool } from "@/lib/types";

type Props = { matches: Match[]; byId: Map<string, Fighter>; poolOf: Map<string, Pool> };

/** Papan taruhan: total uang per sisi + kelipatan kalau menang. Nama bettor gak pernah tampil. */
export default function BettingBoard({ matches, byId, poolOf }: Props) {
  const withBets = matches.filter((m) => m.fighter1_id && m.fighter2_id && (poolOf.get(m.id)?.bet_count ?? 0) > 0);
  const open = withBets.filter((m) => !m.winner_id);
  const closed = withBets.filter((m) => m.winner_id).sort((a, b) => b.match_no - a.match_no);

  if (!withBets.length) {
    return <p className="empty-note">Meja taruhan belum buka. Begitu ada yang pasang, angkanya muncul di sini.</p>;
  }

  const slip = (m: Match) => {
    const p = poolOf.get(m.id)!;
    const sum = p.pool1 + p.pool2;
    const pctA = sum ? Math.round((p.pool1 / sum) * 100) : 50;
    const f1 = byId.get(m.fighter1_id!);
    const f2 = byId.get(m.fighter2_id!);
    const done = !!m.winner_id;
    const cls = (id: string | null) => (done ? (m.winner_id === id ? " is-win" : " is-lose") : "");
    const money = (n: number) => (n ? yen(n) : "Belum ada");
    return (
      <li key={m.id} className={"slip" + (done ? " is-closed" : "")}>
        <span className="slip-no">{pad2(m.match_no)}</span>
        <div className={"slip-side slip-a" + cls(m.fighter1_id)}>
          <span className="slip-name">{f1?.name}</span>
          <span className="slip-money">{money(p.pool1)}</span>
          <span className="slip-x">{times(multiplier(p.pool1, p.pool2, m.house_cut))}</span>
        </div>
        <div className="slip-bar" aria-hidden="true"><i style={{ width: `${pctA}%` }} /></div>
        <div className={"slip-side slip-b" + cls(m.fighter2_id)}>
          <span className="slip-name">{f2?.name}</span>
          <span className="slip-money">{money(p.pool2)}</span>
          <span className="slip-x">{times(multiplier(p.pool2, p.pool1, m.house_cut))}</span>
        </div>
        <span className="slip-state">
          {done ? `Ditutup, ${byId.get(m.winner_id!)?.name ?? "?"} menang` : `${p.bet_count} taruhan masuk`}
        </span>
      </li>
    );
  };

  return (
    <>
      {open.length > 0 ? (
        <ul className="ledger">{open.map(slip)}</ul>
      ) : (
        <p className="empty-note">Belum ada fight yang lagi buka taruhan.</p>
      )}
      {closed.length > 0 && (
        <details className="ledger-closed">
          <summary>Taruhan yang udah ditutup ({closed.length})</summary>
          <ul className="ledger">{closed.map(slip)}</ul>
        </details>
      )}
    </>
  );
}
