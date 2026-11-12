import { sb } from "./supabase";

/** Panggil route /api/* dari browser. Otomatis bawa token sesi kalau lagi login. */
export async function api<T = { ok: true }>(path: string, method: string, data?: unknown): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const { data: s } = await sb().auth.getSession();
  if (s.session) headers.Authorization = `Bearer ${s.session.access_token}`;
  const res = await fetch(path, { method, headers, body: data === undefined ? undefined : JSON.stringify(data), cache: "no-store" });
  let out: unknown = null;
  try { out = await res.json(); } catch {}
  if (!res.ok) throw new Error((out as { error?: string } | null)?.error || `Gagal (${res.status})`);
  return out as T;
}
