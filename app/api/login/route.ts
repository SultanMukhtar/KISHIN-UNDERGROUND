import { ApiError, adminClient, anonClient, body, cleanUsername, findByUsername, handle, json, listAccounts } from "@/lib/server";

export const dynamic = "force-dynamic";

/**
 * Login pakai username + password. Email akun dicari di server, jadi gak pernah kelihatan di browser.
 * Balikin token sesi Supabase; browser nyimpen pakai supabase.auth.setSession().
 */
export function POST(req: Request) {
  return handle(async () => {
    const b = await body<{ username?: string; password?: string }>(req);
    const username = cleanUsername(b.username);
    const password = String(b.password ?? "");
    if (!username || !password) throw new ApiError(400, "Isi username dan password.");

    const admin = adminClient();
    const acc = findByUsername(await listAccounts(admin), username);
    const fail = async () => {
      await new Promise((r) => setTimeout(r, 600)); // memperlambat tebak-tebakan password
      return new ApiError(401, "Username atau password salah.");
    };
    if (!acc) throw await fail();

    const { data, error } = await anonClient().auth.signInWithPassword({ email: acc.email, password });
    if (error || !data.session) throw await fail();
    return json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
  });
}
