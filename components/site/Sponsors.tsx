"use client";
import { useState } from "react";
import Reveal from "@/components/ui/Reveal";
import { yen } from "@/lib/betting";
import { tilt, tornClip } from "@/lib/codes";
import { PRIZE_CUT_PCT, type Prize } from "@/lib/prize";
import type { Sponsor } from "@/lib/types";

/** Berapa sponsor (setelah sponsor utama) yang dapat flyer penuh. Sisanya jadi tiket kecil. */
const FLYERS = 4;

/** Inisial buat sponsor tanpa logo: "Warung Bu Tini" → "WBT", "Alumni Angkatan 19" → "AA19". */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean).slice(0, 4);
  return words.map((w) => (/^\d+$/.test(w) ? w : w[0])).join("").toUpperCase().slice(0, 5) || "?";
}

/** Logo dicetak di kertas: utuh (gak dipotong), hitam putih, tapi gak dibikin kontras ekstrem biar logo gelap tetap kebaca. */
function Logo({ s }: { s: Sponsor }) {
  const [broken, setBroken] = useState(false);
  const show = !!s.photo_url && !broken;
  return (
    <span className={"spon-logo" + (show ? "" : " is-seal")}>
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={s.photo_url!} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} />
      ) : (
        <span className="spon-seal" aria-hidden="true"><b>{initials(s.name)}</b></span>
      )}
    </span>
  );
}

const pctOf = (amount: number, total: number) => (total > 0 ? Math.max(1, Math.round((amount / total) * 100)) : 0);

/** Porsi sponsor ini dari total uang sponsor. */
function Share({ amount, total }: { amount: number; total: number }) {
  const pct = pctOf(amount, total);
  return (
    <span className="spon-share">
      <span className="spon-bar" aria-hidden="true"><i style={{ "--w": pct / 100 } as React.CSSProperties} /></span>
      <span className="spon-pct">{pct}% dari uang sponsor</span>
    </span>
  );
}

const paper = (key: string, deg = 1.4) => ({ "--tilt": `${tilt(key, deg)}deg`, clipPath: tornClip(key, { top: true, bottom: true }, 5, 16) }) as React.CSSProperties;

/**
 * Tembok sponsor: flyer kertas ditempel, yang nyumbang paling gede paling besar.
 * - Sponsor utama: flyer lebar + cap. Sebelahnya struk "hitungan hadiah" (uang sponsor → hadiah juara).
 * - 4 sponsor berikutnya: flyer biasa. Sisanya: tiket kecil, biar tembok gak kepanjangan.
 * - Sponsor tanpa uang (barang / jasa): label kecil "Juga mendukung".
 */
export default function Sponsors({ sponsors, prize }: { sponsors: Sponsor[]; prize: Prize | null }) {
  const money = sponsors.filter((s) => s.amount > 0); // udah urut dari yang terbesar
  const kind = sponsors.filter((s) => s.amount <= 0);
  const total = money.reduce((sum, s) => sum + s.amount, 0);
  const lead = money[0] ?? null;
  // gak ada sponsor uang sama sekali → semua tampil sebagai flyer biasa
  const flyers = lead ? money.slice(1, 1 + FLYERS) : kind;
  const stubs = lead ? money.slice(1 + FLYERS) : [];
  const tags = lead ? kind : [];
  const showReceipt = !!prize && total > 0 && prize.total > 0;

  return (
    <div className="spon-board">
      <ul className="spon-wall">
        {lead && (
          <Reveal as="li" kind="up" className="w2">
            <article className="spon is-lead is-wide" style={paper("spon" + lead.id, 1)}>
              <span className="tape spon-tape" aria-hidden="true" />
              <Logo s={lead} />
              <div className="spon-body">
                {money.length > 1 && <span className="stamp stamp-red stamp-slam spon-stamp" style={{ "--tilt": "-5deg" } as React.CSSProperties}>Sponsor utama</span>}
                <h3 className="spon-name">{lead.name}</h3>
                <p className="spon-amount"><span>Sponsor</span><b>{yen(lead.amount)}</b></p>
                {money.length > 1 && <Share amount={lead.amount} total={total} />}
              </div>
            </article>
          </Reveal>
        )}

        {showReceipt && (
          <Reveal as="li" kind="up" delay={90} className="w2 is-receipt">
            <div className="receipt" style={{ clipPath: tornClip("receipt", { top: false, bottom: true }, 6, 22) }}>
              <p className="receipt-head">Hitungan hadiah</p>
              <dl>
                <div><dt>Uang sponsor</dt><dd>{yen(prize!.sponsors)}</dd></div>
                <div><dt>Uang pendaftaran</dt><dd><span aria-hidden="true">+ </span>{yen(prize!.registration)}</dd></div>
                <div className="is-cut"><dt>Kas panitia {PRIZE_CUT_PCT}%</dt><dd><span aria-hidden="true">− </span>{yen(prize!.cut)}</dd></div>
                <div className="is-total"><dt>Hadiah juara</dt><dd>{yen(prize!.total)}</dd></div>
              </dl>
              <a className="receipt-link" href="#juara">Lihat pembagian juara</a>
            </div>
          </Reveal>
        )}

        {flyers.map((s, i) => (
          <Reveal
            as="li"
            key={s.id}
            kind="up"
            delay={Math.min(i + 2, 6) * 70}
            // jumlah flyer ganjil → yang terakhir dibikin lebar di HP, biar gak sendirian di tengah
            className={"w1" + (flyers.length % 2 === 1 && i === flyers.length - 1 ? " is-odd" : "")}
          >
            <article className="spon" style={paper("spon" + s.id)}>
              <span className="tape spon-tape" aria-hidden="true" />
              <Logo s={s} />
              <div className="spon-body">
                <h3 className="spon-name">{s.name}</h3>
                {s.amount > 0 ? (
                  <>
                    <p className="spon-amount"><span>Sponsor</span><b>{yen(s.amount)}</b></p>
                    <Share amount={s.amount} total={total} />
                  </>
                ) : (
                  <p className="spon-amount is-kind"><span>Pendukung</span></p>
                )}
              </div>
            </article>
          </Reveal>
        ))}
      </ul>

      {stubs.length > 0 && (
        <ul className="spon-stubs">
          {stubs.map((s, i) => (
            <Reveal as="li" key={s.id} kind="up" delay={Math.min(i, 6) * 50} className="spon-stub">
              {s.photo_url ? <Logo s={s} /> : <span className="spon-stub-mark" aria-hidden="true">{initials(s.name)}</span>}
              <h3 className="spon-stub-name">{s.name}</h3>
              <span className="spon-stub-amount">
                <b>{yen(s.amount)}</b>
                <small>{pctOf(s.amount, total)}%</small>
              </span>
            </Reveal>
          ))}
        </ul>
      )}

      {tags.length > 0 && (
        <Reveal className="spon-also" kind="fade">
          <h3 className="spon-also-k">Juga mendukung</h3>
          <ul>
            {tags.map((s) => (
              <li key={s.id} className="spon-tag" style={{ "--tilt": `${tilt("tag" + s.id, 1.8)}deg` } as React.CSSProperties}>
                {s.photo_url && <Logo s={s} />}
                <span>{s.name}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      )}
    </div>
  );
}
