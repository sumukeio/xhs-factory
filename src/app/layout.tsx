// 1. 必须首先引入全局样式，否则 Tailwind 不生效
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "XHS Factory",
  description: "小红书爆款工厂控制台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    /* 2. 必须包含 html 标签 */
    <html lang="zh-CN">
      {/* 3. 必须包含 body 标签 */}
      <body className="antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}