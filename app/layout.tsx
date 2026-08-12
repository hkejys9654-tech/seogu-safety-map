import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const description = "집안일도 마음도 반반하게 나누는 광주광역시 서구 가족실천 워크북";
  return {
    title: { default: "반반한 가정", template: "%s | 반반한 가정" },
    description,
    icons: { icon: "/assets/seo-gu-symbol.png", shortcut: "/assets/seo-gu-symbol.png" },
    openGraph: {
      type: "website",
      url: origin,
      title: "반반한 가정 | 우리집 워크북",
      description,
      images: [{ url: `${origin}/og.png`, width: 1536, height: 1024, alt: "집안일도 마음도 반반하게, 반반한 가정" }],
    },
    twitter: { card: "summary_large_image", title: "반반한 가정 | 우리집 워크북", description, images: [`${origin}/og.png`] },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f5ca8",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
