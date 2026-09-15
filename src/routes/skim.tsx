import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { CLUSTERS, NODES, type NodeIndex as Node } from "@/data/nodes";
import { MicroLabel } from "@/components/MicroLabel";
import { IdeaGlyph } from "@/components/Artwork";
import { SearchBar } from "@/components/SearchBar";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ChevronUp, Bookmark } from "lucide-react";

const skimSearchSchema = z.object({
  cluster: z.string().optional(),
});

export const Route = createFileRoute("/skim")({
  validateSearch: skimSearchSchema,
  head: () => ({
    meta: [
      { title: "Skim — Commonplace" },
      {
        name: "description",
        content: "The entire lattice, one thesis at a time.",
      },
    ],
  }),
  component: SkimScreen,
});

const CLUSTER_TITLE: Record<string, string> = Object.fromEntries(
  CLUSTERS.map((c) => [c.id, c.title]),
);

const PAGE_SIZE = 10;
const GROW_BY = 10;

function SkimScreen() {
  const { cluster: clusterFilter } = Route.useSearch();
  const [filterOpen, setFilterOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const nodes = useMemo(
    () => (clusterFilter ? NODES.filter((n) => n.clusterId === clusterFilter) : NODES),
    [clusterFilter],
  );

  // Reset window when filter changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    setActiveIndex(0);
    containerRef.current?.scrollTo({ top: 0 });
  }, [clusterFilter]);

  // Windowing — only render visibleCount, grow via IntersectionObserver
  useEffect(() => {
    if (visibleCount >= nodes.length) return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((n) => Math.min(n + GROW_BY, nodes.length));
        }
      },
      { root: containerRef.current, rootMargin: "400px 0px", threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visibleCount, nodes.length]);

  // Sync active index with scroll (for aria live)
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const cards = Array.from(root.querySelectorAll<HTMLElement>("[data-skim-card]"));
        if (!cards.length) return;
        const center = root.scrollTop + root.clientHeight / 2;
        let best = 0;
        let bestDist = Infinity;
        cards.forEach((el, i) => {
          const mid = el.offsetTop + el.offsetHeight / 2;
          const d = Math.abs(mid - center);
          if (d < bestDist) {
            bestDist = d;
            best = i;
          }
        });
        setActiveIndex(best);
      });
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [visibleCount]);

  const scrollToIdx = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(idx, nodes.length - 1));
      if (clamped >= visibleCount) {
        setVisibleCount(Math.min(clamped + GROW_BY, nodes.length));
        requestAnimationFrame(() => {
          document
            .getElementById(`skim-card-${nodes[clamped].id}`)
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      } else {
        document
          .getElementById(`skim-card-${nodes[clamped].id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      setActiveIndex(clamped);
    },
    [nodes, visibleCount],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable)
        return;
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        scrollToIdx(activeIndex + 1);
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        scrollToIdx(activeIndex - 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        scrollToIdx(0);
      } else if (e.key === "End") {
        e.preventDefault();
        scrollToIdx(nodes.length - 1);
      }
    },
    [activeIndex, scrollToIdx, nodes.length],
  );

  const visible = nodes.slice(0, visibleCount);

  return (
    <div className="flex flex-col h-[100dvh]">
      <header className="shrink-0 flex items-center justify-between px-5 py-2.5 relative z-30 bg-paper border-b border-line">
        <div>
          <h1 className="font-serif text-lg leading-tight text-ink">Skim</h1>
          <MicroLabel>
            {clusterFilter ? CLUSTER_TITLE[clusterFilter] : "The whole lattice"} · {nodes.length}
          </MicroLabel>
        </div>
        <button
          onClick={() => setFilterOpen((v) => !v)}
          aria-expanded={filterOpen}
          aria-controls="skim-topics-panel"
          className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft hover:text-ink"
        >
          Topics
        </button>
      </header>

      {filterOpen && (
        <div
          id="skim-topics-panel"
          className="absolute top-[57px] left-0 right-0 z-20 border-b border-line bg-paper shadow-card px-5 py-4 max-h-[50vh] overflow-y-auto"
        >
          <SearchBar />
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/skim"
              search={{}}
              onClick={() => setFilterOpen(false)}
              className={cn(
                "min-h-9 border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em]",
                !clusterFilter
                  ? "border-ink bg-ink text-paper"
                  : "border-line text-ink-soft hover:border-ink",
              )}
            >
              All
            </Link>
            {CLUSTERS.map((c) => (
              <Link
                key={c.id}
                to="/skim"
                search={{ cluster: c.id }}
                onClick={() => setFilterOpen(false)}
                className={cn(
                  "min-h-9 border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em]",
                  clusterFilter === c.id
                    ? "border-ink bg-ink text-paper"
                    : "border-line text-ink-soft hover:border-ink",
                )}
              >
                {c.title}
              </Link>
            ))}
          </div>
        </div>
      )}

      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {nodes.length > 0
          ? `Card ${activeIndex + 1} of ${nodes.length}: ${visible[activeIndex]?.title ?? ""}`
          : ""}
      </p>

      <div
        ref={containerRef}
        tabIndex={0}
        role="feed"
        aria-label={`Skim — ${nodes.length} theses, showing ${visible.length}. Arrow keys or J/K to navigate.`}
        onKeyDown={handleKeyDown}
        className="flex-1 min-h-0 snap-y snap-mandatory overflow-y-auto overscroll-contain focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
      >
        {visible.map((node, i) => (
          <SkimCard key={node.id} node={node} index={i} first={i === 0} total={nodes.length} />
        ))}
        {visibleCount < nodes.length && (
          <div
            ref={sentinelRef}
            className="flex snap-start items-center justify-center py-8"
            aria-hidden
          >
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
              Loading… {visible.length}/{nodes.length}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function SkimCard({
  node,
  index,
  first,
  total,
}: {
  node: Node;
  index: number;
  first: boolean;
  total: number;
}) {
  const isVisited = useStore((s) => !!s.visited[node.id]);
  const bookmarked = useStore((s) => !!s.bookmarks[node.id]);
  const toggleBookmark = useStore((s) => s.toggleBookmark);
  const navigate = useNavigate();

  return (
    <div
      id={`skim-card-${node.id}`}
      data-skim-card
      data-index={index}
      role="article"
      aria-posinset={index + 1}
      aria-setsize={total}
      aria-labelledby={`skim-title-${node.id}`}
      tabIndex={-1}
      onClick={() => navigate({ to: "/node/$id", params: { id: node.id } })}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate({ to: "/node/$id", params: { id: node.id } });
        }
      }}
      className="relative flex min-h-[calc(100dvh-3.75rem)] snap-start flex-col justify-between px-5 py-8 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-accent motion-reduce:snap-none"
    >
      <button
        aria-label={bookmarked ? `Remove ${node.title} from saved` : `Save ${node.title}`}
        aria-pressed={bookmarked}
        onClick={(e) => {
          e.stopPropagation();
          toggleBookmark(node.id);
        }}
        className={cn(
          "absolute right-5 top-8 z-10 flex h-10 w-10 items-center justify-center rounded-full border transition-colors active:scale-95",
          bookmarked && "pulse-beat",
          bookmarked
            ? "border-ink bg-ink text-paper"
            : "border-line bg-paper text-ink-soft hover:border-ink hover:text-ink",
        )}
      >
        <Bookmark className="h-4 w-4" fill={bookmarked ? "currentColor" : "none"} aria-hidden />
      </button>

      <div className="pr-14">
        <div className="flex flex-wrap items-center gap-2">
          <IdeaGlyph nodeId={node.id} animate={first} className="h-6 w-6 shrink-0" />
          <MicroLabel>
            {node.epistemicStatus ? `${node.epistemicStatus} · ` : ""}
            {CLUSTER_TITLE[node.clusterId] ?? node.clusterId}
          </MicroLabel>
          {isVisited && (
            <span
              aria-label="Read"
              className="inline-block px-1.5 py-0.5 bg-ink text-paper font-mono text-[10px] uppercase tracking-[0.1em]"
            >
              Read
            </span>
          )}
        </div>
        <h2
          id={`skim-title-${node.id}`}
          className="mt-4 font-serif text-3xl leading-tight text-ink sm:text-4xl"
        >
          {node.title}
        </h2>
        <p className="mt-5 font-serif text-lg leading-relaxed text-ink-soft">{node.layer0}</p>
      </div>

      <div className="flex items-center justify-between pt-6">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
          {node.author} · {node.year}
        </span>
        {first && (
          <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
            <ChevronUp className="h-3.5 w-3.5" aria-hidden /> swipe · next
            <span className="hidden sm:inline"> · J/K</span>
          </span>
        )}
      </div>
    </div>
  );
}
