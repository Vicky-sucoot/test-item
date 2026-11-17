import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "公股銀行考題練習",
  description: "會計學、貨幣銀行學、票據法、銀行法分科練習（本機個人使用）",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

const NAV = [
  { href: "/", label: "首頁" },
  { href: "/questions", label: "題庫" },
  { href: "/review", label: "錯題・收藏" },
  { href: "/stats", label: "統計" },
  { href: "/admin", label: "管理" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant-TW">
      <body className="min-h-screen">
        <header className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur" style={{ borderColor: "var(--line)" }}>
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
            <Link href="/" className="shrink-0 font-bold" style={{ color: "var(--brand)" }}>
              公股銀行考題練習
            </Link>
            <nav className="-mx-1 flex flex-1 gap-1 overflow-x-auto text-sm">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="shrink-0 rounded-md px-2.5 py-1.5 hover:bg-slate-100">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-5">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs muted">
          本系統僅供個人本機練習使用。示範題為自編，非歷屆真題；示範題答案為自編參考答案，非官方答案。
        </footer>
      </body>
    </html>
  );
}
