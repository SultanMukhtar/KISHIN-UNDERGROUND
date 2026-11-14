import type { Metadata, Viewport } from "next";
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/big-shoulders-stencil/opsz.css";
import "./globals.css";
import "./underground.css";

export const metadata: Metadata = {
  title: "Underground",
  description: "Fight club rahasia. Bracket, hasil, arsip fight, dan meja taruhan, update langsung.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0A0A0A", colorScheme: "dark" };

// Jalan sebelum halaman digambar (tanpa kedip):
// - class "calm": perangkat minta gerakan dikurangi dan pengunjung belum milih animasi penuh → gerak diganti pudar pelan
// - data-boot="skip": layar pembuka udah pernah tampil di tab ini → gak ditampilin lagi
const prePaint = `try{var d=document.documentElement;if(matchMedia("(prefers-reduced-motion: reduce)").matches&&localStorage.getItem("ug-motion")!=="full")d.classList.add("calm");if(sessionStorage.getItem("ug-boot")==="1")d.dataset.boot="skip"}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: prePaint }} />
        <noscript>
          <style>{".boot{display:none}"}</style>
        </noscript>
      </head>
      <body>
        <noscript>
          <p className="alert" style={{ margin: 24 }}>Halaman ini butuh JavaScript buat ngambil data fight. Nyalain JavaScript di browser, lalu muat ulang.</p>
        </noscript>
        {children}
      </body>
    </html>
  );
}
