"use client";
import { useState } from "react";

type Props = {
  name?: string | null;
  url?: string | null;
  /** xs 28px, sm 40px, md 64px, lg/xl ngikutin wadahnya */
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** "print" = dicetak di kertas poster (multiply), "wall" = ditempel di tembok gelap */
  surface?: "wall" | "print";
  /** isi kalau gak ada foto: siluet orang (bawaan buat lg/xl) atau huruf depan nama (bawaan buat ukuran kecil) */
  empty?: "ghost" | "initial";
  className?: string;
};

/** Foto fighter versi fotokopi: hitam putih kontras tinggi, raster halftone, grain. */
export default function Mugshot({ name, url, size = "sm", surface = "wall", empty, className = "" }: Props) {
  const [broken, setBroken] = useState(false);
  const initial = (name ?? "?").trim().charAt(0).toUpperCase() || "?";
  const ghost = empty ? empty === "ghost" : size === "lg" || size === "xl";
  return (
    <span className={`mug mug-${size} mug-${surface} ${className}`}>
      {url && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} />
      ) : ghost ? (
        <span className="mug-empty mug-ghost" aria-hidden="true">
          <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMax meet">
            <path d="M50 14c11 0 19 9 19 21 0 9-4 16-10 20l1 4c15 3 27 10 31 25l2 16H7l2-16c4-15 16-22 31-25l1-4c-6-4-10-11-10-20 0-12 8-21 19-21z" />
          </svg>
          <b>?</b>
        </span>
      ) : (
        <span className="mug-empty" aria-hidden="true">{initial}</span>
      )}
    </span>
  );
}
