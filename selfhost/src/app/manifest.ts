import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    // id закрепляет приложение за этой записью: без него смена start_url
    // заставит Android считать Ритм новым приложением и поставить второй ярлык.
    id: "/",
    name: "Ритм — питание и привычки",
    short_name: "Ритм",
    description: "Простой дневник калорий, веса, серий и активности с друзьями.",
    lang: "ru",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // minimal-ui — запасной режим для браузеров без standalone,
    // browser гарантирует, что приложение хотя бы откроется.
    display_override: ["standalone", "minimal-ui", "browser"],
    orientation: "portrait",
    background_color: "#f5f1e7",
    // Цвет строки состояния на Android. Должен совпадать с фоном приложения,
    // иначе сверху остаётся чужая белая полоса.
    theme_color: "#f5f1e7",
    categories: ["health", "fitness", "lifestyle"],
    prefer_related_applications: false,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Скриншоты включают на Android развёрнутое окно установки вместо
    // короткого «Добавить на главный экран».
    screenshots: [
      { src: "/screenshot-today.png", sizes: "540x1080", type: "image/png", form_factor: "narrow", label: "Дневник дня" },
      { src: "/screenshot-stats.png", sizes: "540x1080", type: "image/png", form_factor: "narrow", label: "Статистика" },
      { src: "/screenshot-friends.png", sizes: "540x1080", type: "image/png", form_factor: "narrow", label: "Друзья и рейтинг" },
      { src: "/screenshot-wide.png", sizes: "1280x800", type: "image/png", form_factor: "wide", label: "Ритм на компьютере" },
    ],
    // Долгое нажатие по ярлыку на Android открывает эти пункты.
    shortcuts: [
      { name: "Записать еду", short_name: "Еда", url: "/?tab=today&add=food", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Статистика", short_name: "Статистика", url: "/?tab=stats", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Друзья", short_name: "Друзья", url: "/?tab=friends", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
