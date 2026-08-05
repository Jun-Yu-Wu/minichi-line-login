import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  description: "使用 LINE Login 連結小日辰顧客身分。",
  title: "小日辰官方Line綁定｜MINICHI",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>
        <div className="min-h-dvh">{children}</div>
      </body>
    </html>
  );
}
