"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f4efe4] px-6 py-16 text-[#171717]">
        <main className="mx-auto max-w-2xl border-y-4 border-[#1e1e20] py-10">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#425574]">
            Joe Barr Memorial Pick&apos;em
          </p>
          <h1 className="mt-3 font-serif text-4xl font-black">Something went wrong</h1>
          <p className="mt-4 text-lg leading-7 text-[#324564]">
            Your records have not been changed. Try loading the page again; the
            Commissioner has been notified if this keeps happening.
          </p>
          <button
            className="mt-8 bg-[#1e1e20] px-6 py-4 text-lg font-black text-white"
            onClick={reset}
            type="button"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
