"use client";
import { useState } from "react";

export default function Avatar({ name, url, large }: { name?: string | null; url?: string | null; large?: boolean }) {
  const [broken, setBroken] = useState(false);
  const cls = large ? " lg" : "";
  if (!name) return null;
  if (url && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={"avatar" + cls} src={url} alt="" loading="lazy" onError={() => setBroken(true)} />;
  }
  return <span className={"avatar-fallback" + cls}>{name.trim().charAt(0).toUpperCase() || "?"}</span>;
}
