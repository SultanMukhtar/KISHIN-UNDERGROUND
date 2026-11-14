import type { AdminLoad } from "./data";

export type Me = { user_id: string; username: string; role: "admin" | "superadmin" };
/** Semua data panel panitia. `schemaReady: false` = supabase/schema.sql versi terbaru belum di-Run. */
export type AdminData = Omit<AdminLoad, "error">;
export type TabProps = { me: Me; data: AdminData; reload: () => Promise<void>; notify: (msg: string, err?: boolean) => void };
