// Central site/app identity. Code imports this instead of hardcoding the name.
/** Display name. Decided 2026-09-12 (D1) - see docs/BRAND.md. */
export const APP_NAME = "Commonplace";
export const APP_TAGLINE = "A latticework of powerful ideas";
/**
 * Deployed origin for absolute URLs (canonical links, og:image, sitemap).
 * Placeholder per BRAND D2 - the domain is not registered yet; swap to the
 * real Vercel production origin before public launch. Env overrides live in
 * scripts (generate-sitemap), this constant is the code-level default.
 */
export const SITE_URL = "https://commonplace.app";

/** Absolute URL for a site path. Query strings are stripped — they are never canonical. */
export function absoluteUrl(pathname: string): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const noQuery = path.split("?")[0] || "/";
  return `${SITE_URL}${noQuery === "/" ? "/" : noQuery}`;
}

/**
 * Support contact. Empty = not configured yet; UI falls back to a
 * "coming soon" note instead of rendering a fake address.
 */
export const SUPPORT_EMAIL = "";
