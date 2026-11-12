import type { Metadata, Viewport } from "next";
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/big-shoulders-stencil/opsz.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Underground",
  description: "Fight club rahasia. Bracket, hasil, dan meja taruhan, update langsung.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0A0A0A", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
