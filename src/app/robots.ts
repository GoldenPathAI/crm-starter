import type { MetadataRoute } from "next"

// Interní nástroj, nikdy se neindexuje - na žádném hostu.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  }
}
