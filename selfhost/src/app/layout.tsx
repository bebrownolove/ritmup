import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ритм — дневник питания и привычек",
  description: "Простой дневник калорий, веса, серий и активности с друзьями.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
