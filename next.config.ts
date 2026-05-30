import type { NextConfig } from "next";

type ImageRemotePattern = NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]>[number];

const isDev = process.env.NODE_ENV !== "production";

// Only allow the Next.js image optimizer to fetch from Supabase Storage.
// A wildcard host ("**") turns the optimizer into an open image proxy that
// any visitor can point at arbitrary URLs, burning bandwidth/optimization quota.
function resolveImageRemotePatterns(): ImageRemotePattern[] {
  const patterns: ImageRemotePattern[] = [{ protocol: "https", hostname: "*.supabase.co" }];
  const rawSupabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();

  if (rawSupabaseUrl) {
    try {
      const { hostname } = new URL(rawSupabaseUrl);
      if (hostname && !hostname.endsWith(".supabase.co")) {
        patterns.push({ protocol: "https", hostname });
      }
    } catch {
      // Ignore malformed Supabase URLs; the *.supabase.co pattern still applies.
    }
  }

  return patterns;
}

const nextConfig: NextConfig = {
  distDir: isDev ? ".next-dev" : ".next",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY"
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff"
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin"
          }
        ]
      }
    ];
  },
  images: {
    remotePatterns: resolveImageRemotePatterns()
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false
    };

    return config;
  }
};

export default nextConfig;
