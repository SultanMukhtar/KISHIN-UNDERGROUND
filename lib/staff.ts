"use client";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { sb } from "./supabase";
import type { Me } from "./adminTypes";
import type { Bet } from "./types";

/**
 * Panitia yang lagi login di browser ini (null = penonton biasa).
 * Dipakai halaman penonton buat nampilin form catat taruhan cuma ke panitia.
 * Keamanannya tetap di database (RLS): penonton yang ngakalin tampilan tetap gak bisa nulis.
 */
export function useStaff(): Me | null {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    let alive = true;
    const check = async (session: Session | null) => {
      if (!session) {
        if (alive) setMe(null);
        return;
      }
      const { data } = await sb().from("admin_accounts").select("user_id,username,role").eq("user_id", session.user.id).maybeSingle();
      if (alive) setMe((data as Me | null) ?? null);
    };
    let unsub = () => {};
    try {
      sb().auth.getSession().then(({ data }) => check(data.session));
      // jangan panggil query Supabase langsung di dalam callback auth (bisa saling nunggu) → tunda sebentar
      const { data } = sb().auth.onAuthStateChange((_event, s) => { setTimeout(() => check(s), 0); });
      unsub = () => data.subscription.unsubscribe();
    } catch {}
    return () => {
      alive = false;
      unsub();
    };
  }, []);
  return me;
}

export type NewBet = Pick<Bet, "id" | "match_id" | "bettor_name" | "bettor_account" | "fighter_id" | "amount">;

/**
 * Catat satu taruhan. `id` dibuat di browser SEBELUM dikirim:
 * kalau tombolnya kepencet dua kali atau koneksi putus lalu dikirim ulang, database nolak id yang sama,
 * jadi taruhannya gak pernah kecatat dobel.
 */
export async function placeBet(bet: NewBet): Promise<{ duplicate: boolean }> {
  const { error } = await sb().from("bets").insert(bet);
  if (!error) return { duplicate: false };
  if (error.code === "23505") return { duplicate: true }; // id ini udah masuk
  if (error.code === "42501" || /row-level security/i.test(error.message)) {
    throw new Error("Sesi panitia habis atau akun ini gak punya izin. Login ulang di panel panitia.");
  }
  throw new Error(error.message);
}
