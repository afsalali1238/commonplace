// Central site/app identity. Code imports this instead of hardcoding the name.
/** Display name. Decided 2026-09-12 (D1) - see docs/BRAND.md. */
export const APP_NAME = "Commonplace";
export const APP_TAGLINE = "A latticework of powerful ideas";

/**
 * The deployed origin, injected at build time by the `define` block in
 * vite.config.ts. It does not exist as a runtime binding in plain Node
 * (scripts, tsx, vitest), so every read goes through the `typeof` guard in
 * `injectedOrigin` — `typeof` on an undeclared identifier is the one safe
 * way to ask.
 */
declare const __SITE_URL__: string | undefined;

/**
 * Fallback origin (BRAND D2): `commonplace.app` is not a registered domain,
 * so this is a placeholder rather than a working host — every absolute URL
 * built from it currently 404s. Set `SITE_URL` at build time (or deploy on
 * Vercel, which supplies its own origin) to replace it everywhere at once.
 */
export const PLACEHOLDER_ORIGIN = "https://commonplace.app";

type Env = Record<string, string | undefined>;

/** A trailing slash would double up in the `${origin}${path}` joins below. */
function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function injectedOrigin(): string | undefined {
  return typeof __SITE_URL__ === "string" ? __SITE_URL__ : undefined;
}

/**
 * `process.env` where there is one (Node: scripts, SSR, tests) and `{}` in
 * the browser. Read through `globalThis` because tsconfig limits `types` to
 * `vite/client`, so a bare `process` reference would not typecheck.
 */
function processEnv(): Env {
  const proc = (globalThis as { process?: { env?: Env } }).process;
  return proc?.env ?? {};
}

/**
 * Origin from the environment alone, or `undefined` if nothing is configured.
 *
 * Vercel sets both `VERCEL_PROJECT_PRODUCTION_URL` (the project's production
 * domain, no scheme) and `VERCEL_URL` (this deployment's unique host) on
 * *every* build, preview included. Production is deliberately preferred:
 * canonical links, `og:url` and the sitemap must never name a per-deployment
 * preview host, or each preview deploy mints ~899 near-duplicate URLs and
 * leaves crawlers to guess which is canonical.
 */
function originFromEnv(env: Env): string | undefined {
  if (env.SITE_URL) return trimTrailingSlash(env.SITE_URL);
  if (env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${trimTrailingSlash(env.VERCEL_PROJECT_PRODUCTION_URL)}`;
  }
  if (env.VERCEL_URL) return `https://${trimTrailingSlash(env.VERCEL_URL)}`;
  return undefined;
}

/**
 * Resolve the deployed origin. Precedence:
 *
 * 1. the Vite build-time `define` — baked into the client *and* SSR bundles
 * 2. `SITE_URL` — explicit override, works on any host
 * 3. `VERCEL_PROJECT_PRODUCTION_URL` — Vercel production domain
 * 4. `VERCEL_URL` — Vercel deployment (i.e. preview) host
 * 5. `PLACEHOLDER_ORIGIN`
 *
 * Both inputs are explicit parameters so the precedence is unit-testable
 * without mutating globals; `SITE_URL` below is the real zero-argument read.
 */
export function resolveSiteUrl(injected: string | undefined, env: Env): string {
  if (injected) return trimTrailingSlash(injected);
  return originFromEnv(env) ?? PLACEHOLDER_ORIGIN;
}

/**
 * Deployed origin for every absolute URL the site emits: canonical, `og:url`,
 * `og:image`, `sitemap.xml` and `robots.txt`. All five resolve through this
 * one constant, so pointing the app at a real domain is a single environment
 * variable plus a redeploy — see docs/BRAND.md, "Origin".
 */
export const SITE_URL: string = resolveSiteUrl(injectedOrigin(), processEnv());

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
