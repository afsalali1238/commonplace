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
import { SITE_URL, absoluteUrl } from "@/lib/site";
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

// TanStack Router's ErrorComponentProps types the thrown value as `unknown`
// (route loaders can throw anything, e.g. notFound() sentinels) — keeping
// this `unknown` rather than `Error` is what satisfies errorComponent.
function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
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
  head: ({ matches }) => {
    const pathname = matches[matches.length - 1]?.pathname ?? "/";
    const canonical = absoluteUrl(pathname);
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
        // Matches manifest.webmanifest's theme_color - was mismatched (paper
        // background here vs. accent everywhere else), so PWA chrome tinting
        // differed depending on whether a browser read this tag or the
        // manifest. Dark twin is swapped in by useThemeSync after hydration.
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
        { property: "og:url", content: canonical },
        // Absolute URL is required by most scrapers; generated from the
        // brand tokens by scripts/brand-assets.ts (see docs/VISUAL-SYSTEM.md).
        { property: "og:image", content: `${SITE_URL}/og.png` },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "og:image:alt", content: "Commonplace — A latticework of powerful ideas" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:image", content: `${SITE_URL}/og.png` },
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        { rel: "canonical", href: canonical },
        // Light/dark SVG pair: the light mark is near-black ink on a
        // transparent ground and vanishes against dark browser chrome.
        // Fonts are self-hosted via Fontsource in styles.css — do not
        // re-add Google Fonts; CSP font-src is 'self' and would block them.
        {
          rel: "icon",
          href: "/logo.svg",
          type: "image/svg+xml",
          media: "(prefers-color-scheme: light)",
        },
        {
          rel: "icon",
          href: "/logo-dark.svg",
          type: "image/svg+xml",
          media: "(prefers-color-scheme: dark)",
        },
        { rel: "icon", href: "/favicon.ico", sizes: "16x16 32x32 48x48" },
        { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
        { rel: "manifest", href: "/manifest.webmanifest" },
      ],
    };
  },
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
