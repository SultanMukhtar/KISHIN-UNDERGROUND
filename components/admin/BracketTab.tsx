"use client";
import { useMemo, useState } from "react";
import Avatar from "@/components/Avatar";
import { sb } from "@/lib/supabase";
import { generateBracket, roundLabel, totalRounds, winnerPatches } from "@/lib/bracket";
import type { TabProps } from "@/lib/adminTypes";
import type { Match } from "@/lib/types";

export default function BracketTab({ me, data, reload, notify }: TabProps) {
  const { matches, fighters, bets, settings } = data;
  const isSuper = me.role === "superadmin";
  const [busy, setBusy] = useState(false);
  const byId = useMemo(() => new Map(fighters.map((f) => [f.id, f])), [fighters]);
  const total = totalRounds(matches);
  const paid = fighters.filter((f) => f.paid);

  async function generate() {
    if (!isSuper) return notify("Cuma superadmin yang boleh generate bracket.", true);
    const warn = matches.length
      ? `Bracket lama (${matches.length} match) dan SEMUA taruhan (${bets.length}) akan dihapus dan dibuat ulang. Lanjut?`
      : `Buat bracket dari ${paid.length} fighter yang sudah bayar? Urutan diacak.`;
    if (!confirm(warn)) return;
    setBusy(true);
    try {
      const rows = generateBracket(paid.map((f) => f.id), settings?.default_house_cut ?? 0.2);
      const c = sb();
      if (matches.length) {
        const del = await c.from("matches").delete().not("id", "is", null);
        if (del.error) throw del.error;
      }
      const ins = await c.from("matches").insert(rows);
      if (ins.error) throw ins.error;
      notify(`Bracket dibuat: ${rows.length} match.`);
      await reload();
    } catch (err) {
      notify((err as Error).message, true);
    }
    setBusy(false);
  }

  async function setWinner(m: Match, winnerId: string | null) {
    if (winnerId === m.winner_id) winnerId = null; // klik lagi = batal
    setBusy(true);
    const patches = winnerPatches(matches, m, winnerId);
    for (const p of patches) {
      const { error } = await sb().from("matches").update(p.changes).eq("id", p.id);
      if (error) { notify(error.message, true); break; }
    }
    await reload();
    setBusy(false);
  }

  async function toggleFeatured(m: Match) {
    const { error } = await sb().from("matches").update({ featured: !m.featured }).eq("id", m.id);
    if (error) return notify(error.message, true);
    await reload();
  }

  async function clearFeatured() {
    const { error } = await sb().from("matches").update({ featured: false }).eq("featured", true);
    if (error) return notify(error.message, true);
    await reload();
  }

  const groups: { key: string; label: string; items: Match[] }[] = [];
  for (const m of matches) {
    const key = `${m.kind}-${m.round}`;
    let g = groups.find((x) => x.key === key);
    if (!g) groups.push((g = { key, label: roundLabel(m.round, total, m.kind), items: [] }));
    g.items.push(m);
  }
  const featuredCount = matches.filter((m) => m.featured).length;

  return (
    <>
      {isSuper && (
        <div className="card">
          <h3>Generate bracket otomatis</h3>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0 }}>
            Pakai {paid.length} fighter yang statusnya <strong>Sudah bayar</strong>. Diacak, sisa slot jadi BYE (lolos otomatis), pemenang otomatis maju ke ronde berikutnya, yang kalah di semifinal otomatis masuk Perebutan Juara 3.
          </p>
          <div className="row-actions">
            <button className="btn" onClick={generate} disabled={busy || paid.length < 2}>{matches.length ? "Buat ulang bracket" : "Generate bracket"}</button>
          </div>
        </div>
      )}

      {featuredCount > 0 && (
        <div className="row-actions" style={{ marginTop: 12 }}>
          <button className="btn ghost" onClick={clearFeatured} disabled={busy}>Lepas semua &quot;Tampil Hari Ini&quot; ({featuredCount})</button>
        </div>
      )}

      {groups.length === 0 && (
        <div className="empty-state">{isSuper ? "Belum ada bracket." : "Belum ada bracket. Tunggu superadmin generate bracket."}</div>
      )}
      {groups.map((g) => (
        <section key={g.key} style={{ marginTop: 22 }}>
          <div className="sec-head"><h2>{g.label}</h2><span className="sub">{g.items.filter((m) => m.winner_id).length}/{g.items.length} selesai</span></div>
          <div className="match-grid">
            {g.items.map((m) => {
              const isBye = m.kind === "main" && m.round === 1 && !m.fighter2_id;
              const ready = m.fighter1_id && m.fighter2_id;
              return (
                <div className="match-card admin-match" key={m.id} style={m.featured ? { borderColor: "var(--red)", borderWidth: 2 } : undefined}>
                  <div className="mno">MATCH {m.match_no}{isBye ? " · BYE" : ""}</div>
                  {[m.fighter1_id, m.fighter2_id].map((fid, i) => {
                    const f = fid ? byId.get(fid) : undefined;
                    return (
                      <div className="pick-row" key={i}>
                        <span className="fighter-id" style={{ flex: 1 }}>
                          {f && <Avatar name={f.name} url={f.photo_url} />}
                          <span className="nm" style={{ fontWeight: 600, color: f ? undefined : "var(--muted)" }}>{f?.name ?? (isBye ? "BYE" : "Menunggu…")}</span>
                        </span>
                        {ready && (
                          <button className={"btn sm win-pick" + (m.winner_id === fid ? " on" : "")} disabled={busy} onClick={() => setWinner(m, fid)}>
                            {m.winner_id === fid ? "Menang ✓" : "Menang"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {ready && (
                    <label className="check" style={{ marginTop: 4 }}>
                      <input type="checkbox" checked={m.featured} onChange={() => toggleFeatured(m)} /> Tampil hari ini (poster)
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
