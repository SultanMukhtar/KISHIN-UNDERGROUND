/**
 * Banyak yang salah paste link dashboard (https://supabase.com/dashboard/project/<ref>)
 * ke NEXT_PUBLIC_SUPABASE_URL. Itu bukan Project URL, tapi ref-nya bisa dipakai:
 * diubah jadi https://<ref>.supabase.co biar website tetap nyambung.
 */
export function projectUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  const url = raw.trim().replace(/\/+$/, "");
  const m = url.match(/^https?:\/\/(?:app\.)?supabase\.com\/dashboard\/project\/([a-z0-9]{15,})/i);
  return m ? `https://${m[1].toLowerCase()}.supabase.co` : url;
}
