/**
 * generate-sitemap.ts — emits public/sitemap.xml for SEO.
 * Run: npx tsx scripts/generate-sitemap.ts  (also invoked by prebuild)
 *
 * The origin is SITE_URL from src/lib/site.ts, which resolves the build
 * environment (Vite `define` → SITE_URL → VERCEL_PROJECT_PRODUCTION_URL →
 * VERCEL_URL → placeholder). One variable therefore repoints the sitemap,
 * robots.txt, canonical, og:url and og:image together — see docs/BRAND.md.
 *
 * Output is deliberately deterministic. There is no <lastmod>: it used to
 * stamp the build date onto every URL, which both dirtied the working tree
 * after every build and is exactly the "lastmod you can't trust" pattern
 * crawlers learn to discount — cost with no benefit. If a real per-node date
 * ever lands in content/, emit it there instead of the build clock.
 */
import fs from "fs";
import path from "path";

import { SITE_URL } from "../src/lib/site";

async function main() {
  // The full node objects live in content/ (src/data/nodes.ts is now the
  // generated index, which no longer carries furtherReading).
  const { readAllContent } = await import("./lib/content");
  const { nodes: NODES, clusters: CLUSTERS } = readAllContent();

  const urls: string[] = [];

  // Static routes
  const staticPaths = [
    "/",
    "/explore",
    "/skim",
    "/review",
    "/you",
    "/onboarding",
    ...CLUSTERS.map((c) => `/explore?cluster=${encodeURIComponent(c.id)}`),
  ];
  urls.push(...staticPaths);

  // Node pages
  for (const n of NODES) {
    urls.push(`/node/${n.id}`);
  }

  // Archive readers (only for archived sources)
  for (const n of NODES) {
    for (const f of n.furtherReading) {
      if ((f.archive?.status === "full" || f.archive?.status === "excerpt") && f.archive.path) {
        const slug = f.archive.path.replace(/^content\/sources\//, "").replace(/\.md$/, "");
        const url = `/read/${slug}`;
        if (!urls.includes(url)) urls.push(url);
      }
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${SITE_URL}${u}</loc></url>`)
    .join("\n")}\n</urlset>\n`;

  const out = path.join(process.cwd(), "public/sitemap.xml");
  fs.writeFileSync(out, xml, "utf-8");
  console.log(`Wrote ${out} — ${urls.length} URLs (SITE_URL=${SITE_URL})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
