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
  ago: string | null;
  sections: { id: string; label: string }[];
};

export function SiteNav({ status, ago, sections }: NavProps) {
  return (
    <nav className="site-nav" aria-label="Navigasi">
      <div className="wrap nav-inner">
        <a className="nav-brand" href="#top">
          <BrandMark />
          <span className="nav-name">Underground</span>
        </a>
        <ul className="nav-links">
          {sections.map((s) => (
            <li key={s.id}><a href={`#${s.id}`}>{s.label}</a></li>
          ))}
        </ul>
        <p className={`nav-live is-${status}`}>
          <span className="live-dot" aria-hidden="true" />
          <span>
            {status === "live" ? "Live" : status === "error" ? "Koneksi putus" : "Nyambung…"}
            {status === "live" && ago && <span className="nav-ago">update {ago}</span>}
          </span>
        </p>
      </div>
    </nav>
  );
}

export function SectionTitle({ id, children, aside }: { id?: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="sec-head">
      <h2 className="sec-title" id={id}>{children}</h2>
      {aside && <p className="sec-aside">{aside}</p>}
    </div>
  );
}

export function ChainRule() {
  return <div className="chain-rule" aria-hidden="true" />;
}

export function SiteFooter() {
  return (
    <footer className="site-foot">
      <ChainRule />
      <div className="wrap foot-inner">
        <p className="foot-rule">
          <span className="foot-rule-no">Aturan nomor satu</span>
          <span className="foot-rule-text">Guru gak boleh tahu.</span>
        </p>
        <div className="foot-side">
          <p className="foot-kanji" aria-hidden="true">武器禁止</p>
          <p className="foot-service">Lokasi dan jadwal cuma dikasih tahu dari mulut ke mulut. Jangan sebar link ini sembarangan.</p>
          <p className="foot-credit">Halaman ini update sendiri, gak perlu di-refresh.</p>
        </div>
      </div>
    </footer>
  );
}
