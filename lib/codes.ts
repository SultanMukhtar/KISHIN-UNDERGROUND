/** Hash string → angka 32-bit (FNV-1a). Dipakai biar efek "acak" (sobekan, miring) selalu sama per data. */
export function hash(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Random deterministik (mulberry32) dari seed. */
export function rng(seed: string | number) {
  let s = typeof seed === "number" ? seed >>> 0 : hash(seed);
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Kode ID fighter ala kartu anggota, misal UG-3A9C. */
export const fighterCode = (id: string | null | undefined) =>
  id ? "UG-" + id.replace(/-/g, "").slice(0, 4).toUpperCase() : "UG-????";

export const pad2 = (n: number) => String(n).padStart(2, "0");

/** Kelipatan taruhan format Indonesia: 1,25 */
export const times = (n: number | null) =>
  n === null ? "–" : "x" + n.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * clip-path polygon dengan pinggiran sobek. amp = kedalaman sobekan (px).
 * Hasilnya deterministik per seed, jadi poster gak "goyang" tiap render.
 */
export function tornClip(
  seed: string,
  edges: { top?: boolean; bottom?: boolean; left?: boolean; right?: boolean } = { top: true, bottom: true },
  amp = 7,
  steps = 26,
): string {
  const r = rng(seed);
  const pts: string[] = [];
  const j = () => (r() * amp).toFixed(1);
  // atas: kiri → kanan
  for (let i = 0; i <= steps; i++) {
    const x = ((i / steps) * 100).toFixed(2);
    pts.push(`${x}% ${edges.top ? j() : 0}px`);
  }
  // kanan: atas → bawah
  if (edges.right) for (let i = 1; i < steps; i++) pts.push(`calc(100% - ${j()}px) ${((i / steps) * 100).toFixed(2)}%`);
  // bawah: kanan → kiri
  for (let i = steps; i >= 0; i--) {
    const x = ((i / steps) * 100).toFixed(2);
    pts.push(`${x}% ${edges.bottom ? `calc(100% - ${j()}px)` : "100%"}`);
  }
  // kiri: bawah → atas
  if (edges.left) for (let i = steps - 1; i > 0; i--) pts.push(`${j()}px ${((i / steps) * 100).toFixed(2)}%`);
  return `polygon(${pts.join(",")})`;
}

/** Miring kecil deterministik, misal -1.4 .. 1.4 derajat. */
export const tilt = (seed: string, max = 1.4) => +((rng(seed)() * 2 - 1) * max).toFixed(2);
