import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { MicroLabel } from "@/components/MicroLabel";
import { Bone } from "@/components/Skeleton";
import { safeArchiveId, safeHttpUrl } from "@/lib/url";

const readSearchSchema = z.object({
  label: z.string().optional(),
  source: z.string().optional(),
  url: z.string().optional(),
});

export const Route = createFileRoute("/read/$id")({
  validateSearch: readSearchSchema,
  head: () => ({
    meta: [{ title: "Archived reading — Commonplace" }, { name: "robots", content: "noindex" }],
  }),
  component: ReadScreen,
});

interface ParsedArchive {
  title?: string;
  author?: string;
  source?: string;
  url?: string;
  retrieved?: string;
  credit: string;
  paragraphs: string[];
}

function parseFrontmatter(raw: string): ParsedArchive {
  const fm: Record<string, string> = {};
  let rest = raw;

  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (fmMatch) {
    fmMatch[1].split(/\r?\n/).forEach((line) => {
      const idx = line.indexOf(":");
      if (idx === -1) return;
      const key = line.slice(0, idx).trim();
      const val = line
        .slice(idx + 1)
        .trim()
        .replace(/^"(.*)"$/, "$1");
      fm[key] = val;
    });
    rest = raw.slice(fmMatch[0].length);
  }

  const lines = rest.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;
  const creditLines: string[] = [];
  while (i < lines.length && lines[i].trim().startsWith(">")) {
    creditLines.push(lines[i].replace(/^>\s?/, ""));
    i++;
  }
  const body = lines.slice(i).join("\n").trim();
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return {
    title: fm.title,
    author: fm.author,
    source: fm.source,
    url: fm.url,
    retrieved: fm.retrieved,
    credit: creditLines.join(" "),
    paragraphs,
  };
}

function ReadScreen() {
  const { id } = Route.useParams();
  const { label, source, url } = Route.useSearch();

  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [data, setData] = useState<ParsedArchive | null>(null);

  const archiveId = safeArchiveId(id);

  useEffect(() => {
    let cancelled = false;
    if (!archiveId) {
      setStatus("error");
      return;
    }
    setStatus("loading");
    fetch(`/content/sources/${archiveId}.md`)
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.text();
      })
      .then((text) => {
        if (cancelled) return;
        setData(parseFrontmatter(text));
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [archiveId]);

  const title = data?.title ?? label;
  const displayAuthor = data?.author ?? "";
  const displaySource = data?.source ?? source;
  const originalUrl = safeHttpUrl(data?.url) ?? safeHttpUrl(url);

  return (
    <article className="mx-auto max-w-2xl px-5 pt-8 pb-16">
      <button
        onClick={() => window.history.back()}
        className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft hover:text-ink"
      >
        ← Back
      </button>

      <div className="mt-6">
        <MicroLabel>
          Archived copy{displaySource ? ` · ${displaySource}` : ""}
          {data?.retrieved ? ` · retrieved ${data.retrieved}` : ""}
        </MicroLabel>
        {title && (
          <h1 className="mt-3 font-serif text-3xl leading-[1.15] text-ink sm:text-4xl">{title}</h1>
        )}
        {displayAuthor && (
          <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
            {displayAuthor}
          </p>
        )}
      </div>

      {data?.credit && (
        <blockquote className="mt-6 border-l-2 border-line pl-4">
          <p className="text-sm italic leading-relaxed text-ink-soft">{data.credit}</p>
        </blockquote>
      )}

      <div className="mt-8">
        {status === "loading" && (
          <div className="space-y-3" aria-hidden="true">
            <Bone className="h-4 w-full" />
            <Bone className="h-4 w-11/12" />
            <Bone className="h-4 w-4/5" />
          </div>
        )}

        {status === "error" && (
          <div className="border border-line border-dashed p-6 text-center">
            <p className="font-serif text-lg text-ink">Couldn't load the archived copy.</p>
            <p className="mt-2 text-sm text-ink-soft">
              This offline copy isn't available on this device right now.
            </p>
            {originalUrl && (
              <a
                href={originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block font-mono text-[11px] uppercase tracking-[0.18em] text-accent hover:underline"
              >
                ↗ Open original instead
              </a>
            )}
          </div>
        )}

        {status === "ready" && data && (
          <div className="space-y-5">
            {data.paragraphs.map((p, i) => (
              <p key={i} className="font-serif text-lg leading-relaxed text-ink">
                {p}
              </p>
            ))}
          </div>
        )}
      </div>

      {originalUrl && status !== "error" && (
        <div className="mt-12 border-t border-line pt-6">
          <a
            href={originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft hover:text-ink hover:underline"
          >
            ↗ Open original
          </a>
        </div>
      )}

      <div className="mt-10">
        <Link
          to="/"
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft hover:text-ink"
        >
          ← Back to feed
        </Link>
      </div>
    </article>
  );
}
