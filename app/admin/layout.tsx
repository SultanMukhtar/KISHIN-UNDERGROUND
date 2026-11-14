import type { Metadata } from "next";
import "./admin.css";

export const metadata: Metadata = {
  title: "Panel panitia Underground",
  robots: { index: false, follow: false },
};

/** Panel panitia: gaya khusus panel dimuat di sini, jadi halaman penonton gak ikut nanggung. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
