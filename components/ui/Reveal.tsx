"use client";
import { createElement, useEffect, useRef } from "react";

let io: IntersectionObserver | null = null;
function observer(): IntersectionObserver {
  if (!io) {
    io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          (e.target as HTMLElement).dataset.in = "1";
          io!.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -7% 0px", threshold: 0.01 },
    );
  }
  return io;
}

type Props = {
  as?: "div" | "section" | "li" | "article" | "ol" | "ul" | "p" | "span" | "header" | "footer";
  /** arah masuk. "none" = cuma nandain data-in (geraknya diatur CSS komponen itu sendiri) */
  kind?: "up" | "left" | "right" | "scale" | "fade" | "none";
  /** jeda (ms) buat masuk berurutan */
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLElement>, "className" | "style" | "children">;

/**
 * Elemen masuk sekali waktu pertama kelihatan di layar.
 * Cuma nambah atribut data-in; geraknya (transform + opacity) semua di CSS,
 * jadi pengaturan "kurangi gerakan" cukup dihormati di satu tempat.
 */
export default function Reveal({ as = "div", kind = "up", delay = 0, className = "", style, children, ...rest }: Props) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      el.dataset.in = "1";
      return;
    }
    const o = observer();
    o.observe(el);
    return () => o.unobserve(el);
  }, []);
  return createElement(
    as,
    { ref, className: `rv rv-${kind} ${className}`.trim(), style: { ...style, "--d": `${delay}ms` } as React.CSSProperties, ...rest },
    children,
  );
}
