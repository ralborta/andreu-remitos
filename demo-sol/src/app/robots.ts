import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/demo", "/demo/r/", "/demo/stitch-screens/"],
      disallow: ["/demo/admin", "/demo/api/admin"],
    },
  };
}
