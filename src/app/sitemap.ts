import type { MetadataRoute } from "next"

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const now = new Date()

  const routes = [
    "",
    "/events",
    "/calendar",
    "/news",
    "/login",
    "/register",
    "/legal/privacy",
    "/legal/terms",
  ]

  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: now,
    changeFrequency: route === "" || route === "/events" || route === "/news" ? "daily" : "weekly",
    priority: route === "" ? 1 : route === "/events" || route === "/news" ? 0.9 : 0.7,
  }))
}
