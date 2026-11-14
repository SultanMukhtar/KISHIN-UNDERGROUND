"use client";
import { useEffect, useState } from "react";

/** Sisa waktu (ms) sampai `iso`, update tiap detik. null = gak ada jadwal. */
export function useRemaining(iso: string | null | undefined): number | null {
  const target = iso ? Date.parse(iso) : NaN;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (Number.isNaN(target)) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);
  return Number.isNaN(target) ? null : target - now;
}

const p = (n: number) => String(n).padStart(2, "0");

/** Hitung mundur ke jadwal fight. Lewat jadwal tapi belum mulai: "Sebentar lagi". */
export default function Countdown({ to, className = "" }: { to: string | null | undefined; className?: string }) {
  const left = useRemaining(to);
  if (left === null) return null;
  if (left <= 0) return <span className={`cd is-due ${className}`}>Sebentar lagi</span>;
  const s = Math.floor(left / 1000);
  const d = Math.floor(s / 86400);
  const text = `${p(Math.floor((s % 86400) / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
  return (
    <span className={`cd ${className}`} role="timer" aria-label={`Mulai dalam ${d ? d + " hari " : ""}${text}`}>
      {d > 0 && <span className="cd-days">{d} hari</span>}
      <span className="cd-clock">{text}</span>
    </span>
  );
}
