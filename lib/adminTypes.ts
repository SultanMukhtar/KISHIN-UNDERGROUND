import type { ConfirmFn } from "@/components/admin/ConfirmDialog";
import type { AdminLoad } from "./data";

export type Me = { user_id: string; username: string; role: "admin" | "superadmin" };
/** Semua data panel panitia. `schemaReady: false` = supabase/schema.sql versi terbaru belum di-Run. */
export type AdminData = Omit<AdminLoad, "error" | "warning">;

export type TabKey = "fighters" | "bracket" | "betting" | "archive" | "tournament" | "sponsors" | "settings" | "accounts";

/** "Niat" yang dibawa waktu pindah tab dari tempat lain, misal dari daftar "Perlu diurus". */
export type Intent = {
  /** buka / sorot fight ini */
  matchId?: string;
  /** saringan daftar, misal "unpaid" */
  filter?: string;
  /** tampilan khusus di tab tujuan, misal "payouts" */
  view?: string;
};

export type TabProps = {
  me: Me;
  data: AdminData;
  reload: () => Promise<void>;
  /** pesan singkat di pojok bawah layar. err = true → tetap ada sampai ditutup */
  notify: (msg: string, err?: boolean) => void;
  /** dialog konfirmasi bergaya panel (pengganti window.confirm). true = lanjut */
  confirm: ConfirmFn;
  /** pindah tab, boleh sambil bawa niat */
  go: (tab: TabKey, intent?: Intent) => void;
  /** niat yang lagi dikirim ke tab ini (nonce berubah tiap kali dikirim), atau null */
  intent: (Intent & { nonce: number }) | null;
  /** tab ini yang lagi tampil? Tab lain tetap hidup di belakang supaya isian gak hilang waktu pindah tab. */
  active: boolean;
};
