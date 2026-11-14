import { BETTING_LABEL, STATUS_LABEL, type BettingState } from "@/lib/fight";
import type { MatchStatus } from "@/lib/types";

/** Label status fight. LIVE satu-satunya yang punya titik merah berkedip. */
export function StatusChip({ status, className = "" }: { status: MatchStatus; className?: string }) {
  return (
    <span className={`chip chip-${status} ${className}`}>
      {status === "live" && <span className="live-dot" aria-hidden="true" />}
      {STATUS_LABEL[status]}
    </span>
  );
}

export function BetChip({ state, className = "" }: { state: BettingState; className?: string }) {
  return <span className={`chip chip-bet-${state} ${className}`}>{BETTING_LABEL[state]}</span>;
}
