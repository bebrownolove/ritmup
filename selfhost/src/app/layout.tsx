import type { Metadata, Viewport } from "next";
import { ServiceWorker } from "@/components/service-worker";
import "./globals.css";
import "./mobile.css";

export const metadata: Metadata = {
  title: "Ритм — дневник питания и привычек",
  description: "Простой дневник калорий, веса, серий и активности с друзьями.",
  applicationName: "Ритм",
  // black-translucent — единственный режим, при котором контент уходит под статус-бар.
  // При "default" iOS резервирует полоску сверху и красит её чёрным.
  appleWebApp: { capable: true, title: "Ритм", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  icons: { icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}<ServiceWorker /></body>
    </html>
  );
}
