import type { Metadata, Viewport } from "next";
import { Playfair_Display, Space_Grotesk } from "next/font/google";
import { AppToaster } from "@/components/AppToaster";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-space-grotesk",
  display: "swap"
});

const playfairDisplay = Playfair_Display({
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["400", "700", "800"],
  variable: "--font-playfair-display",
  display: "swap"
});

export const metadata: Metadata = {
  metadataBase: new URL("https://pastello.io"),
  title: {
    default: "pastello.io — AI генератор Instagram каруселей",
    template: "%s · pastello.io"
  },
  description: "AI генератор Instagram каруселей: структура, текст, редактор и экспорт PNG из одного промпта.",
  openGraph: {
    title: "pastello.io — AI генератор Instagram каруселей",
    description: "Один промпт превращается в готовую структуру, текст и карточки для экспертного контента.",
    url: "/",
    siteName: "pastello.io",
    locale: "ru_RU",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1800,
        height: 942,
        alt: "pastello.io — AI генератор Instagram каруселей"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "pastello.io — AI генератор Instagram каруселей",
    description: "Один промпт превращается в готовую структуру, текст и карточки.",
    images: ["/og-image.png"]
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" }
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`${spaceGrotesk.variable} ${playfairDisplay.variable}`}>
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
