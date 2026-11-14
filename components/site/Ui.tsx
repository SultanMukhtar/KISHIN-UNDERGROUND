"use client";
import { createContext, useContext } from "react";
import type { FightRecord } from "@/lib/fight";

/** Aksi yang bisa dipanggil dari mana aja di halaman penonton (buka dossier, detail fight, meja taruhan). */
export type Ui = {
  /** layar pembuka udah selesai → animasi masuk boleh jalan */
  booted: boolean;
  openFighter: (fighterId: string) => void;
  openMatch: (matchId: string) => void;
  openRecord: (record: FightRecord) => void;
  openBet: (matchId: string) => void;
};

const noop = () => {};
const Ctx = createContext<Ui>({ booted: true, openFighter: noop, openMatch: noop, openRecord: noop, openBet: noop });

export const UiProvider = Ctx.Provider;
export const useUi = () => useContext(Ctx);
export const useBooted = () => useContext(Ctx).booted;
