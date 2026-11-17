import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "公股銀行考題練習",
    short_name: "考題練習",
    description: "會計學、貨幣銀行學、票據法、銀行法分科練習與限時模擬考（個人本機使用）",
    lang: "zh-Hant-TW",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f7f9",
    theme_color: "#1f5f8b",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "題庫", url: "/questions" },
      { name: "模擬考", url: "/exam" },
      { name: "錯題複習", url: "/review" },
    ],
  };
}
