import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-cairo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "دفتر النقطة والواجب — النظام الرقمي الذكي",
  description: "نظام إدارة واستعلام نقطة الأفراح والواجبات والمناسبات في مصر مع التسجيل الصوتي الفوري",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} h-full bg-[#090d16]`} suppressHydrationWarning>
      <body className={`${cairo.className} min-h-full flex flex-col antialiased text-[#f8fafc] bg-[#090d16]`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
