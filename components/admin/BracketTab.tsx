"use client";
import { useEffect, useMemo, useState } from "react";
import Avatar from "@/components/Avatar";
import { StatusChip } from "@/components/ui/Chips";
import { sb } from "@/lib/supabase";
import { generateBracket, roundLabel, totalRounds, winnerPatches } from "@/lib/bracket";
import { METHODS, METHOD_LABEL, METHOD_SHORT, isBye, isReady, matchCode, statusOf } from "@/lib/fight";
import type { TabProps } from "@/lib/adminTypes";
import EditModal from "./EditModal";
import type { Fighter, Match, MatchStatus, ResultMethod } from "@/lib/types";

export default function BracketTab({ me, data, reload, notify, confirm, intent }: TabProps) {
  const { matches, fighters, bets, settings, schemaReady, tournament } = data;
  const isSuper = me.role === "superadmin";
  const [busy, setBusy] = useState(false);
  const [resultFor, setResultFor] = useState<{ matchId: string; winnerId: string } | null>(null);
  const byId = useMemo(() => new Map(fighters.map((f) => [f.id, f])), [fighters]);
  const nameOf = (id: string | null | undefined) => (id ? byId.get(id)?.name : undefined) ?? "?";
  const total = totalRounds(matches);
  const paid = fighters.filter((f) => f.paid);
  const tid = settings?.current_tournament_id ?? null;

  /* ---------- dari daftar "perlu diurus": loncat ke fight yang dimaksud ---------- */
  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => {
    if (!intent?.matchId) return;
    const id = intent.matchId;
    const el = document.getElementById("adm-match-" + id);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: document.documentElement.classList.contains("calm") ? "auto" : "smooth" });
    el.focus({ preventScroll: true });
    setFlash(id);
    const t = setTimeout(() => setFlash(null), 2400);
    return () => clearTimeout(t);
  }, [intent?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  async function patch(m: Match, changes: Partial<Match>, okMsg?: string) {
    setBusy(true);
    const { error } = await sb().from("matches").update(changes).eq("id", m.id);
    if (error) notify("Gagal nyimpan fight " + matchCode(m.match_no) + ": " + error.message, true);
    else if (okMsg) notify(okMsg);
    await reload();
    setBusy(false);
  }

  async function generate() {
    if (!isSuper) return notify("Cuma superadmin yang boleh bikin bracket.", true);
    const doneCount = matches.filter((m) => m.winner_id && isReady(m)).length;
    const ok = matches.length
      ? await confirm({
          title: "Buat ulang bracket dari nol?",
          body: `Bracket baru diacak dari ${paid.length} fighter yang udah bayar.`,
          points: [
            `${matches.length} fight lama dihapus, termasuk laga tambahan.`,
            ...(doneCount ? [`${doneCount} hasil fight yang udah dicatat ikut hilang dari arsip.`] : []),
            ...(bets.length ? [`${bets.length} taruhan ikut terhapus. Uangnya harus dibereskan manual.`] : []),
            "Gak bisa dibatalin.",
          ],
          confirmLabel: "Buat ulang bracket",
          tone: "danger",
          typeToConfirm: "ULANG",
        })
      : await confirm({
          title: `Bikin bracket dari ${paid.length} fighter?`,
          body: "Urutan diacak. Slot sisa jadi BYE (lolos otomatis). Fighter yang daftar setelah ini gak masuk bracket.",
          confirmLabel: "Bikin bracket",
        });
    if (!ok) return;
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
      notify(`Bracket jadi: ${rows.length} fight.`);
      await reload();
    } catch (err) {
      notify("Bracket gagal dibuat: " + (err as Error).message, true);
    }
    setBusy(false);
  }

  /** Isi / ganti / batalin hasil resmi. Pemenang maju otomatis, yang kalah di semifinal masuk perebutan juara 3. */
  async function setWinner(m: Match, winnerId: string | null, result?: { result_method: ResultMethod }): Promise<string | null> {
    const patches = winnerPatches(matches, m, winnerId, schemaReady ? result : undefined);
    for (const p of patches) {
      const { error } = await sb().from("matches").update(p.changes).eq("id", p.id);
      if (error) {
        await reload();
        return error.message;
      }
    }
    notify(winnerId
      ? `Fight ${matchCode(m.match_no)}: ${nameOf(winnerId)} menang${result ? " " + METHOD_SHORT[result.result_method] : ""}.`
      : `Hasil fight ${matchCode(m.match_no)} dibatalin.`);
    await reload();
    return null;
  }

  async function undoResult(m: Match) {
    const ok = await confirm({
      title: `Batalin hasil fight ${matchCode(m.match_no)}?`,
      body: <>Fight balik ke belum ada pemenang. <b>{nameOf(m.winner_id)}</b> gak lagi tercatat menang.</>,
      points: consequences(m, null),
      confirmLabel: "Batalin hasil",
      tone: "danger",
    });
    if (!ok) return false;
    setBusy(true);
    const err = await setWinner(m, null);
    setBusy(false);
    if (err) notify("Gagal batalin hasil: " + err, true);
    return !err;
  }

  /** Akibat dari ganti pemenang, dalam kalimat buat dialog. */
  function consequences(m: Match, winnerId: string | null): string[] {
    const out: string[] = [];
    const old = m.winner_id;
    const loserOf = (w: string) => (w === m.fighter1_id ? m.fighter2_id : m.fighter1_id);
    if (old && winnerId && old !== winnerId) out.push(`Hasil lama dicabut: ${nameOf(old)} menang.`);

    if (m.kind === "main") {
      const next = m.round < total ? matches.find((x) => x.kind === "main" && x.round === m.round + 1 && x.slot === Math.floor(m.slot / 2)) : undefined;
      const third = m.round === total - 1 ? matches.find((x) => x.kind === "third") : undefined;
      const where = (x: Match) => `${roundLabel(x.round, total, x.kind)} (fight ${matchCode(x.match_no)})`;
      if (next) {
        if (winnerId && old && old !== winnerId) out.push(`${nameOf(winnerId)} gantiin ${nameOf(old)} di ${where(next)}.`);
        else if (winnerId) out.push(`${nameOf(winnerId)} maju ke ${where(next)}.`);
        else if (old) out.push(`${nameOf(old)} ditarik lagi dari ${where(next)}.`);
      }
      if (third && winnerId && winnerId !== old) out.push(`${nameOf(loserOf(winnerId))} masuk ${where(third)}.`);
      if (!next && m.round === total && winnerId) out.push(`Ini final: ${nameOf(winnerId)} jadi juara turnamen.`);
      // fight tujuan yang udah punya hasil bisa ikut ke-reset
      const resets = winnerPatches(matches, m, winnerId).slice(1).filter((p) => p.changes.winner_id === null);
      for (const p of resets) {
        const x = matches.find((y) => y.id === p.id);
        if (x?.winner_id) out.push(`Hasil fight ${matchCode(x.match_no)} ikut dibatalin dan harus dicatat ulang.`);
      }
    } else if (m.kind === "third" && winnerId) {
      out.push(`${nameOf(winnerId)} jadi juara 3.`);
    }

    const mine = bets.filter((b) => b.match_id === m.id);
    const paidOut = mine.filter((b) => b.paid_out).length;
    if (mine.length) {
      out.push(winnerId && !old
        ? `${mine.length} taruhan langsung dihitung. Yang menang dibayar dari tab Taruhan.`
        : `Hitungan ${mine.length} taruhan ikut berubah.`);
    }
    if (old && paidOut) out.push(`${paidOut} taruhan udah terlanjur dibayar ke pemenang lama. Beresin manual.`);
    if (old || winnerId) out.push(winnerId ? "Hasilnya langsung tampil di halaman penonton." : "Catatannya dicabut dari arsip.");
    return out;
  }

  async function clearFeatured() {
    const q = sb().from("matches").update({ featured: false }).eq("featured", true);
    const { error } = schemaReady && tid ? await q.eq("tournament_id", tid) : await q;
    if (error) return notify("Gagal lepas poster: " + error.message, true);
    notify("Semua poster \"Tampil minggu ini\" dilepas.");
    await reload();
  }

  /** Superadmin: ganti isi slot ronde 1. Fighter yang udah ada di slot lain = tukar posisi. */
  async function assign(m: Match, slot: 1 | 2, fighterId: string) {
    const field = slot === 1 ? "fighter1_id" : "fighter2_id";
    const current = m[field];
    if (fighterId === current) return;
    const other = matches.find((x) => x.kind === "main" && x.round === 1 && (x.fighter1_id === fighterId || x.fighter2_id === fighterId));
    if (other && (other.winner_id || isBye(other) || statusOf(other) === "live")) {
      return notify(`${nameOf(fighterId)} lagi tanding, udah punya hasil, atau lolos otomatis. Posisinya gak bisa ditukar.`, true);
    }
    const touched = bets.filter((b) => b.match_id === m.id || b.match_id === other?.id).length;
    const swapSame = other?.id === m.id;
    const ok = await confirm({
      title: other && !swapSame ? "Tukar posisi dua fighter?" : swapSame ? "Tukar sudut dua fighter?" : `Ganti fighter di fight ${matchCode(m.match_no)}?`,
      points: [
        ...(other && !swapSame
          ? [
              `${nameOf(fighterId)} pindah ke fight ${matchCode(m.match_no)}.`,
              current ? `${nameOf(current)} pindah ke fight ${matchCode(other.match_no)}.` : `Slot ${nameOf(fighterId)} di fight ${matchCode(other.match_no)} jadi kosong.`,
            ]
          : swapSame
            ? [`${nameOf(m.fighter2_id)} dan ${nameOf(m.fighter1_id)} tukeran sudut.`]
            : [`${nameOf(fighterId)} masuk, ${current ? nameOf(current) + " keluar dari bracket" : "slot kosong keisi"}.`]),
        ...(touched ? [`${touched} taruhan di fight ini ke fighter yang pindah dihitung batal dan dikembalikan.`] : []),
      ],
      confirmLabel: other ? "Tukar posisi" : "Ganti fighter",
      tone: touched ? "danger" : "default",
    });
    if (!ok) return;
    setBusy(true);
    try {
      if (swapSame) {
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
      notify("Gagal ganti fighter: " + (err as Error).message, true);
    }
    await reload();
    setBusy(false);
  }

  async function addExtra(aId: string, bId: string) {
    if (!aId || !bId || aId === bId) { notify("Pilih dua fighter yang beda.", true); return false; }
    setBusy(true);
    const extras = matches.filter((m) => m.kind === "extra");
    const { error } = await sb().from("matches").insert({
      kind: "extra", round: 0,
      slot: extras.reduce((n, m) => Math.max(n, m.slot + 1), 0),
      match_no: matches.reduce((n, m) => Math.max(n, m.match_no), 0) + 1,
      fighter1_id: aId, fighter2_id: bId, winner_id: null, featured: false,
      house_cut: settings?.default_house_cut ?? 0.2, tournament_id: tid,
    });
    if (error) notify("Laga tambahan gagal dibuat: " + error.message, true);
    else notify(`Laga tambahan dibuat: ${nameOf(aId)} lawan ${nameOf(bId)}.`);
    await reload();
    setBusy(false);
    return !error;
  }

  async function removeExtra(m: Match) {
    const n = bets.filter((b) => b.match_id === m.id).length;
    const ok = await confirm({
      title: `Hapus laga tambahan ${matchCode(m.match_no)}?`,
      body: <>{nameOf(m.fighter1_id)} lawan {nameOf(m.fighter2_id)}.</>,
      points: [
        ...(m.winner_id ? ["Hasilnya ikut dicabut dari arsip dan rekor fighter."] : []),
        ...(n ? [`${n} taruhan di fight ini ikut terhapus.`] : []),
        "Gak bisa dibatalin.",
      ],
      confirmLabel: "Hapus laga",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    const { error } = await sb().from("matches").delete().eq("id", m.id);
    if (error) notify("Gagal hapus laga: " + error.message, true);
    else notify(`Laga tambahan ${matchCode(m.match_no)} dihapus.`);
    await reload();
    setBusy(false);
  }

  async function cancelFight(m: Match) {
    const n = bets.filter((b) => b.match_id === m.id).length;
    const ok = await confirm({
      title: `Batalkan fight ${matchCode(m.match_no)}?`,
      body: <>{nameOf(m.fighter1_id)} lawan {nameOf(m.fighter2_id)}.</>,
      points: [
        n ? `${n} taruhan di fight ini dihitung batal. Uangnya dikembalikan utuh.` : "Belum ada taruhan di fight ini.",
        "Bisa diaktifkan lagi nanti.",
      ],
      confirmLabel: "Batalkan fight",
      tone: "danger",
    });
    if (ok) await patch(m, { status: "cancelled", featured: false }, `Fight ${matchCode(m.match_no)} dibatalkan.`);
  }

  const groups: { key: string; label: string; items: Match[] }[] = [];
  for (const m of matches) {
    const key = `${m.kind}-${m.round}`;
    let g = groups.find((x) => x.key === key);
    if (!g) groups.push((g = { key, label: roundLabel(m.round, total, m.kind), items: [] }));
    g.items.push(m);
  }
  const featuredCount = matches.filter((m) => m.featured).length;
  const resultMatch = resultFor ? matches.find((m) => m.id === resultFor.matchId) : undefined;
  const card = { byId, busy, isSuper, schemaReady, paid, flash, patch, assign, removeExtra, cancelFight, undoResult, openResult: (m: Match, w: string) => setResultFor({ matchId: m.id, winnerId: w }) };

  return (
    <>
      {matches.length === 0 && (
        isSuper ? (
          <div className="card">
            <h3>Bikin bracket</h3>
            <p className="hint">
              {tournament && <>Turnamen: <strong>{tournament.name}</strong>. </>}
              {paid.length} fighter udah bayar dan siap masuk. Urutan diacak, slot sisa jadi BYE.
            </p>
            <div className="row-actions settings-actions">
              <button className="btn" onClick={generate} disabled={busy || paid.length < 2}>Bikin bracket</button>
              {paid.length < 2 && <span className="hint-inline">Butuh minimal 2 fighter yang udah bayar.</span>}
            </div>
          </div>
        ) : (
          <div className="empty-state">Belum ada bracket. Tunggu superadmin bikin bracket.</div>
        )
      )}

      {featuredCount > 0 && (
        <div className="row-actions bracket-tools">
          <span className="hint-inline">{featuredCount} fight lagi dipajang di poster &quot;Tampil minggu ini&quot;.</span>
          <button className="btn ghost sm" onClick={clearFeatured} disabled={busy}>Lepas semua</button>
        </div>
      )}

      {groups.map((g) => {
        const byes = g.items.filter(isBye);
        const real = g.items.filter((m) => !isBye(m));
        return (
          <section key={g.key} className="bracket-round">
            <div className="sec-head"><h2>{g.label}</h2><span className="sub">{real.filter((m) => m.winner_id).length}/{real.length} selesai</span></div>
            {byes.length > 0 && (
              <p className="bye-list">
                <strong>Lolos otomatis (BYE):</strong>{" "}
                {byes.map((m) => nameOf(m.fighter1_id)).join(", ")}
              </p>
            )}
            <div className="match-grid">
              {real.map((m) => <MatchCard key={m.id} m={m} {...card} />)}
            </div>
          </section>
        );
      })}

      {isSuper && schemaReady && matches.length > 0 && <ExtraForm fighters={fighters} busy={busy} onAdd={addExtra} />}

      {isSuper && matches.length > 0 && (
        <details className="admin-details danger-zone">
          <summary>Buat ulang bracket</summary>
          <p className="hint">Semua fight, hasil, dan taruhan turnamen ini dihapus, lalu bracket diacak ulang dari {paid.length} fighter yang udah bayar.</p>
          <button className="btn danger" onClick={generate} disabled={busy || paid.length < 2}>Buat ulang bracket…</button>
        </details>
      )}

      {resultMatch && resultFor && (
        <ResultModal
          key={resultMatch.id}
          m={resultMatch}
          initialWinner={resultFor.winnerId}
          byId={byId}
          schemaReady={schemaReady}
          consequences={consequences}
          onClose={() => setResultFor(null)}
          onSave={async (winnerId, method) => {
            const m = resultMatch;
            if (winnerId === m.winner_id) {
              // pemenang sama, cuma cara menangnya diubah
              if (!method || method === m.result_method) return null;
              const { error } = await sb().from("matches").update({ result_method: method }).eq("id", m.id);
              if (error) return error.message;
              notify(`Cara menang fight ${matchCode(m.match_no)} diubah jadi ${METHOD_SHORT[method]}.`);
              await reload();
              return null;
            }
            return setWinner(m, winnerId, method ? { result_method: method } : undefined);
          }}
          onUndo={async () => {
            if (await undoResult(resultMatch)) setResultFor(null);
          }}
        />
      )}
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
  flash: string | null;
  patch: (m: Match, changes: Partial<Match>, okMsg?: string) => Promise<void>;
  assign: (m: Match, slot: 1 | 2, fighterId: string) => Promise<void>;
  removeExtra: (m: Match) => Promise<void>;
  cancelFight: (m: Match) => Promise<void>;
  undoResult: (m: Match) => Promise<boolean>;
  openResult: (m: Match, winnerId: string) => void;
};

function MatchCard({ m, byId, busy, isSuper, schemaReady, paid, flash, patch, assign, removeExtra, cancelFight, openResult }: CardProps) {
  const st = statusOf(m);
  const ready = isReady(m);
  const done = !!m.winner_id;
  const code = matchCode(m.match_no);
  const setStatus = (status: MatchStatus, extra: Partial<Match>, msg: string) => patch(m, { status, ...extra }, msg);
  // isi slot cuma boleh diganti sebelum fight-nya mulai
  const canAssign = isSuper && m.kind === "main" && m.round === 1 && !done && (st === "upcoming" || st === "postponed");
  const canPick = ready && !done && st !== "cancelled";
  const names = [m.fighter1_id, m.fighter2_id].map((id) => (id ? byId.get(id)?.name : undefined));

  return (
    <article
      id={"adm-match-" + m.id}
      tabIndex={-1}
      aria-label={`Fight ${code}: ${names[0] ?? "menunggu"} lawan ${names[1] ?? "menunggu"}`}
      className={"match-card admin-match" + (st === "live" ? " is-live" : "") + (m.featured ? " is-called" : "") + (flash === m.id ? " is-flash" : "")}
    >
      <div className="mno">
        <span>Fight {code}</span>
        <StatusChip status={st} />
      </div>

      {[m.fighter1_id, m.fighter2_id].map((fid, i) => {
        const f = fid ? byId.get(fid) : undefined;
        const won = done && m.winner_id === fid;
        return (
          <div className={"pick-row" + (won ? " is-won" : done ? " is-lost" : "")} key={i}>
            <span className="fighter-id">
              {f && <Avatar name={f.name} url={f.photo_url} />}
              <span className={"nm" + (f ? "" : " is-empty")}>{f?.name ?? "Menunggu…"}</span>
            </span>
            {won && <span className="won-tag">Menang{schemaReady && m.result_method ? " · " + METHOD_SHORT[m.result_method] : ""}</span>}
            {canPick && fid && (
              <button className="btn sm win-pick" disabled={busy} onClick={() => openResult(m, fid)} aria-label={`${f?.name ?? "Fighter ini"} menang`}>
                Menang
              </button>
            )}
          </div>
        );
      })}

      {done && (
        <div className="row-actions">
          <button className="btn ghost sm" disabled={busy} onClick={() => openResult(m, m.winner_id!)}>Ubah hasil</button>
        </div>
      )}

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

      {ready && schemaReady && !done && (
        <div className="row-actions">
          {(st === "upcoming" || st === "postponed") && (
            <button className="btn sm" disabled={busy} onClick={() => setStatus("live", { featured: true }, `Fight ${code} mulai. Taruhan ditutup otomatis.`)}>Mulai fight</button>
          )}
          {st === "live" && (
            <button className="btn ghost sm" disabled={busy} onClick={() => setStatus("upcoming", {}, `Fight ${code} balik ke belum mulai. Taruhan dibuka lagi.`)}>Batal mulai</button>
          )}
          {st === "upcoming" && (
            <button className="btn ghost sm" disabled={busy} onClick={() => setStatus("postponed", {}, `Fight ${code} ditunda.`)}>Tunda</button>
          )}
          {st === "postponed" && (
            <button className="btn ghost sm" disabled={busy} onClick={() => setStatus("upcoming", {}, `Fight ${code} gak jadi ditunda.`)}>Batal tunda</button>
          )}
          {st !== "cancelled" ? (
            <button className="btn danger sm" disabled={busy} onClick={() => cancelFight(m)}>Batalkan fight</button>
          ) : (
            <button className="btn ghost sm" disabled={busy} onClick={() => setStatus("upcoming", {}, `Fight ${code} diaktifkan lagi.`)}>Aktifkan lagi</button>
          )}
        </div>
      )}

      {ready && (
        <label className="check">
          <input type="checkbox" checked={m.featured} disabled={busy} onChange={() => patch(m, { featured: !m.featured }, m.featured ? `Fight ${code} gak dipajang lagi.` : `Fight ${code} dipajang di poster "Tampil minggu ini".`)} />
          Tampil minggu ini
        </label>
      )}
      {m.kind === "extra" && isSuper && (
        <div className="row-actions">
          <button className="btn danger sm" disabled={busy} onClick={() => removeExtra(m)}>Hapus laga tambahan</button>
        </div>
      )}
    </article>
  );
}

function ResultModal({ m, initialWinner, byId, schemaReady, consequences, onClose, onSave, onUndo }: {
  m: Match;
  initialWinner: string;
  byId: Map<string, Fighter>;
  schemaReady: boolean;
  consequences: (m: Match, winnerId: string | null) => string[];
  onClose: () => void;
  onSave: (winnerId: string, method: ResultMethod | null) => Promise<string | null>;
  onUndo: () => Promise<void>;
}) {
  const editing = !!m.winner_id;
  const [winner, setWinner] = useState(initialWinner);
  // hasil baru: cara menang WAJIB dipilih sendiri (gak ada pilihan bawaan yang kebawa tanpa sadar)
  const [method, setMethod] = useState<ResultMethod | null>(editing ? m.result_method ?? null : null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const code = matchCode(m.match_no);
  const sides = [m.fighter1_id!, m.fighter2_id!];
  const needMethod = schemaReady && !method;
  const unchanged = editing && winner === m.winner_id && (!schemaReady || method === (m.result_method ?? null));
  const points = winner !== m.winner_id ? consequences(m, winner) : [];

  return (
    <EditModal
      title={editing ? `Ubah hasil fight ${code}` : `Catat hasil fight ${code}`}
      onClose={onClose}
      busy={busy}
      error={err}
      submitLabel={editing ? "Simpan hasil" : "Catat hasil"}
      submitDisabled={needMethod || unchanged}
      onSubmit={async () => {
        setBusy(true);
        setErr(null);
        const e = await onSave(winner, schemaReady ? method : null);
        setBusy(false);
        if (e) setErr("Gagal nyimpan hasil: " + e);
        else onClose();
      }}
      extra={editing ? <button type="button" className="btn danger" disabled={busy} onClick={onUndo}>Batalin hasil</button> : undefined}
    >
      <fieldset className="choice">
        <legend>Pemenang</legend>
        <div className="choice-grid">
          {sides.map((id) => {
            const f = byId.get(id);
            return (
              <label key={id} className={"choice-opt is-fighter" + (winner === id ? " is-on" : "")}>
                <input type="radio" name="winner" value={id} checked={winner === id} onChange={() => setWinner(id)} />
                {f && <Avatar name={f.name} url={f.photo_url} />}
                <span>{f?.name ?? "?"}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {schemaReady && (
        <fieldset className="choice">
          <legend>Cara menang</legend>
          <div className="choice-grid is-methods">
            {METHODS.map((k) => (
              <label key={k} className={"choice-opt" + (method === k ? " is-on" : "")}>
                <input type="radio" name="method" value={k} checked={method === k} onChange={() => setMethod(k)} />
                <span><b>{METHOD_SHORT[k]}</b><small>{METHOD_LABEL[k]}</small></span>
              </label>
            ))}
          </div>
          {needMethod && <p className="hint">Pilih cara menangnya dulu.</p>}
        </fieldset>
      )}

      {points.length > 0 && (
        <div className="result-effects">
          <p>Yang terjadi setelah disimpan:</p>
          <ul className="confirm-points">{points.map((p, i) => <li key={i}>{p}</li>)}</ul>
        </div>
      )}
    </EditModal>
  );
}

function ExtraForm({ fighters, busy, onAdd }: { fighters: Fighter[]; busy: boolean; onAdd: (a: string, b: string) => Promise<boolean> }) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  return (
    <details className="admin-details">
      <summary>Tambah laga tambahan</summary>
      <form
        className="card extra-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await onAdd(a, b)) { setA(""); setB(""); }
        }}
      >
        <p className="hint">Fight di luar bracket, misal laga pembuka. Masuk arsip dan rekor fighter, dan bisa ditaruhin.</p>
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
          <button className="btn" disabled={busy || !a || !b}>Tambah laga</button>
        </div>
      </form>
    </details>
  );
}
