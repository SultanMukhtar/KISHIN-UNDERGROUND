"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Reveal from "@/components/ui/Reveal";
import { useMotion } from "@/lib/motion";

/** Logo: cap merah kanji 地下 ("bawah tanah"). */
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span className={`brand-mark ${className}`} aria-hidden="true">
      <b>地</b>
      <b>下</b>
    </span>
  );
}

type NavProps = {
  status: "loading" | "live" | "error";
  /** jumlah fight yang lagi jalan */
  liveCount: number;
  sections: { id: string; label: string }[];
};

/** Bagian mana yang lagi dibaca: yang terakhir judulnya udah lewat sepertiga atas layar. */
function useActiveSection(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(null);
  const key = ids.join("|");
  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      const line = window.innerHeight * 0.34;
      let cur: string | null = null;
      for (const id of ids) {
        const el = document.querySelector<HTMLElement>(`[data-spy="${id}"]`);
        if (el && el.getBoundingClientRect().top <= line) cur = id;
      }
      setActive(cur);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(measure); };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return active;
}

export function SiteNav({ status, liveCount, sections }: NavProps) {
  const active = useActiveSection(sections.map((s) => s.id));
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const [bar, setBar] = useState<{ x: number; w: number } | null>(null);

  // garis merah geser ke link yang aktif
  useLayoutEffect(() => {
    const place = () => {
      const a = listRef.current?.querySelector<HTMLElement>('a[aria-current="true"]');
      setBar(a ? { x: a.offsetLeft, w: a.offsetWidth } : null);
    };
    place();
    window.addEventListener("resize", place);
    document.fonts?.ready.then(place).catch(() => {});
    return () => window.removeEventListener("resize", place);
  }, [active, sections.length]);

  // menu HP: Escape / klik di luar = tutup
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onDown = (e: PointerEvent) => { if (!navRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const live = status === "live" && liveCount > 0;
  const label = status === "error" ? "Koneksi putus" : status === "loading" ? "Nyambung…" : live ? "Live" : "Standby";

  return (
    <nav className={"site-nav" + (open ? " is-open" : "")} aria-label="Navigasi" ref={navRef}>
      <div className="wrap nav-inner">
        <a className="nav-brand" href="#top" onClick={() => setOpen(false)}>
          <BrandMark />
          <span className="nav-name">Underground</span>
        </a>
        <ul className="nav-links" ref={listRef}>
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} aria-current={active === s.id ? "true" : undefined}>{s.label}</a>
            </li>
          ))}
          <li className="nav-ind" aria-hidden="true" style={bar ? { transform: `translateX(${bar.x}px)`, width: bar.w, opacity: 1 } : undefined} />
        </ul>
        <p className={`nav-live is-${status}${live ? " is-on" : ""}`} role="status">
          <span className="live-dot" aria-hidden="true" />
          <span>
            {label}
            {live && <span className="nav-ago">{liveCount} fight di ring</span>}
          </span>
        </p>
        <button
          type="button"
          className="nav-burger"
          aria-expanded={open}
          aria-controls="nav-sheet"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="sr-only">{open ? "Tutup menu" : "Buka menu"}</span>
          <span className="nav-burger-bars" aria-hidden="true" />
        </button>
      </div>
      <div className="nav-sheet" id="nav-sheet" hidden={!open}>
        <ul className="wrap">
          {sections.map((s, i) => (
            <li key={s.id} style={{ "--i": i } as React.CSSProperties}>
              <a href={`#${s.id}`} aria-current={active === s.id ? "true" : undefined} onClick={() => setOpen(false)}>
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

export function SectionTitle({ id, children, aside }: { id?: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <Reveal className="sec-head" kind="up">
      <h2 className="sec-title" id={id}>{children}</h2>
      {aside && <p className="sec-aside">{aside}</p>}
    </Reveal>
  );
}

/** Rantai pembatas: goyang sekali waktu masuk layar, kilap logamnya jalan ngikutin scroll. */
export function ChainRule() {
  return (
    <Reveal className="chain-rule" kind="none" aria-hidden="true">
      <span className="chain-links" />
      <span className="chain-glint" />
    </Reveal>
  );
}

/** "barusan" / "12 detik lalu" / "3 menit lalu", di-refresh tiap 5 detik tanpa nge-render ulang seluruh halaman. */
function useAgo(at: number | null): string | null {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);
  if (at === null) return null;
  const s = Math.round((Date.now() - at) / 1000);
  return s < 5 ? "barusan" : s < 60 ? `${s} detik lalu` : `${Math.round(s / 60)} menit lalu`;
}

export function SiteFooter({ updatedAt }: { updatedAt: number | null }) {
  const ago = useAgo(updatedAt);
  const motion = useMotion();
  return (
    <footer className="site-foot">
      <ChainRule />
      <div className="wrap foot-inner">
        <Reveal as="p" className="foot-rule" kind="up">
          <span className="foot-rule-no">Aturan nomor satu</span>
          <span className="foot-rule-text">Guru gak boleh tahu.</span>
        </Reveal>
        <Reveal className="foot-side" kind="fade" delay={120}>
          <p className="foot-kanji" aria-hidden="true">武器禁止</p>
          <p className="foot-service">Event roleplay Kishin High School. Semua fight, taruhan, dan uang di halaman ini fiksi, pakai mata uang RP.</p>
          <p className="foot-credit">
            Halaman ini update sendiri, gak perlu di-refresh.{ago && <> Terakhir update {ago}.</>}
          </p>
          {motion.osReduced && (
            <p className="foot-credit">
              {motion.full
                ? "Animasi penuh lagi nyala, walau perangkatmu minta gerakan dikurangi. "
                : "Perangkatmu minta gerakan dikurangi, jadi halaman ini tampil versi kalem. "}
              <button type="button" className="link-btn" aria-pressed={motion.full} onClick={() => motion.setFull(!motion.full)}>
                {motion.full ? "Balik ke versi kalem" : "Nyalakan animasi penuh"}
              </button>
            </p>
          )}
          <p className="foot-credit"><a href="/admin">Masuk panel panitia</a></p>
        </Reveal>
      </div>
    </footer>
  );
}
