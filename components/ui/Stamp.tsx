type Props = {
  children: React.ReactNode;
  /** red = tinta merah, ink = tinta hitam (di kertas), bone = cat putih (di tembok), seal = hanko merah penuh */
  tone?: "red" | "ink" | "bone" | "seal";
  tilt?: number;
  className?: string;
  /** animasi "dicap" sekali waktu muncul */
  slam?: boolean;
};

/** Cap/stempel tinta yang agak luntur. */
export default function Stamp({ children, tone = "red", tilt = -6, className = "", slam = false }: Props) {
  return (
    <span
      className={`stamp stamp-${tone}${slam ? " stamp-slam" : ""} ${className}`}
      style={{ "--tilt": `${tilt}deg` } as React.CSSProperties}
    >
      {children}
    </span>
  );
}
