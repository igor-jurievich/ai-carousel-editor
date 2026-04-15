import type { Metadata, Viewport } from "next";
import { Playfair_Display, Space_Grotesk } from "next/font/google";
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
  title: "Помощник эксперта",
  description: "Приложение Vorobev Studio для генерации и редактирования каруселей для соцсетей."
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
      <body className={`${spaceGrotesk.variable} ${playfairDisplay.variable}`}>{children}</body>
    </html>
  );
}
