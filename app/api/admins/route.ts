import {
  ApiError, adminClient, body, cleanUsername, derivedEmail, findByUsername, handle, json,
  listAccounts, requireSuperadmin, validatePassword, validateUsername,
} from "@/lib/server";

export const dynamic = "force-dynamic";

/** Superadmin: tambah akun admin. */
export function POST(req: Request) {
  return handle(async () => {
    const admin = adminClient();
    const me = await requireSuperadmin(req, admin);
    const b = await body<{ username?: string; password?: string }>(req);
    const username = cleanUsername(b.username);
    validateUsername(username);
    const password = validatePassword(b.password);
    if (findByUsername(await listAccounts(admin), username)) throw new ApiError(409, "Username itu udah dipakai.");

    const email = derivedEmail(me.email, username);
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw new ApiError(400, "Gagal bikin akun: " + (error?.message ?? ""));

    const ins = await admin.from("admin_accounts").insert({ user_id: data.user.id, username, email, role: "admin" });
    if (ins.error) {
      await admin.auth.admin.deleteUser(data.user.id);
      throw new ApiError(409, "Username itu udah dipakai.");
    }
    return json({ ok: true });
  });
}

/** Superadmin: ganti password akun mana pun (termasuk punya sendiri). */
export function PATCH(req: Request) {
  return handle(async () => {
    const admin = adminClient();
    await requireSuperadmin(req, admin);
    const b = await body<{ user_id?: string; password?: string }>(req);
    const password = validatePassword(b.password);
    const target = (await listAccounts(admin)).find((a) => a.user_id === b.user_id);
    if (!target) throw new ApiError(404, "Akun gak ketemu.");

    const { error } = await admin.auth.admin.updateUserById(target.user_id, { password });
    if (error) throw new ApiError(400, "Gagal ganti password: " + error.message);
    return json({ ok: true });
  });
}

/** Superadmin: hapus akun admin. Superadmin gak bisa dihapus. */
export function DELETE(req: Request) {
  return handle(async () => {
    const admin = adminClient();
    await requireSuperadmin(req, admin);
    const b = await body<{ user_id?: string }>(req);
    const target = (await listAccounts(admin)).find((a) => a.user_id === b.user_id);
    if (!target) throw new ApiError(404, "Akun gak ketemu.");
    if (target.role === "superadmin") throw new ApiError(400, "Akun superadmin gak bisa dihapus.");

    const { error } = await admin.auth.admin.deleteUser(target.user_id); // baris admin_accounts ikut kehapus
    if (error) throw new ApiError(400, "Gagal hapus akun: " + error.message);
    return json({ ok: true });
  });
}
