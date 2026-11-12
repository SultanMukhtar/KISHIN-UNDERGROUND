import type { Bet, Fighter, Match, Settings } from "./types";

export type Me = { user_id: string; username: string; role: "admin" | "superadmin" };
export type AdminData = { settings: Settings | null; fighters: Fighter[]; matches: Match[]; bets: Bet[] };
export type TabProps = { me: Me; data: AdminData; reload: () => Promise<void>; notify: (msg: string, err?: boolean) => void };
