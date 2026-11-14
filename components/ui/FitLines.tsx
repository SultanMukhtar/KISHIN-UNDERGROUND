"use client";
import { useLayoutEffect, useRef } from "react";

/**
 * Tiap baris teks digedein sampai pas selebar wadah (gaya poster brutalist).
 * `max` = batas ukuran font (px) biar kata pendek gak jadi segede gedung.
 * Tiap baris dapat --i (urutan) dan wadahnya --n (jumlah baris), dipakai CSS buat masuk berurutan.
 */
export default function FitLines({ lines, max = 300, className = "" }: { lines: string[]; max?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const key = lines.join("|");

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const W = el.clientWidth;
      if (!W) return;
      el.querySelectorAll<HTMLElement>("[data-fit]").forEach((s) => {
        s.style.fontSize = "100px";
        const w = s.getBoundingClientRect().width;
        if (w > 0) s.style.fontSize = Math.min(max, (100 * W) / w).toFixed(2) + "px";
      });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    document.fonts?.ready.then(fit).catch(() => {});
    return () => ro.disconnect();
  }, [key, max]);

  return (
    <div ref={ref} className={className} aria-hidden="true" style={{ "--n": lines.length } as React.CSSProperties}>
      {lines.map((l, i) => (
        <span
          key={i}
          data-fit
          className="fit-line"
          // tebakan awal sebelum JS ngukur, biar gak lompat jauh
          style={{ fontSize: `min(${max}px, ${(88 / Math.max(l.length, 1) / 0.5).toFixed(2)}vw)`, "--i": i } as React.CSSProperties}
        >
          {l}
        </span>
      ))}
    </div>
  );
}

/** Pecah nama event jadi baris-baris pendek (maks ~12 huruf per baris). */
export function splitTitle(title: string, maxChars = 12): string[] {
  const words = title.trim().toUpperCase().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  for (const w of words) {
    const last = lines[lines.length - 1];
    if (last && last.length + 1 + w.length <= maxChars && (last.length <= 3 || w.length <= 3)) lines[lines.length - 1] = `${last} ${w}`;
    else lines.push(w);
  }
  return lines.length ? lines : ["UNDERGROUND"];
}

/** Versi layar sempit: kata panjang berakhiran GROUND dipecah (UNDER / GROUND) biar hurufnya tetap gede. */
export function narrowTitle(lines: string[]): string[] {
  return lines.flatMap((l) => (!l.includes(" ") && l.length >= 9 && l.endsWith("GROUND") ? [l.slice(0, -6), "GROUND"] : [l]));
}
