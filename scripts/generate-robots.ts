/**
 * generate-robots.ts — emits public/robots.txt.
 * Run: npx tsx scripts/generate-robots.ts  (also invoked by prebuild)
 *
 * Generated rather than hand-maintained because the `Sitemap:` directive is an
 * absolute URL: a static file keeps pointing at whatever host was current the
 * last time someone remembered to edit it, and there is nothing in the build to
 * catch the drift. Resolving it from the same SITE_URL constant the sitemap
 * uses makes the two files structurally incapable of disagreeing.
 *
 * The directives themselves stay as permissive as they were: everything is
 * indexable, nothing is crawl-delayed.
 */
import fs from "fs";
import path from "path";

import { SITE_URL } from "../src/lib/site";

const robots = `User-agent: *
Allow: /
Sitemap: ${SITE_URL}/sitemap.xml
`;

const out = path.join(process.cwd(), "public/robots.txt");
fs.writeFileSync(out, robots, "utf-8");
console.log(`Wrote ${out} — Sitemap: ${SITE_URL}/sitemap.xml`);
