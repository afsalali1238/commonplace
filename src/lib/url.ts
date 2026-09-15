/**
 * Guards for user-controlled URLs (search params, archive frontmatter).
 * `/read/$id` used to pass `search.url` straight into <a href>, which made
 * `javascript:` / `data:` schemes and path-traversal archive ids possible.
 */

/** Allow only http(s) URLs for hrefs the user didn't type into the address bar. */
export function safeHttpUrl(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    if (u.protocol === "http:" || u.protocol === "https:") return u.href;
  } catch {
    /* invalid */
  }
  return undefined;
}

/**
 * Archive filenames are `<nodeId>-<n>` or `<nodeId>-<slug>-<n>`
 * (e.g. A1-0, AA1-entropy-0). Reject anything that could walk off
 * `/content/sources/`.
 */
export function safeArchiveId(id: string): string | undefined {
  if (/^[A-Za-z0-9][A-Za-z0-9_-]{0,120}$/.test(id)) return id;
  return undefined;
}
