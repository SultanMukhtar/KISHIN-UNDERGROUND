import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/** Dibuat saat pertama dipakai (di browser), supaya build di Vercel gak error kalau env belum ada. */
export function sb(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY belum diisi di file .env / Environment Variables.");
    }
    if (!/^https?:\/\//.test(url)) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL harus berupa Project URL (https://xxxx.supabase.co), bukan key.");
    }
    if (key.startsWith("sb_secret_")) {
      throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY berisi SECRET key. Ganti pakai publishable key (sb_publishable_...) — secret key gak boleh ditaruh di website.");
    }
    client = createClient(url, key);
  }
  return client;
}

const BUCKET_MARKER = "/storage/v1/object/public/photos/";

/** Ambil path file di bucket "photos" dari URL publiknya. Link luar (bukan dari Supabase) → null. */
export function photoPath(url: string | null | undefined): string | null {
  if (!url) return null;
  const i = url.indexOf(BUCKET_MARKER);
  if (i === -1) return null;
  return decodeURIComponent(url.slice(i + BUCKET_MARKER.length).split("?")[0]);
}

/** Hapus file foto dari Supabase Storage. Gagal hapus gak bikin proses lain berhenti. */
export async function deletePhoto(url: string | null | undefined): Promise<void> {
  const path = photoPath(url);
  if (!path) return;
  const { error } = await sb().storage.from("photos").remove([path]);
  if (error) console.warn("Gagal hapus foto lama:", error.message);
}

export async function uploadPhoto(file: File, folder: "fighters" | "hero"): Promise<string> {
  if (file.size > 5 * 1024 * 1024) throw new Error("Ukuran foto maksimal 5 MB.");
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb().storage.from("photos").upload(path, file, { contentType: file.type });
  if (error) throw error;
  return sb().storage.from("photos").getPublicUrl(path).data.publicUrl;
}
