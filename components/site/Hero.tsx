import FitLines, { narrowTitle, splitTitle } from "@/components/ui/FitLines";
import Stamp from "@/components/ui/Stamp";
import Mugshot from "@/components/ui/Mugshot";
import CountUp from "@/components/ui/CountUp";
import { tornClip } from "@/lib/codes";
import { yen } from "@/lib/betting";

type Props = {
  eventName: string;
  tagline?: string | null;
  heroUrl?: string | null;
  /** null = data belum masuk (tampil "–", bukan angka palsu) */
  stats: { fighters: number; done: number; total: number; live: number; pool: number } | null;
};

export default function Hero({ eventName, tagline, heroUrl, stats }: Props) {
  const lines = splitTitle(eventName);
  return (
    <header className="hero" id="top">
      <div className="hero-wall" aria-hidden="true" />
      <div className="hero-fence" aria-hidden="true" />
      <div className="hero-smoke" aria-hidden="true" />
      <div className="hero-smoke is-b" aria-hidden="true" />
      <Lamp />
      <div className="hero-beam" aria-hidden="true" />

      <div className="wrap hero-inner">
        <div className="hero-title">
          <h1 className="sr-only">{eventName}</h1>
          <FitLines lines={lines} max={lines.length > 1 ? 210 : 300} className="hero-type is-wide" />
          <FitLines lines={narrowTitle(lines)} max={210} className="hero-type is-narrow" />
        </div>

        <aside className="hero-flyer" style={{ clipPath: tornClip("hero-flyer", { top: true, bottom: true, right: true }, 6) }}>
          <span className="tape tape-a" aria-hidden="true" />
          <Stamp tone="red" tilt={9} className="flyer-stamp">
            <span className="jp">素手のみ</span>
            <span className="stamp-sub">Tangan kosong</span>
          </Stamp>
          {heroUrl && <Mugshot url={heroUrl} name={eventName} size="xl" surface="print" className="hero-photo" />}
          <div className="flyer-rules">
            <p className="flyer-head">Aturan main</p>
            <ol>
              <li>Satu lawan satu</li>
              <li>Tangan kosong, senjata dilarang</li>
              <li>Selesai kalau ada yang KO</li>
              <li>Keputusan wasit final</li>
            </ol>
            <a className="flyer-more" href="#aturan">Baca semua aturan</a>
          </div>
        </aside>

        <p className="hero-kanji" aria-hidden="true">地下格闘</p>

        {tagline && <p className="hero-tag">{tagline}</p>}

        <dl className="hero-tally">
          <div>
            <dt>Fighter</dt>
            <dd>{stats ? <CountUp value={stats.fighters} /> : "–"}</dd>
          </div>
          <div>
            <dt>Fight selesai</dt>
            <dd>
              {stats ? <CountUp value={stats.done} /> : "–"}
              <small>/{stats?.total || "–"}</small>
            </dd>
          </div>
          <div className={stats?.live ? "is-live" : undefined}>
            <dt>Lagi di ring</dt>
            <dd>{stats ? <CountUp value={stats.live} /> : "–"}</dd>
          </div>
          <div>
            <dt>Total taruhan, mata uang RP</dt>
            <dd>{stats ? <CountUp value={stats.pool} format={yen} duration={1200} /> : "–"}</dd>
          </div>
        </dl>
      </div>
    </header>
  );
}

function Lamp() {
  return (
    <svg className="hero-lamp" viewBox="0 0 120 150" aria-hidden="true">
      <defs>
        <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#141312" />
          <stop offset=".45" stopColor="#4a4741" />
          <stop offset=".6" stopColor="#2a2825" />
          <stop offset="1" stopColor="#0f0e0d" />
        </linearGradient>
        <radialGradient id="bulb" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset=".45" stopColor="#efe6d2" />
          <stop offset="1" stopColor="#efe6d2" stopOpacity="0" />
        </radialGradient>
      </defs>
      <line x1="60" y1="0" x2="60" y2="62" stroke="#2c2a27" strokeWidth="2.5" />
      <rect x="54" y="58" width="12" height="14" fill="#1d1c1a" />
      <path d="M60 70 C30 72 14 96 8 118 L112 118 C106 96 90 72 60 70Z" fill="url(#shade)" />
      <path d="M8 118 L112 118" stroke="#6d6860" strokeWidth="2" />
      <ellipse className="lamp-bulb" cx="60" cy="121" rx="22" ry="12" fill="url(#bulb)" />
    </svg>
  );
}
