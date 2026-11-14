"use client";
import { useEffect, useRef } from "react";
import { useBooted } from "@/components/site/Ui";
import { isCalm } from "@/lib/motion";

/**
 * Angka yang "ngitung" ke nilainya: sekali waktu pertama kelihatan, dan lagi tiap datanya berubah.
 * Gak pernah jalan sendiri tanpa alasan.
 */
export default function CountUp({ value, format = String, duration = 900 }: { value: number; format?: (n: number) => string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(0);
  const seen = useRef(false);
  const raf = useRef(0);
  const fmt = useRef(format);
  fmt.current = format;
  const booted = useBooted();

  useEffect(() => {
    const el = ref.current;
    if (!el || !booted) return;
    const paint = (n: number) => {
      shown.current = n;
      el.textContent = fmt.current(Math.round(n));
    };
    const run = () => {
      cancelAnimationFrame(raf.current);
      const from = shown.current;
      if (isCalm() || from === value) {
        seen.current = true;
        return paint(value);
      }
      const t0 = performance.now();
      const dur = seen.current ? Math.min(duration, 500) : duration;
      const step = (t: number) => {
        const k = Math.min(1, (t - t0) / dur);
        paint(from + (value - from) * (1 - Math.pow(1 - k, 3)));
        if (k < 1) raf.current = requestAnimationFrame(step);
      };
      seen.current = true;
      raf.current = requestAnimationFrame(step);
    };
    if (seen.current || typeof IntersectionObserver === "undefined") {
      run();
      return () => cancelAnimationFrame(raf.current);
    }
    const o = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          o.disconnect();
          run();
        }
      },
      { threshold: 0.2 },
    );
    o.observe(el);
    return () => {
      o.disconnect();
      cancelAnimationFrame(raf.current);
    };
  }, [value, duration, booted]);

  // teks awal 0; nilai aslinya tetap kebaca pembaca layar lewat aria-label
  return <span ref={ref} className="count" aria-label={format(value)}>{format(0)}</span>;
}
