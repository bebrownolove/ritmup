import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import { ServiceWorker } from "@/components/service-worker";
import "./globals.css";
import "./mobile.css";
// Слой редизайна идёт последним и перекрывает прежние правила.
import "./design.css";

// Шрифт макета. next/font сам хостит файлы и снимает лишний запрос к Google.
const nunito = Nunito({ subsets: ["cyrillic", "latin"], weight: ["400","600","700","800","900"], display: "swap", variable: "--font-nunito" });

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
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#121713" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={nunito.variable}>
      <head>
        <script dangerouslySetInnerHTML={{__html:`try{const t=localStorage.getItem('ritm-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch{}`}}/>
      </head>
      <body>{children}<ServiceWorker /></body>
    </html>
  );
}
