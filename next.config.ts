import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

function configuredSupabaseSources() {
  try {
    const configuredUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    const websocketProtocol = configuredUrl.protocol === "https:" ? "wss:" : "ws:";

    return {
      http: configuredUrl.origin,
      websocket: `${websocketProtocol}//${configuredUrl.host}`,
    };
  } catch {
    // Builds without runtime configuration cannot serve the app, but retaining
    // Supabase's hosted wildcard keeps their generated policy syntactically valid.
    return {
      http: "https://*.supabase.co",
      websocket: "wss://*.supabase.co",
    };
  }
}

const supabaseSources = configuredSupabaseSources();

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseSources.http}`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseSources.http} ${supabaseSources.websocket} https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://vitals.vercel-insights.com`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Browser rehearsals run beside a normal local server. Give that temporary
  // server its own build directory so Next never contends for .next/dev.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  // The screenshot suite serves images as they are: the on-demand resizer builds each
  // logo the first time it is asked for and can stall pages under load. Never set in production.
  ...(process.env.NEXT_IMAGE_UNOPTIMIZED === "1" ? { images: { unoptimized: true } } : {}),
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), geolocation=(), microphone=()",
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  widenClientFileUpload: true,
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
});
