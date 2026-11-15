/**
 * Logo UNDERGROUND versi stiker: tinta hitam, isian kertas, pinggiran kertas (kebaca di tembok gelap).
 * Selalu dekorasi: nama "Underground" udah ada sebagai teks di sebelahnya / di judul halaman.
 * Ukuran kecil (160) pakai pinggiran lebih tebal + tinta dibersihin, biar tetap jelas di menu.
 */
const SRC = "/brand/underground-sticker-640.webp";
const SRCSET = "/brand/underground-sticker-160.webp 160w, /brand/underground-sticker-320.webp 320w, /brand/underground-sticker-640.webp 640w";

export default function Logo({ className = "", sizes = "160px", priority = false }: {
  className?: string;
  /** lebar tampil, buat milih file yang pas (atribut sizes) */
  sizes?: string;
  /** tampil paling atas / layar pembuka: muat duluan */
  priority?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={`logo ${className}`.trim()}
      src={SRC}
      srcSet={SRCSET}
      sizes={sizes}
      width={640}
      height={640}
      alt=""
      decoding="async"
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      draggable={false}
    />
  );
}

/** Logo versi tinta aja (transparan), buat dicetak di permukaan kertas. */
export function InkLogo({ className = "" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={`logo-ink ${className}`.trim()} src="/brand/underground-ink-256.webp" width={256} height={256} alt="" loading="lazy" decoding="async" draggable={false} />
  );
}
