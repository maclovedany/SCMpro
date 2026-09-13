import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
export const metadata: Metadata = { title: "SCMpro", description: "복합기 수요예측 · 월간 발주 시스템" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased"><Providers>{children}</Providers></body>
    </html>
  );
}
