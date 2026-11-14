"use client";
import { useEffect, useState } from "react";

/** Pilihan pengunjung: "full" = tetap animasi penuh walau perangkatnya minta gerakan dikurangi. Disimpan di localStorage. */
export const MOTION_KEY = "ug-motion";

/**
 * Lagi di versi kalem? (class "calm" di <html>)
 * Dipasang script kecil di app/layout.tsx sebelum halaman digambar: perangkat minta gerakan dikurangi
 * DAN pengunjung belum milih animasi penuh. Di versi kalem semua gerak diganti pudar pelan (lihat underground.css).
 */
export function isCalm(): boolean {
  return typeof document !== "undefined" && document.documentElement.classList.contains("calm");
}

/** Buat tombol di footer: tahu setelan perangkat, dan bisa ganti antara versi kalem & animasi penuh. */
export function useMotion() {
  const [osReduced, setOsReduced] = useState(false);
  const [full, setFullState] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => {
      let f = false;
      try { f = localStorage.getItem(MOTION_KEY) === "full"; } catch {}
      setOsReduced(mq.matches);
      setFullState(f);
      document.documentElement.classList.toggle("calm", mq.matches && !f);
    };
    read();
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, []);

  const setFull = (v: boolean) => {
    try {
      if (v) localStorage.setItem(MOTION_KEY, "full");
      else localStorage.removeItem(MOTION_KEY);
    } catch {}
    setFullState(v);
    document.documentElement.classList.toggle("calm", osReduced && !v);
  };

  return { osReduced, full, setFull };
}
