import type { Bet, Fighter, Match, Settings } from "./types";

export type AdminData = { settings: Settings | null; fighters: Fighter[]; matches: Match[]; bets: Bet[] };
export type TabProps = { data: AdminData; reload: () => Promise<void>; notify: (msg: string, err?: boolean) => void };
