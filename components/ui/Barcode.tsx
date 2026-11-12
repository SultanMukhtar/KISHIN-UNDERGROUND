import { rng } from "@/lib/codes";

/** Barcode dekoratif (deterministik dari value). */
export default function Barcode({ value, height = 28, className = "" }: { value: string; height?: number; className?: string }) {
  const r = rng("bar:" + value);
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  for (let i = 0; i < 30; i++) {
    const w = 1 + Math.floor(r() * 3);
    if (i % 2 === 0) bars.push({ x, w });
    x += w + (r() < 0.3 ? 1 : 0);
  }
  return (
    <svg className={`barcode ${className}`} viewBox={`0 0 ${x} ${height}`} width={x * 1.6} height={height} aria-hidden="true" preserveAspectRatio="none">
      {bars.map((b, i) => <rect key={i} x={b.x} y={0} width={b.w} height={height} fill="currentColor" />)}
    </svg>
  );
}
