import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "함께가정", template: "%s | 함께가정" },
  description: "생활 속 양성평등 함께 잇다 — 함께가정 사전·사후 진단",
  icons: { icon: "/assets/seo-gu-symbol.png" },
  openGraph: {
    type: "website",
    title: "함께가정",
    description: "함께 나누고, 함께 쉬는 우리 가족의 30일",
    images: [{ url: "/og.png", width: 1536, height: 1024 }],
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#176b55" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
