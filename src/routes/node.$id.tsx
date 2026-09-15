import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  NODE_BY_ID,
  CLUSTER_BY_ID,
  type NodeIndex,
  type NodeBody,
  type FurtherReading,
} from "@/data/nodes";
import { useNodeBody, withBody } from "@/lib/bodies";
import { Bone } from "@/components/Skeleton";
import { MicroLabel } from "@/components/MicroLabel";
import { IdeaGlyph } from "@/components/Artwork";
import { LayerReveal } from "@/components/LayerReveal";
import { Quiz } from "@/components/Quiz";
import { RecallReveal } from "@/components/RecallReveal";
import { RelatedCard } from "@/components/RelatedCard";
import { AudioBar } from "@/components/AudioBar";
import { FirstTimeHint } from "@/components/FirstTimeHint";
import { useStore } from "@/lib/store";
import { useHydrated } from "@/lib/hydrated";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/node/$id")({
  loader: ({ params }) => {
    const node = NODE_BY_ID[params.id];
    if (!node) throw notFound();
    return { node };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Not found — Commonplace" }] };
    const n = loaderData.node;
    return {
      meta: [
        { title: `${n.title} — Commonplace` },
        { name: "description", content: n.thesis },
        { property: "og:title", content: `${n.title} — Commonplace` },
        { property: "og:description", content: n.thesis },
      ],
      // Structured data for search rich results. BCE/approximate years are
      // intentionally not mapped to datePublished (schema.org expects ISO
      // dates); the human-readable year stays in the page body.
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "LearningResource",
            name: n.title,
            abstract: n.thesis,
            author: { "@type": "Person", name: n.author },
            learningResourceType: n.medium,
            keywords: n.tags.join(", "),
            isPartOf: { "@type": "Collection", name: "Commonplace" },
          }),
        },
      ],
    };
  },
  component: NodeScreen,
});

// Archived source files always live at content/sources/<slug>.md (see
// docs/OFFLINE-ARCHIVE-PLAN.md); the reader route just needs the slug.
function archiveSlug(path: string): string {
  return path.replace(/^content\/sources\//, "").replace(/\.md$/, "");
}

const epistemicStatusExplainer: Record<string, string> = {
  Canonical: "Canonical — the original, primary-source explanation, not a summary of one.",
  Contemporary: "Contemporary — a current, actively-debated framing rather than a settled classic.",
  Speculative: "Speculative — a reasoned hypothesis, presented as one, not established fact.",
};

function splitSentences(text: string): string[] {
  // Primary: Intl.Segmenter with sentence granularity (Chrome/Safari/FF 99+)
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
    const segs = Array.from(segmenter.segment(text))
      .map((s) => s.segment.trim())
      .filter(Boolean);
    // Segmenter sometimes returns 1 big chunk — fall through to regex in that case
    if (segs.length > 1) return segs;
  }
  // Fallback: split on sentence-ending punctuation followed by whitespace/end
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// New (never opened) > opened but not mastered > mastered (gotIt). Passive —
// derived from visitNode, which already fires on every page load.
function readStatusBoost(
  id: string,
  gotItMap: Record<string, boolean>,
  visitedMap: Record<string, boolean>,
): number {
  if (gotItMap[id]) return 0;
  if (visitedMap[id]) return 40;
  return 100;
}

function Sentences({ text, start }: { text: string; start: number }) {
  const sents = useMemo(() => splitSentences(text), [text]);
  return (
    <p className="leading-relaxed text-ink">
      {sents.map((s, i) => (
        <span
          key={i}
          data-sentence={start + i}
          className="transition-colors duration-200 data-[active=1]:bg-accent/15"
        >
          {s}{" "}
        </span>
      ))}
    </p>
  );
}

function getRecommendationReason(
  sourceNode: NodeIndex,
  targetNode: NodeIndex,
  interests: string[],
): string {
  const sharedInterests = targetNode.tags.filter((t) => interests.includes(t));
  if (sharedInterests.length > 0) {
    return `Suggested: Matches your interest in ${sharedInterests[0]}`;
  }

  if (sourceNode.clusterId === targetNode.clusterId) {
    const cluster = CLUSTER_BY_ID[sourceNode.clusterId];
    return `Suggested: Continues the theme of ${cluster?.title || "this cluster"}`;
  }

  const sharedTags = targetNode.tags.filter((t) => sourceNode.tags.includes(t));
  if (sharedTags.length > 0) {
    return `Suggested: Explores related concepts like ${sharedTags[0]}`;
  }

  return "Suggested: Hand-picked for you to explore next";
}

// Explicitly pulls a source's archived copy into the Cache Storage the
// service worker reads from, so "Download" actually means something —
// previously the archived .md was only ever cached as a side effect of
// opening /read/$id, so tapping "download" while offline-prepping and then
// losing signal before ever opening the reader silently failed. Checks
// cache on mount too, so an already-downloaded item shows as done instead
// of offering to redownload it. Once done, swaps to a "Downloaded" badge
// plus an explicit Open action, rather than leaving download and reading
// as the same button.
function DownloadButton({
  path,
  id,
  label,
  source,
  url: sourceUrl,
}: {
  path: string;
  id: string;
  label: string;
  source: string;
  url: string;
}) {
  const fileUrl = `/${path}`;
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  useEffect(() => {
    let cancelled = false;
    if (typeof window === "undefined" || !("caches" in window)) return;
    window.caches
      .match(fileUrl)
      .then((res) => {
        if (!cancelled && res) setState("done");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [fileUrl]);

  async function download(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (state === "loading" || state === "done") return;
    setState("loading");
    try {
      const res = await fetch(fileUrl, { cache: "reload" });
      if (!res.ok) throw new Error("failed to fetch");
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 border border-accent/40 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
          ✓ Downloaded
        </span>
        <Link
          to="/read/$id"
          params={{ id }}
          search={{ label, source, url: sourceUrl }}
          className="inline-flex items-center gap-1.5 border border-line px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink hover:border-ink"
        >
          Open →
        </Link>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={state === "loading"}
      className={cn(
        "inline-flex items-center gap-1.5 border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors disabled:opacity-60",
        "border-line text-ink-soft hover:border-ink hover:text-ink",
      )}
    >
      {state === "loading" ? "Downloading…" : state === "error" ? "Retry download" : "↓ Download"}
    </button>
  );
}

function FurtherReadingItem({ item }: { item: FurtherReading }) {
  const archived =
    (item.archive?.status === "full" || item.archive?.status === "excerpt") && item.archive.path;
  const [open, setOpen] = useState(false);

  return (
    <li className="py-5">
      <span className="block font-serif text-lg leading-snug text-ink">{item.label}</span>
      <span className="mt-1 block font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
        {item.source}
      </span>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-3 flex min-h-11 w-full items-center justify-between border border-accent/40 bg-accent/5 px-4 py-2.5 font-mono text-xs uppercase tracking-[0.18em] text-accent transition-colors hover:border-accent hover:bg-accent/10 sm:w-auto"
      >
        <span>{open ? "Hide" : "Read more"}</span>
        <span
          className={cn("ml-3 text-base transition-transform duration-200", open && "rotate-180")}
        >
          ↓
        </span>
      </button>

      {open && (
        <div className="rise mt-3 flex flex-wrap items-center gap-3">
          {archived && (
            <DownloadButton
              path={item.archive!.path!}
              id={archiveSlug(item.archive!.path!)}
              label={item.label}
              source={item.source}
              url={item.url}
            />
          )}
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft hover:text-ink hover:underline"
          >
            ↗ Read online
          </a>
        </div>
      )}
    </li>
  );
}

/** Skeleton lines while the body loads; a one-line notice if it can't. */
function BodyPending({ state, lines }: { state: ReturnType<typeof useNodeBody>; lines: number }) {
  if (state.status === "error") {
    return (
      <p className="text-sm text-ink-soft">
        Couldn't load this part — you may be offline. The summary above is always available.
      </p>
    );
  }
  return (
    <div aria-busy="true" className="space-y-2.5">
      {Array.from({ length: lines }, (_, i) => (
        <Bone key={i} className={cn("h-4", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

function NodeScreen() {
  const { node: index } = Route.useLoaderData() as { node: NodeIndex };
  // The index (title, thesis, layer0, related, tags) is bundled and renders on
  // the server; the body (layer1, layer2, quiz, further reading) is one small
  // per-cluster fetch, cached for the session — see lib/bodies.ts. Until it
  // lands, the deeper layers show skeletons behind their reveal buttons.
  const bodyState = useNodeBody(index);
  const body: NodeBody | undefined = bodyState.body;
  const node = useMemo(() => (body ? { ...index, ...body } : index), [index, body]);
  const cluster = CLUSTER_BY_ID[node.clusterId];
  const hydrated = useHydrated();
  const visitNode = useStore((s) => s.visitNode);
  const toggleBookmark = useStore((s) => s.toggleBookmark);
  const bookmarked = useStore((s) => !!s.bookmarks[node.id]);
  const gotItMap = useStore((s) => s.gotIt);
  const visitedMap = useStore((s) => s.visited);
  const interests = useStore((s) => s.interests);
  const dismissHint = useStore((s) => s.dismissHint);
  const queued = useStore((s) => s.readNext.includes(node.id));
  const addReadNext = useStore((s) => s.addReadNext);
  const removeReadNext = useStore((s) => s.removeReadNext);

  const [showL1, setShowL1] = useState(false);
  const [showL2, setShowL2] = useState(false);
  const [showAllConnections, setShowAllConnections] = useState(false);

  useEffect(() => {
    visitNode(node.id);
  }, [node.id, visitNode]);

  const l0Sents = splitSentences(node.layer0 ?? "").length;
  const l1Sents = splitSentences(body?.layer1 ?? "").length;
  const l2Sents = splitSentences(body?.layer2 ?? "").length;
  // The layer1 LayerReveal below is always mounted (it only CSS-collapses,
  // never unmounts), so its [data-sentence] spans exist from first render —
  // count l1Sents unconditionally. The layer2 LayerReveal, unlike layer1, is
  // only mounted once showL1 is true ({showL1 && <LayerReveal ...>} below),
  // so l2Sents must stay gated on showL1 to match what's actually in the
  // DOM. AudioBar's playback loop queries the live DOM for its stop
  // condition, so sentenceCount has to track this exactly — miscounting
  // it (previously gated l1Sents on showL1 too, undercounting) desynced the
  // progress bar from actual playback and produced the
  // finished-then-snaps-back-to-0 "looping" symptom.
  const totalSents = l0Sents + l1Sents + (showL1 ? l2Sents : 0);

  const related: NodeIndex[] = useMemo(() => {
    const arr = node.related.map((id: string) => NODE_BY_ID[id]).filter(Boolean);
    return arr.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      // New (never opened) beats opened-not-mastered beats mastered
      scoreA += readStatusBoost(a.id, gotItMap, visitedMap);
      scoreB += readStatusBoost(b.id, gotItMap, visitedMap);

      // Same cluster boost
      if (a.clusterId === node.clusterId) scoreA += 10;
      if (b.clusterId === node.clusterId) scoreB += 10;

      // User interests match
      scoreA += a.tags.filter((t: string) => interests.includes(t)).length * 5;
      scoreB += b.tags.filter((t: string) => interests.includes(t)).length * 5;

      // Shared node tags match
      scoreA += a.tags.filter((t: string) => node.tags.includes(t)).length;
      scoreB += b.tags.filter((t: string) => node.tags.includes(t)).length;

      return scoreB - scoreA;
    });
  }, [node, gotItMap, visitedMap, interests]);

  const nextConnection = related[0];

  return (
    <>
      <article className="px-5 pt-8 pb-8">
        <Link to="/" className="inline-flex items-center gap-2">
          <MicroLabel>← Home</MicroLabel>
        </Link>

        <div className="mt-6 rise">
          {/* The idea's mark, large: the same glyph the feed card carried,
              drawing itself on as the page opens. */}
          <IdeaGlyph nodeId={node.id} animate className="h-12 w-12 -ml-1" />
          <MicroLabel className="mt-4 block">
            {node.epistemicStatus ? `${node.epistemicStatus} · ` : ""}
            <span className="hidden sm:inline">{cluster?.title} · </span>
            {node.medium}
          </MicroLabel>
          <h1 className="mt-3 font-serif text-4xl leading-[1.1] text-ink sm:text-5xl">
            {node.title}
          </h1>
          <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
            {node.author} · {node.year}
          </p>
        </div>

        {node.epistemicStatus && (
          <FirstTimeHint id="hint-epistemic-status" className="mt-4">
            {epistemicStatusExplainer[node.epistemicStatus]}
          </FirstTimeHint>
        )}

        <blockquote className="mt-8 rise border-l-2 border-accent pl-5 [animation-delay:80ms]">
          <p className="font-serif text-xl italic leading-snug text-ink">"{node.thesis}"</p>
        </blockquote>

        <section className="mt-8 rise [animation-delay:160ms]">
          <MicroLabel>The idea</MicroLabel>
          <div className="mt-3">
            <Sentences text={node.layer0 ?? ""} start={0} />
          </div>
        </section>

        {!showL1 && (
          <FirstTimeHint id="hint-layers" className="mt-8">
            Ideas here are taught in layers, not dumped at once. What's above is the plain-English
            version — the next layer explains why it works, the one after is for applying it. Each
            unlocks only once you ask for it.
          </FirstTimeHint>
        )}

        <LayerReveal
          label="Why it works"
          onReveal={() => {
            setShowL1(true);
            dismissHint("hint-layers");
          }}
        >
          <section>
            <MicroLabel>Why it works</MicroLabel>
            <div className="mt-3">
              {body ? (
                <Sentences text={body.layer1 ?? ""} start={l0Sents} />
              ) : (
                <BodyPending state={bodyState} lines={5} />
              )}
            </div>
          </section>
        </LayerReveal>

        {showL1 && (
          <LayerReveal label="How to apply it" onReveal={() => setShowL2(true)}>
            <section>
              <MicroLabel>How to apply it</MicroLabel>
              <div className="mt-3">
                {body ? (
                  <Sentences text={body.layer2 ?? ""} start={l0Sents + l1Sents} />
                ) : (
                  <BodyPending state={bodyState} lines={5} />
                )}
              </div>
            </section>
          </LayerReveal>
        )}

        <RecallReveal text={node.thesis} />
        {/* The quiz lives in the body half of the node (post-split), so it
            only renders once the cluster bodies have landed — same
            BodyPending pattern as the layers above. */}
        {body ? (
          <Quiz node={withBody(index, body)} />
        ) : (
          <div className="mt-10 border-t border-line pt-8">
            <BodyPending state={bodyState} lines={3} />
          </div>
        )}

        <section className="mt-14">
          <MicroLabel>Further reading</MicroLabel>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
            Read more about the topic
          </p>
          {body ? (
            <ul className="mt-4 divide-y divide-line border-t border-line">
              {body.furtherReading.map((f) => (
                <FurtherReadingItem key={f.url} item={f} />
              ))}
            </ul>
          ) : (
            <div className="mt-4 border-t border-line pt-4">
              <BodyPending state={bodyState} lines={2} />
            </div>
          )}
        </section>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <button
            onClick={() => toggleBookmark(node.id)}
            className="flex items-center gap-2 border border-line px-4 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-ink hover:border-ink"
          >
            <span className={hydrated && bookmarked ? "text-accent" : "text-ink-soft"}>★</span>
            <span>{hydrated && bookmarked ? "Saved" : "Save"}</span>
          </button>
          <button
            onClick={() => (queued ? removeReadNext(node.id) : addReadNext(node.id))}
            className={cn(
              "flex items-center gap-2 border px-4 py-3 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors",
              hydrated && queued
                ? "border-ink bg-ink text-paper"
                : "border-line text-ink hover:border-ink",
            )}
          >
            <span>{hydrated && queued ? "− Remove" : "+ Queue"}</span>
            <span className="hidden sm:inline">Read Next</span>
          </button>
        </div>

        {nextConnection && (
          <section className="mt-16 rise [animation-delay:240ms]">
            <Link
              to="/node/$id"
              params={{ id: nextConnection.id }}
              className="group block border-2 border-ink p-6 sm:p-8 transition-colors duration-300 hover:bg-ink"
            >
              <div className="mb-4 flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-[0.14em]">
                <span className="bg-accent px-2 py-1 text-paper">Up Next</span>
                <span className="text-ink group-hover:text-paper/80 transition-colors">
                  {getRecommendationReason(node, nextConnection, interests)}
                </span>
              </div>
              <h3 className="font-serif text-3xl sm:text-4xl leading-tight text-ink group-hover:text-paper transition-colors">
                {nextConnection.title}
              </h3>
              <p className="mt-4 border-l-2 border-accent/50 pl-4 font-serif text-xl italic leading-relaxed text-ink-soft group-hover:text-paper/80 transition-colors">
                "{nextConnection.thesis}"
              </p>
              <div className="mt-8 flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft group-hover:text-paper/60 transition-colors">
                  {nextConnection.author} · {nextConnection.medium}
                </span>
                <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink group-hover:text-paper transition-all">
                  <span>Continue</span>
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </span>
              </div>
            </Link>

            {related.length > 1 && (
              <div className="mt-10">
                {!showAllConnections ? (
                  <button
                    onClick={() => setShowAllConnections(true)}
                    className="flex w-full items-center justify-between border-t border-line py-4 text-left font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft hover:text-ink"
                  >
                    <span>Show {related.length - 1} other connections</span>
                    <span>+</span>
                  </button>
                ) : (
                  <div className="rise">
                    <div className="flex items-baseline justify-between border-t border-line pt-8">
                      <h2 className="font-serif text-3xl text-ink">Related ideas</h2>
                      <MicroLabel>The lattice</MicroLabel>
                    </div>
                    <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                      Where this thought connects
                    </p>
                    <div className="mt-6">
                      {related
                        .filter((r) => r.id !== nextConnection.id)
                        .map((r) => (
                          <RelatedCard key={r.id} node={r} />
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </article>
      <AudioBar
        key={node.id}
        node={node}
        sentenceCount={totalSents}
        l0Sents={l0Sents}
        l1Sents={l1Sents}
        onReachLayer1={() => {
          setShowL1(true);
          dismissHint("hint-layers");
        }}
        onReachLayer2={() => setShowL2(true)}
      />
    </>
  );
}
