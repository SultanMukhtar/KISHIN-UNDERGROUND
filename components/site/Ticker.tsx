export type TickerItem = { kind: "live" | "next" | "result" | "idle"; text: string };

/**
 * Pita info fight yang jalan terus ke kiri.
 * Isinya dari status match yang beneran; gak ada fight aktif = pesan "NO ACTIVE MATCH".
 * Teksnya juga ada versi diam buat pembaca layar dan buat yang minta gerakan dikurangi.
 */
export default function Ticker({ items }: { items: TickerItem[] }) {
  const chars = items.reduce((n, it) => n + it.text.length + 6, 0);
  // satu "putaran" minimal ±260 karakter biar pitanya gak pernah kosong di layar lebar
  const repeat = Math.max(1, Math.ceil(260 / Math.max(chars, 1)));
  const lap = Array.from({ length: repeat }, () => items).flat();
  const live = items.some((it) => it.kind === "live");

  const run = (hidden: boolean) => (
    <ul className="ticker-lap" aria-hidden={hidden || undefined}>
      {lap.map((it, i) => (
        <li key={i} className={`tick is-${it.kind}`}>
          {it.kind === "live" && <span className="live-dot" />}
          {it.text}
        </li>
      ))}
    </ul>
  );

  return (
    <div className={"ticker" + (live ? " is-live" : "")} style={{ "--dur": `${Math.max(18, Math.round(chars * repeat * 0.17))}s` } as React.CSSProperties}>
      <p className="sr-only" role="status" aria-live="polite">{items.map((it) => it.text.replace(/\.$/, "")).join(". ")}.</p>
      <div className="ticker-track" aria-hidden="true">
        {run(false)}
        {run(true)}
      </div>
    </div>
  );
}
