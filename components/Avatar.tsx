"use client";
import Mugshot from "@/components/ui/Mugshot";

/** Foto kecil fighter di panel admin (gaya fotokopi yang sama kayak halaman penonton). */
export default function Avatar({ name, url, large }: { name?: string | null; url?: string | null; large?: boolean }) {
  if (!name) return null;
  return <Mugshot name={name} url={url} size={large ? "md" : "sm"} />;
}
