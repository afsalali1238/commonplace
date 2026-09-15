import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { SITE_URL } from "@/lib/site";
import { BottomNav } from "@/components/BottomNav";
import { useOfflineWarmup } from "@/hooks/useOfflineWarmup";
import { useThemeSync } from "@/hooks/useThemeSync";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">404</p>
        <h1 className="mt-3 font-serif text-4xl text-ink">Not in the lattice</h1>
        <p className="mt-3 text-sm text-ink-soft">
          This idea isn't wired up. Head back to the feed and follow another thread.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center border border-ink px-5 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-ink hover:bg-ink hover:text-paper"
        >
          Back to feed
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-2xl text-ink">Something didn't load</h1>
        <p className="mt-2 text-sm text-ink-soft">Try again, or head home.</p>
        <div className="mt-5 flex justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="border border-ink bg-ink px-4 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-paper"
          >
            Try again
          </button>
          <a
            href="/"
            className="border border-ink px-4 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-ink"
          >
            Home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      // Matches manifest.webmanifest's theme_color - was mismatched (paper
      // background here vs. accent everywhere else), so PWA chrome tinting
      // differed depending on whether a browser read this tag or the
      // manifest.
      { name: "theme-color", content: "#fcfbf9" },
      { title: "Commonplace — A latticework of powerful ideas" },
      {
        name: "description",
        content:
          "An audio-narrated, cross-linked map of the world's most powerful ideas. Learn in layers. Retain with spaced repetition.",
      },
      { property: "og:title", content: "Commonplace — A latticework of powerful ideas" },
      {
        property: "og:description",
        content:
          "An audio-narrated, cross-linked map of the world's most powerful ideas. Learn in layers. Retain with spaced repetition.",
      },
      { property: "og:type", content: "website" },
      // Absolute URL is required by most scrapers; generated from the
      // brand tokens by scripts/brand-assets.ts (see docs/VISUAL-SYSTEM.md).
      { property: "og:image", content: `${SITE_URL}/brand/og.png` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "Commonplace — A latticework of powerful ideas" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: `${SITE_URL}/brand/og.png` },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      // SVG favicon for browsers that support it, ICO fallback (favicon.ico
      // already existed as a generated asset but was never actually linked)
      // for the ones that don't, apple-touch-icon for iOS "Add to Home
      // Screen" (which ignores the manifest's icon list entirely).
      { rel: "icon", href: "/logo.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  // Silently preloads every route so the installed app works fully offline,
  // not just the pages the user happened to open first.
  useOfflineWarmup();
  useThemeSync();
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-paper pb-32">
        <a
          href="#main-content"
          className="absolute -top-full left-2 z-50 px-4 py-2 bg-ink text-paper font-mono text-[11px] uppercase tracking-[0.18em] focus:top-2 transition-[top]"
        >
          Skip to content
        </a>
        <div className="mx-auto max-w-2xl">
          <main id="main-content">
            <Outlet />
          </main>
        </div>
        <BottomNav />
      </div>
    </QueryClientProvider>
  );
}
