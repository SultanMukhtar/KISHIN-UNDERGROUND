import {
  ApiError, adminClient, body, cleanUsername, handle, json, listAccounts,
  validateEmail, validatePassword, validateUsername,
} from "@/lib/server";

export const dynamic = "force-dynamic";

/** Sudah ada superadmin belum? Dipakai halaman /admin buat nentuin tampil form setup atau login. */
export function GET() {
  return handle(async () => {
    const accounts = await listAccounts(adminClient());
    return json({ needsSetup: !accounts.some((a) => a.role === "superadmin") });
  });
}

/** Bikin akun superadmin pertama. Cuma bisa sekali — setelah ada superadmin, endpoint ini nolak. */
export function POST(req: Request) {
  return handle(async () => {
    const admin = adminClient();
    if ((await listAccounts(admin)).some((a) => a.role === "superadmin")) {
      throw new ApiError(403, "Superadmin udah ada. Login aja.");
    }
    const b = await body<{ username?: string; password?: string; email?: string }>(req);
    const username = cleanUsername(b.username);
    validateUsername(username);
    const password = validatePassword(b.password);
    const email = validateEmail(b.email);

    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) {
      const msg = error?.message ?? "";
      if (/already|registered|exists/i.test(msg)) {
        throw new ApiError(409, "Email itu udah kepakai akun lain di Supabase. Hapus dulu di Authentication → Users, atau pakai email lain.");
      }
      throw new ApiError(400, "Gagal bikin akun: " + msg);
    }
    const ins = await admin.from("admin_accounts").insert({ user_id: data.user.id, username, email, role: "superadmin" });
    if (ins.error) {
      await admin.auth.admin.deleteUser(data.user.id);
      throw new ApiError(409, "Superadmin udah ada atau username bentrok. Refresh halaman.");
    }
    return json({ ok: true });
  });
}
