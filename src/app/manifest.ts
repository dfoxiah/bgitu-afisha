import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "БГИТУ Афиша",
    short_name: "БГИТУ Афиша",
    description: "Календарь и новости мероприятий кампуса БГИТУ",
    start_url: "/",
    display: "standalone",
    background_color: "#edf2fa",
    theme_color: "#2458c6",
    lang: "ru",
    icons: [
      {
        src: "/favicon.svg",
        type: "image/svg+xml",
        sizes: "any",
      },
      {
        src: "/favicon.ico",
        type: "image/x-icon",
        sizes: "48x48",
      },
    ],
  }
}
