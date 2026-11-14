"use client";
import { useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/site/SiteChrome";
import { isCalm } from "@/lib/motion";

/** Tanda "udah pernah lihat layar pembuka" (per tab). Dibaca juga sama script kecil di app/layout.tsx. */
export const BOOT_KEY = "ug-boot";

const MIN_MS = 1250; // paling cepat: biar urutannya kebaca
const MIN_CALM_MS = 800; // versi kalem: lebih singkat, tanpa pintu geser
const MAX_MS = 2600; // paling lama: kalau data belum masuk juga, halaman tetap dibuka

type Phase = "init" | "online" | "open" | "gone";

/**
 * Layar pembuka: hitam → logo → INITIALIZING FIGHT SYSTEM... → garis merah jalan → SYSTEM ONLINE → pintu kebuka.
 * Garis merahnya nunggu data beneran masuk (`ready`), bukan animasi kosong.
 * Cuma muncul sekali per tab. Di versi kalem pintunya gak geser, cuma memudar.
 */
export default function Loader({ ready, onOpen }: { ready: boolean; onOpen: () => void }) {
  const [phase, setPhase] = useState<Phase>("init");
  const started = useRef(0);
  const opened = useRef(false);
  const open = useRef(onOpen);
  open.current = onOpen;

  // lewati kalau udah pernah tampil di tab ini
  useEffect(() => {
    started.current = performance.now();
    let seen = false;
    try { seen = sessionStorage.getItem(BOOT_KEY) === "1"; } catch {}
    if (seen) {
      opened.current = true;
      open.current();
      setPhase("gone");
    }
  }, []);

  useEffect(() => {
    if (phase !== "init" || opened.current) return;
    const elapsed = performance.now() - started.current;
    const wait = ready ? Math.max(0, (isCalm() ? MIN_CALM_MS : MIN_MS) - elapsed) : Math.max(0, MAX_MS - elapsed);
    const t = setTimeout(() => setPhase("online"), wait);
    return () => clearTimeout(t);
  }, [ready, phase]);

  useEffect(() => {
    if (phase === "online") {
      const t = setTimeout(() => {
        opened.current = true;
        try { sessionStorage.setItem(BOOT_KEY, "1"); } catch {}
        open.current(); // hero mulai masuk bareng pintunya kebuka
        setPhase("open");
      }, 420);
      return () => clearTimeout(t);
    }
    if (phase === "open") {
      const t = setTimeout(() => setPhase("gone"), 700);
      return () => clearTimeout(t);
    }
  }, [phase]);

  if (phase === "gone") return null;
  const online = phase !== "init";

  return (
    <div className={`boot is-${phase}`} role="status" aria-live="polite">
      <span className="boot-door boot-door-a" aria-hidden="true" />
      <span className="boot-door boot-door-b" aria-hidden="true" />
      <div className="boot-core">
        <p className="boot-logo">
          <BrandMark />
          <span>Underground</span>
        </p>
        <p className="boot-line">{online ? "System online" : "Initializing fight system..."}</p>
        <span className="boot-bar" aria-hidden="true"><i /></span>
        <p className="boot-meta" aria-hidden="true">
          <span>KHS / B1</span>
          <span>{online ? "Akses dibuka" : "Ngecek data fight"}</span>
        </p>
      </div>
    </div>
  );
}
