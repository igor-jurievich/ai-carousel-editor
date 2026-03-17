import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Помощник эксперта",
  description: "Приложение Vorobev Studio для генерации и редактирования каруселей для соцсетей."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
