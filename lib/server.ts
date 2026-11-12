// HANYA dipakai di app/api/* (server). Jangan di-import dari komponen "use client".
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export type Role = "admin" | "superadmin";
export type Account = { user_id: string; username: string; email: string; role: Role; created_at: string };

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function env() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon) throw new ApiError(500, "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY belum diisi.");
  if (!secret) throw new ApiError(500, "SUPABASE_SECRET_KEY belum diisi di file .env / Environment Variables Vercel.");
  if (!secret.startsWith("sb_secret_") && !secret.startsWith("eyJ")) {
    throw new ApiError(500, "SUPABASE_SECRET_KEY harus berisi secret key (sb_secret_...), bukan publishable key.");
  }
  return { url, anon, secret };
}

const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

/** Client dengan secret key: bisa bikin/hapus user Auth dan nembus RLS. */
export function adminClient(): SupabaseClient {
  const { url, secret } = env();
  return createClient(url, secret, opts);
}

/** Client biasa (publishable key) buat login atas nama user. */
export function anonClient(): SupabaseClient {
  const { url, anon } = env();
  return createClient(url, anon, opts);
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function handle(fn: () => Promise<Response>): Promise<Response> {
  return fn().catch((e: unknown) => {
    if (e instanceof ApiError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: "Terjadi kesalahan di server." }, 500);
  });
}

export async function body<T>(req: Request): Promise<T> {
  try { return (await req.json()) as T; } catch { throw new ApiError(400, "Data yang dikirim gak valid."); }
}

/** Rapikan username: hapus spasi di ujung & spasi dobel. */
export function cleanUsername(raw: unknown): string {
  return String(raw ?? "").trim().replace(/\s+/g, " ");
}

export function validateUsername(u: string) {
  if (!/^[A-Za-z0-9 ._-]{3,30}$/.test(u)) {
    throw new ApiError(400, "Username 3–30 karakter, cuma boleh huruf, angka, spasi, titik, minus, garis bawah.");
  }
}

export function validatePassword(p: unknown): string {
  const s = String(p ?? "");
  if (s.length < 6) throw new ApiError(400, "Password minimal 6 karakter.");
  if (s.length > 72) throw new ApiError(400, "Password maksimal 72 karakter.");
  return s;
}

export function validateEmail(e: unknown): string {
  const s = String(e ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) throw new ApiError(400, "Format email gak valid.");
  return s;
}

export async function listAccounts(admin: SupabaseClient): Promise<Account[]> {
  const { data, error } = await admin.from("admin_accounts").select("*").order("created_at");
  if (error) {
    if (error.code === "42P01" || /admin_accounts/.test(error.message)) {
      throw new ApiError(500, "Tabel akun belum ada. Run ulang supabase/schema.sql di SQL Editor.");
    }
    throw new ApiError(500, error.message);
  }
  return (data ?? []) as Account[];
}

export function findByUsername(accounts: Account[], username: string) {
  const key = cleanUsername(username).toLowerCase();
  return accounts.find((a) => a.username.toLowerCase() === key);
}

/** Pastikan request datang dari superadmin yang lagi login (pakai token sesi dari browser). */
export async function requireSuperadmin(req: Request, admin: SupabaseClient): Promise<Account> {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) throw new ApiError(401, "Sesi habis, login ulang.");
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new ApiError(401, "Sesi habis, login ulang.");
  const { data: acc } = await admin.from("admin_accounts").select("*").eq("user_id", data.user.id).maybeSingle();
  if (!acc || acc.role !== "superadmin") throw new ApiError(403, "Cuma superadmin yang boleh.");
  return acc as Account;
}

/**
 * Email internal buat akun admin baru, diturunkan dari email superadmin pakai "+":
 * hito@gmail.com → hito+adm-finance1-x7k2@gmail.com. Gak ada email yang dikirim.
 */
export function derivedEmail(baseEmail: string, username: string): string {
  const [localRaw, domain] = baseEmail.split("@");
  const local = localRaw.split("+")[0];
  const slug = username.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 20) || "admin";
  const rand = Math.random().toString(36).slice(2, 6);
  return `${local}+adm-${slug}-${rand}@${domain}`;
}
