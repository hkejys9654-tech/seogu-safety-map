import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://haeoni-banban-family.jimmmmay.chatgpt.site"),
  title: { default: "함께가정", template: "%s | 함께가정" },
  description: "생활 속 양성평등 함께 잇다 — 함께가정 사전·사후 진단",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/assets/haeoni-app-icon-192.png",
    shortcut: "/assets/haeoni-app-icon-192.png",
    apple: "/assets/haeoni-app-icon-512.png",
  },
  openGraph: {
    type: "website",
    url: "/",
    title: "함께가정",
    description: "함께 나누고, 함께 쉬는 우리 가족의 30일",
    images: [{ url: "/og-polished.png", width: 1536, height: 1024 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "함께가정",
    description: "함께 나누고, 함께 쉬는 우리 가족의 30일",
    images: ["/og-polished.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#176b55",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
