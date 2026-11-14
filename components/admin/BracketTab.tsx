"use client";
import { useEffect, useMemo, useState } from "react";
import Avatar from "@/components/Avatar";
import { StatusChip } from "@/components/ui/Chips";
import { sb } from "@/lib/supabase";
import { generateBracket, roundLabel, totalRounds, winnerPatches } from "@/lib/bracket";
import { METHODS, METHOD_LABEL, METHOD_SHORT, fmtClock, fromLocalInput, isBye, isReady, matchCode, parseClock, statusOf, toLocalInput } from "@/lib/fight";
import type { TabProps } from "@/lib/adminTypes";
import type { Fighter, Match, MatchStatus, ResultMethod } from "@/lib/types";

export default function BracketTab({ me, data, reload, notify }: TabProps) {
  const { matches, fighters, bets, settings, schemaReady, tournament } = data;
  const isSuper = me.role === "superadmin";
  const [busy, setBusy] = useState(false);
  const byId = useMemo(() => new Map(fighters.map((f) => [f.id, f])), [fighters]);
  const total = totalRounds(matches);
  const paid = fighters.filter((f) => f.paid);
  const tid = settings?.current_tournament_id ?? null;

  async function patch(m: Match, changes: Partial<Match>, okMsg?: string) {
    setBusy(true);
    const { error } = await sb().from("matches").update(changes).eq("id", m.id);
    if (error) notify(error.message, true);
    else if (okMsg) notify(okMsg);
    await reload();
    setBusy(false);
  }

  async function generate() {
    if (!isSuper) return notify("Cuma superadmin yang boleh generate bracket.", true);
    const warn = matches.length
      ? `Bracket lama (${matches.length} match, termasuk laga tambahan), catatan fight-nya, dan SEMUA taruhan (${bets.length}) akan dihapus dan dibuat ulang. Lanjut?`
      : `Buat bracket dari ${paid.length} fighter yang sudah bayar? Urutan diacak.`;
    if (!confirm(warn)) return;
    setBusy(true);
    try {
      const rows = generateBracket(paid.map((f) => f.id), settings?.default_house_cut ?? 0.2, schemaReady ? tid : null);
      const c = sb();
      if (matches.length) {
        // cuma match turnamen yang lagi jalan; turnamen arsip gak disentuh
        const del = schemaReady && tid
          ? await c.from("matches").delete().eq("tournament_id", tid)
          : await c.from("matches").delete().not("id", "is", null);
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

  /** Isi / ganti / batalin hasil resmi. Pemenang maju otomatis, yang kalah di semifinal masuk perebutan juara 3. */
  async function setWinner(m: Match, winnerId: string | null, result?: { result_method: ResultMethod; duration_sec: number | null }) {
    setBusy(true);
    const patches = winnerPatches(matches, m, winnerId, schemaReady ? result : undefined);
    let failed = false;
    for (const p of patches) {
      const { error } = await sb().from("matches").update(p.changes).eq("id", p.id);
      if (error) { notify(error.message, true); failed = true; break; }
    }
    if (!failed) {
      notify(winnerId ? `Hasil resmi fight ${matchCode(m.match_no)} masuk: ${byId.get(winnerId)?.name ?? "?"} menang.` : `Hasil fight ${matchCode(m.match_no)} dibatalkan.`);
    }
    await reload();
    setBusy(false);
  }

  async function clearFeatured() {
    const q = sb().from("matches").update({ featured: false }).eq("featured", true);
    const { error } = schemaReady && tid ? await q.eq("tournament_id", tid) : await q;
    if (error) return notify(error.message, true);
    await reload();
  }

  /** Superadmin: ganti isi slot ronde 1. Fighter yang udah ada di slot lain = tukar posisi. */
  async function assign(m: Match, slot: 1 | 2, fighterId: string) {
    const field = slot === 1 ? "fighter1_id" : "fighter2_id";
    const current = m[field];
    if (fighterId === current) return;
    const other = matches.find((x) => x.kind === "main" && x.round === 1 && (x.fighter1_id === fighterId || x.fighter2_id === fighterId));
    if (other && (other.winner_id || isBye(other) || statusOf(other) === "live")) {
      return notify(`${byId.get(fighterId)?.name ?? "Fighter itu"} lagi tanding, udah punya hasil, atau lolos otomatis. Slot-nya gak bisa ditukar.`, true);
    }
    const touched = bets.filter((b) => b.match_id === m.id || b.match_id === other?.id).length;
    if (touched && !confirm(`Fight ini udah punya ${touched} taruhan. Taruhan ke fighter yang dipindah bakal dihitung batal dan harus dikembalikan. Lanjut ganti fighter?`)) return;
    setBusy(true);
    try {
      if (other && other.id === m.id) {
        const r = await sb().from("matches").update({ fighter1_id: m.fighter2_id, fighter2_id: m.fighter1_id }).eq("id", m.id);
        if (r.error) throw r.error;
      } else {
        if (other) {
          const otherField = other.fighter1_id === fighterId ? "fighter1_id" : "fighter2_id";
          const r = await sb().from("matches").update({ [otherField]: current }).eq("id", other.id);
          if (r.error) throw r.error;
        }
        const r = await sb().from("matches").update({ [field]: fighterId }).eq("id", m.id);
        if (r.error) throw r.error;
      }
      notify(other ? "Posisi dua fighter ditukar." : "Fighter di slot itu diganti.");
    } catch (err) {
      notify((err as Error).message, true);
    }
    await reload();
    setBusy(false);
  }

  async function addExtra(aId: string, bId: string, when: string) {
    if (!aId || !bId || aId === bId) return notify("Pilih dua fighter yang beda.", true);
    setBusy(true);
    const extras = matches.filter((m) => m.kind === "extra");
    const { error } = await sb().from("matches").insert({
      kind: "extra", round: 0,
      slot: extras.reduce((n, m) => Math.max(n, m.slot + 1), 0),
      match_no: matches.reduce((n, m) => Math.max(n, m.match_no), 0) + 1,
      fighter1_id: aId, fighter2_id: bId, winner_id: null, featured: false,
      house_cut: settings?.default_house_cut ?? 0.2, tournament_id: tid, scheduled_at: fromLocalInput(when),
    });
    if (error) notify(error.message, true);
    else notify("Laga tambahan dibuat.");
    await reload();
    setBusy(false);
  }

  async function removeExtra(m: Match) {
    const n = bets.filter((b) => b.match_id === m.id).length;
    if (!confirm(`Hapus laga tambahan ${matchCode(m.match_no)}?${n ? ` ${n} taruhan di fight ini ikut terhapus.` : ""} Gak bisa dibatalin.`)) return;
    setBusy(true);
    const { error } = await sb().from("matches").delete().eq("id", m.id);
    if (error) notify(error.message, true);
    else notify(`Laga tambahan ${matchCode(m.match_no)} dihapus.`);
    await reload();
    setBusy(false);
  }

  const groups: { key: string; label: string; items: Match[] }[] = [];
  for (const m of matches) {
    const key = `${m.kind}-${m.round}`;
    let g = groups.find((x) => x.key === key);
    if (!g) groups.push((g = { key, label: roundLabel(m.round, total, m.kind), items: [] }));
    g.items.push(m);
  }
  const featuredCount = matches.filter((m) => m.featured).length;
  const card = { byId, busy, isSuper, schemaReady, paid, patch, setWinner, assign, removeExtra, notify };

  return (
    <>
      {isSuper && (
        <div className="card">
          <h3>Generate bracket otomatis</h3>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0 }}>
            {tournament && <>Turnamen: <strong>{tournament.name}</strong>. </>}
            Pakai {paid.length} fighter yang statusnya <strong>Sudah bayar</strong>. Diacak, sisa slot jadi BYE (lolos otomatis), pemenang otomatis maju ke ronde berikutnya, yang kalah di semifinal otomatis masuk Perebutan Juara 3.
          </p>
          <div className="row-actions">
            <button className={matches.length ? "btn danger" : "btn"} onClick={generate} disabled={busy || paid.length < 2}>{matches.length ? "Buat ulang bracket" : "Generate bracket"}</button>
            {paid.length < 2 && <span style={{ fontSize: 13, color: "var(--muted)" }}>Butuh minimal 2 fighter yang sudah bayar.</span>}
          </div>
        </div>
      )}

      {isSuper && schemaReady && <ExtraForm fighters={fighters} busy={busy} onAdd={addExtra} />}

      {featuredCount > 0 && (
        <div className="row-actions" style={{ marginTop: 12 }}>
          <button className="btn ghost" onClick={clearFeatured} disabled={busy}>Lepas semua poster &quot;Tampil hari ini&quot; ({featuredCount})</button>
        </div>
      )}

      {groups.length === 0 && (
        <div className="empty-state">{isSuper ? "Belum ada bracket. Generate dulu di atas." : "Belum ada bracket. Tunggu superadmin generate bracket."}</div>
      )}
      {groups.map((g) => {
        const byes = g.items.filter(isBye);
        const real = g.items.filter((m) => !isBye(m));
        return (
          <section key={g.key} style={{ marginTop: 22 }}>
            <div className="sec-head"><h2>{g.label}</h2><span className="sub">{real.filter((m) => m.winner_id).length}/{real.length} selesai</span></div>
            {byes.length > 0 && (
              <p className="bye-list">
                <strong>Lolos otomatis (BYE):</strong>{" "}
                {byes.map((m) => byId.get(m.fighter1_id!)?.name ?? "?").join(", ")}
              </p>
            )}
            <div className="match-grid">
              {real.map((m) => <MatchCard key={m.id} m={m} {...card} />)}
            </div>
          </section>
        );
      })}
    </>
  );
}

type CardProps = {
  m: Match;
  byId: Map<string, Fighter>;
  busy: boolean;
  isSuper: boolean;
  schemaReady: boolean;
  paid: Fighter[];
  patch: (m: Match, changes: Partial<Match>, okMsg?: string) => Promise<void>;
  setWinner: (m: Match, winnerId: string | null, result?: { result_method: ResultMethod; duration_sec: number | null }) => Promise<void>;
  assign: (m: Match, slot: 1 | 2, fighterId: string) => Promise<void>;
  removeExtra: (m: Match) => Promise<void>;
  notify: (msg: string, err?: boolean) => void;
};

function MatchCard({ m, byId, busy, isSuper, schemaReady, paid, patch, setWinner, assign, removeExtra, notify }: CardProps) {
  const st = statusOf(m);
  const ready = isReady(m);
  const done = !!m.winner_id;
  const [method, setMethod] = useState<ResultMethod>(m.result_method ?? "KO");
  const [clock, setClock] = useState(fmtClock(m.duration_sec) ?? "");
  const [when, setWhen] = useState(toLocalInput(m.scheduled_at));
  const code = matchCode(m.match_no);

  // data dari admin lain masuk → form ikut nilai terbaru
  useEffect(() => { setWhen(toLocalInput(m.scheduled_at)); }, [m.scheduled_at]);
  useEffect(() => {
    setMethod(m.result_method ?? "KO");
    setClock(fmtClock(m.duration_sec) ?? "");
  }, [m.result_method, m.duration_sec, m.winner_id]);

  const duration = (): number | null | undefined => {
    const d = parseClock(clock);
    if (d === undefined) notify("Durasi pakai format menit:detik, misal 2:31. Kosongin kalau gak dicatat.", true);
    return d;
  };

  function pickWinner(fid: string) {
    if (m.winner_id === fid) {
      if (confirm(`Batalin hasil resmi fight ${code}? Pemenangnya ditarik lagi dari ronde berikutnya dan catatan arsipnya dicabut.`)) setWinner(m, null);
      return;
    }
    const d = duration();
    if (d === undefined) return;
    setWinner(m, fid, { result_method: method, duration_sec: d });
  }

  function saveDetail() {
    const d = duration();
    if (d === undefined) return;
    patch(m, { result_method: method, duration_sec: d }, `Detail hasil fight ${code} disimpan.`);
  }

  const whenDirty = when !== toLocalInput(m.scheduled_at);
  function saveWhen() {
    if (!whenDirty) return;
    const iso = fromLocalInput(when);
    patch(m, { scheduled_at: iso }, iso ? `Jadwal fight ${code} disimpan.` : `Jadwal fight ${code} dikosongkan.`);
  }

  const setStatus = (status: MatchStatus, extra: Partial<Match>, msg: string) => patch(m, { status, ...extra }, msg);
  // isi slot cuma boleh diganti sebelum fight-nya mulai
  const canAssign = isSuper && m.kind === "main" && m.round === 1 && !done && (st === "upcoming" || st === "postponed");

  return (
    <div className={"match-card admin-match" + (st === "live" ? " is-live" : "") + (m.featured ? " is-called" : "")}>
      <div className="mno">
        <span>Match {code}</span>
        <StatusChip status={st} />
      </div>

      {[m.fighter1_id, m.fighter2_id].map((fid, i) => {
        const f = fid ? byId.get(fid) : undefined;
        return (
          <div className="pick-row" key={i}>
            <span className="fighter-id" style={{ flex: 1 }}>
              {f && <Avatar name={f.name} url={f.photo_url} />}
              <span className="nm" style={{ fontWeight: 600, color: f ? undefined : "var(--muted)" }}>{f?.name ?? "Menunggu…"}</span>
            </span>
            {ready && fid && st !== "cancelled" && (
              <button className={"btn sm win-pick" + (m.winner_id === fid ? " on" : "")} disabled={busy} onClick={() => pickWinner(fid)}>
                {m.winner_id === fid ? "Menang ✓" : "Menang"}
              </button>
            )}
          </div>
        );
      })}

      {canAssign && (
        <div className="am-row">
          {([1, 2] as const).map((slot) => (
            <label className="f" key={slot}>
              Slot {slot}
              <select value={(slot === 1 ? m.fighter1_id : m.fighter2_id) ?? ""} disabled={busy} onChange={(e) => e.target.value && assign(m, slot, e.target.value)}>
                <option value="" disabled>Pilih fighter…</option>
                {paid.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </label>
          ))}
        </div>
      )}

      {ready && schemaReady && (
        <>
          <div className="am-row">
            <label className="f">
              Cara menang
              <select value={method} onChange={(e) => setMethod(e.target.value as ResultMethod)} disabled={st === "cancelled"}>
                {METHODS.map((k) => <option key={k} value={k}>{METHOD_LABEL[k]}</option>)}
              </select>
            </label>
            <label className="f">
              Durasi (menit:detik)
              <input type="text" inputMode="numeric" placeholder="2:31" value={clock} onChange={(e) => setClock(e.target.value)} disabled={st === "cancelled"} />
            </label>
          </div>
          {done ? (
            <div className="row-actions">
              <span className="am-note">Hasil: {METHOD_SHORT[m.result_method ?? "KO"]}{fmtClock(m.duration_sec) ? `, ${fmtClock(m.duration_sec)}` : ""}</span>
              <button className="btn ghost sm" disabled={busy} onClick={saveDetail}>Simpan detail hasil</button>
            </div>
          ) : (
            <>
              {st !== "cancelled" && <p className="am-note">Pilih cara menang dulu, lalu klik Menang di fighter yang menang.</p>}
              <div className="am-when">
                <label className="f">
                  Jadwal fight
                  <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
                </label>
                <button type="button" className="btn ghost sm" disabled={busy || !whenDirty} onClick={saveWhen}>Simpan jadwal</button>
              </div>
              <div className="row-actions">
                {(st === "upcoming" || st === "postponed") && (
                  <button className="btn sm" disabled={busy} onClick={() => setStatus("live", { featured: true }, `Fight ${code} mulai. Taruhan ditutup otomatis.`)}>Mulai fight</button>
                )}
                {st === "live" && (
                  <button className="btn ghost sm" disabled={busy} onClick={() => setStatus("upcoming", {}, `Fight ${code} balik ke belum mulai.`)}>Batal mulai</button>
                )}
                {st === "upcoming" && (
                  <button className="btn ghost sm" disabled={busy} onClick={() => setStatus("postponed", {}, `Fight ${code} ditunda.`)}>Tunda</button>
                )}
                {st === "postponed" && (
                  <button className="btn ghost sm" disabled={busy} onClick={() => setStatus("upcoming", {}, `Fight ${code} dijadwalkan lagi.`)}>Jadwalkan lagi</button>
                )}
                {st !== "cancelled" ? (
                  <button
                    className="btn danger sm"
                    disabled={busy}
                    onClick={() => confirm(`Batalkan fight ${code}? Taruhan di fight ini dihitung batal dan harus dikembalikan utuh.`) && setStatus("cancelled", { featured: false }, `Fight ${code} dibatalkan.`)}
                  >
                    Batalkan fight
                  </button>
                ) : (
                  <button className="btn ghost sm" disabled={busy} onClick={() => setStatus("upcoming", {}, `Fight ${code} diaktifkan lagi.`)}>Aktifkan lagi</button>
                )}
              </div>
            </>
          )}
        </>
      )}

      {ready && (
        <label className="check" style={{ marginTop: 4 }}>
          <input type="checkbox" checked={m.featured} disabled={busy} onChange={() => patch(m, { featured: !m.featured })} /> Tampil hari ini (poster di Lagi di ring)
        </label>
      )}
      {m.kind === "extra" && isSuper && (
        <div className="row-actions">
          <button className="btn danger sm" disabled={busy} onClick={() => removeExtra(m)}>Hapus laga tambahan</button>
        </div>
      )}
    </div>
  );
}

function ExtraForm({ fighters, busy, onAdd }: { fighters: Fighter[]; busy: boolean; onAdd: (a: string, b: string, when: string) => Promise<void> }) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [when, setWhen] = useState("");
  return (
    <form
      className="card"
      onSubmit={async (e) => {
        e.preventDefault();
        await onAdd(a, b, when);
        setA(""); setB(""); setWhen("");
      }}
    >
      <h3>Tambah laga tambahan</h3>
      <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 0 }}>
        Fight di luar bracket (misal laga pembuka atau tantangan). Gak ngaruh ke bracket, tapi masuk arsip, rekor fighter, dan bisa ditaruhin.
      </p>
      <div className="form-grid">
        <label className="f">Fighter A
          <select value={a} onChange={(e) => setA(e.target.value)} required>
            <option value="">Pilih…</option>
            {fighters.map((f) => <option key={f.id} value={f.id} disabled={f.id === b}>{f.name}</option>)}
          </select>
        </label>
        <label className="f">Fighter B
          <select value={b} onChange={(e) => setB(e.target.value)} required>
            <option value="">Pilih…</option>
            {fighters.map((f) => <option key={f.id} value={f.id} disabled={f.id === a}>{f.name}</option>)}
          </select>
        </label>
        <label className="f">Jadwal (opsional)
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </label>
        <button className="btn" disabled={busy || !a || !b}>Tambah laga</button>
      </div>
    </form>
  );
}
