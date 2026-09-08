import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sigmasec.ai";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/privacy", "/terms", "/security", "/contact", "/login", "/signup"],
        disallow: ["/api/", "/admin/", "/settings/", "/scans/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
