import { useEffect, useMemo, useState, useRef, type ReactNode, useCallback } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Bookmark,
  Check,
  HelpCircle,
  ChevronUp,
  GripVertical,
  Minus,
  Plus,
  List,
  Share2,
} from "lucide-react";
import { CLUSTERS, type NodeIndex as Node, NODES } from "@/data/nodes";
import { Quiz } from "@/components/Quiz";
import { MicroLabel } from "@/components/MicroLabel";
import { BrandMark } from "@/components/BrandMark";
import { IdeaGlyph } from "@/components/Artwork";
import { FeedSkeleton } from "@/components/Skeleton";
import { buildFeed, type FeedSource } from "@/lib/feed";
import { getFeedSeed, getSessionVisited } from "@/lib/feedSession";
import { useStore, dueCount, readNextNodes } from "@/lib/store";
import { useHydrated } from "@/lib/hydrated";
import { cn } from "@/lib/utils";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Commonplace — A latticework of powerful ideas" },
      {
        name: "description",
        content: "A feed of the world's most powerful ideas, tuned to what you care about.",
      },
    ],
  }),
  component: FeedScreen,
});

const CLUSTER_TITLE: Record<string, string> = Object.fromEntries(
  CLUSTERS.map((c) => [c.id, c.title]),
);

const FEED_PAGE_SIZE = 8;
const FEED_GROW_BY = 8;

function SortableQueueItem({ n, onClose }: { n: Node; onClose: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: n.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
  };

  const removeReadNext = useStore((s) => s.removeReadNext);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 p-2 border border-line bg-paper hover:border-ink transition-colors relative",
        isDragging && "opacity-50 border-ink shadow-md z-10",
      )}
    >
      <div
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-ink-soft shrink-0 touch-none"
      >
        <GripVertical className="w-4 h-4" />
      </div>
      <button
        aria-label={`Go to card: ${n.title}`}
        className="flex-1 text-left min-w-0"
        onClick={() => {
          document.getElementById(`feed-card-${n.id}`)?.scrollIntoView({ behavior: "smooth" });
          onClose();
        }}
      >
        <div className="truncate font-serif text-sm text-ink">{n.title}</div>
      </button>
      <button
        aria-label="Remove from queue"
        onClick={() => removeReadNext(n.id)}
        className="p-1 text-ink-soft hover:text-ink shrink-0"
      >
        <Minus className="w-4 h-4" />
      </button>
    </div>
  );
}

function ReadNextList({ nodes, onClose }: { nodes: Node[]; onClose: () => void }) {
  const reorderReadNext = useStore((s) => s.reorderReadNext);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = nodes.findIndex((n) => n.id === active.id);
      const newIndex = nodes.findIndex((n) => n.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        reorderReadNext(oldIndex, newIndex);
      }
    }
  }

  if (nodes.length === 0) {
    return (
      <div className="absolute top-[44px] left-0 right-0 z-20 shrink-0 border-b border-line bg-paper px-5 py-6 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft shadow-card">
        Your queue is empty
      </div>
    );
  }

  return (
    <div className="absolute top-[44px] left-0 right-0 z-20 shrink-0 border-b border-line bg-paper shadow-card">
      <div className="px-5 py-3 max-h-[40vh] overflow-y-auto space-y-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={nodes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
            {nodes.map((n) => (
              <SortableQueueItem key={n.id} n={n} onClose={onClose} />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}

function NeedsTopicsCard() {
  return (
    <section className="flex min-h-full snap-start flex-col items-center justify-center p-8 text-center">
      <h2 className="font-serif text-3xl text-ink">Pick your topics</h2>
      <p className="mt-4 font-serif text-lg text-ink-soft max-w-sm">
        Tell us what you want to learn, and we'll build your feed.
      </p>
      <Link
        to="/onboarding"
        className="mt-8 bg-ink text-paper px-6 py-3 font-mono text-[11px] uppercase tracking-[0.14em]"
      >
        Choose topics
      </Link>
    </section>
  );
}

function ExhaustedCard() {
  const review = useStore((s) => s.review);
  const due = dueCount(review);

  return (
    <section className="flex min-h-full snap-start flex-col items-center justify-center p-8 text-center">
      <h2 className="font-serif text-3xl text-ink">You're caught up.</h2>
      <p className="mt-4 font-serif text-lg text-ink-soft max-w-sm">
        You've read everything in your selected topics.
      </p>
      {due > 0 && (
        <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
          {due} due to review
        </p>
      )}
      <div className="mt-8 flex gap-4">
        <Link
          to="/onboarding"
          className="border border-ink px-6 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink"
        >
          Add topics
        </Link>
        <Link
          to="/skim"
          className="bg-ink text-paper px-6 py-3 font-mono text-[11px] uppercase tracking-[0.14em]"
        >
          Skim the lattice
        </Link>
      </div>
    </section>
  );
}

function FeedScreen() {
  const navigate = useNavigate();
  const hydrated = useHydrated();
  const onboardingComplete = useStore((s) => s.onboardingComplete);
  const interests = useStore((s) => s.interests);
  const bookmarks = useStore((s) => s.bookmarks);
  const gotIt = useStore((s) => s.gotIt);
  const visited = useStore((s) => s.visited);
  const readNext = useStore((s) => s.readNext);

  const [seed] = useState(() => (Date.now() & 0xffffffff) >>> 0 || 1);
  const [queueOpen, setQueueOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(FEED_PAGE_SIZE);
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const feedResult = useMemo(() => {
    const likedIds = [
      ...Object.keys(bookmarks).filter((k) => bookmarks[k]),
      ...Object.keys(gotIt).filter((k) => gotIt[k]),
    ];
    return buildFeed({ interests, likedIds, visited, seed, readNext });
  }, [seed, interests, visited, bookmarks, gotIt, readNext]);

  const interestsKey = interests.join(",");
  // Reset visible window when feed identity changes (interest change)
  useEffect(() => {
    setVisibleCount(FEED_PAGE_SIZE);
    setActiveIndex(0);
  }, [interestsKey, seed]);

  // Incremental loading via IntersectionObserver (windowing — avoids rendering 387 cards at once)
  useEffect(() => {
    if (feedResult.needsTopics || feedResult.exhausted) return;
    if (visibleCount >= feedResult.items.length) return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((n) => Math.min(n + FEED_GROW_BY, feedResult.items.length));
        }
      },
      { root: containerRef.current, rootMargin: "400px 0px", threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visibleCount, feedResult.items.length, feedResult.needsTopics, feedResult.exhausted]);

  // Keyboard nav: j/k + arrows + PageUp/Down + Home/End, respects prefers-reduced-motion via auto scroll behavior
  const scrollToIndex = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(idx, feedResult.items.length - 1));
      // Ensure the target card is mounted (grow window if needed)
      if (clamped >= visibleCount) {
        setVisibleCount(Math.min(clamped + FEED_GROW_BY, feedResult.items.length));
        // defer scroll until next frame so DOM exists
        requestAnimationFrame(() => {
          document
            .getElementById(`feed-card-${feedResult.items[clamped].id}`)
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      } else {
        document
          .getElementById(`feed-card-${feedResult.items[clamped].id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      setActiveIndex(clamped);
    },
    [feedResult, visibleCount],
  );

  const handleContainerKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Avoid hijacking when typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable)
        return;
      if (!feedItems) return;
      if (e.key === "ArrowDown" || (e.key === "j" && !e.metaKey && !e.ctrlKey)) {
        e.preventDefault();
        scrollToIndex(activeIndex + 1);
      } else if (e.key === "ArrowUp" || (e.key === "k" && !e.metaKey && !e.ctrlKey)) {
        e.preventDefault();
        scrollToIndex(activeIndex - 1);
      } else if (e.key === "PageDown") {
        e.preventDefault();
        scrollToIndex(activeIndex + 3);
      } else if (e.key === "PageUp") {
        e.preventDefault();
        scrollToIndex(activeIndex - 3);
      } else if (e.key === "Home") {
        e.preventDefault();
        scrollToIndex(0);
      } else if (e.key === "End") {
        e.preventDefault();
        scrollToIndex(feedItems.length - 1);
      } else if (e.key === " " || e.key === "Spacebar") {
        // Space = expand/collapse is handled per-card; prevent page scroll hijack in feed
      }
    },
    [activeIndex, scrollToIndex, feedItems],
  );

  // Sync activeIndex with scroll position (scroll-snap section tracking)
  useEffect(() => {
    const root = containerRef.current;
    if (!root || !feedItems || feedNeedsTopics) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const cards = Array.from(root.querySelectorAll<HTMLElement>("[data-feed-card]"));
        if (!cards.length) return;
        // closest card to container center
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
  }, [feedItems, feedNeedsTopics, visibleCount]);

  useEffect(() => {
    if (hydrated && !onboardingComplete) navigate({ to: "/onboarding" });
  }, [hydrated, onboardingComplete, navigate]);

  // Gate on hydration: the persisted store (interests, visited) loads async and
  // the feed order is seeded, so rendering before hydration would mismatch SSR.
  if (!hydrated || !feedResult || !onboardingComplete) return <FeedSkeleton />;

  const readNextItems = readNextNodes(readNext, NODES);
  const visibleItems = feedResult.items.slice(0, visibleCount);
  const total = feedResult.items.length;

  return (
    <div className="flex flex-col h-[100dvh]">
      <header className="shrink-0 flex items-center justify-between px-5 py-2.5 relative z-30 bg-paper">
        <div className="flex items-center gap-2">
          <BrandMark className="h-6 w-6 mark-spin" />
          <span className="font-serif text-lg tracking-tight text-ink">Commonplace</span>
        </div>
        <div className="flex items-center gap-3">
          {!feedResult.needsTopics && total > 0 && (
            <span className="hidden sm:inline font-mono text-[11px] tracking-[0.14em] text-ink-soft">
              {Math.min(activeIndex + 1, total)} / {total}
            </span>
          )}
          <button
            onClick={() => setQueueOpen(!queueOpen)}
            aria-expanded={queueOpen}
            aria-controls="feed-queue-panel"
            className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft hover:text-ink"
          >
            <List className="h-4 w-4" aria-hidden /> Queue{" "}
            {readNextItems.length > 0 && `(${readNextItems.length})`}
          </button>
        </div>
      </header>

      {queueOpen && (
        <div id="feed-queue-panel">
          <ReadNextList nodes={readNextItems} onClose={() => setQueueOpen(false)} />
        </div>
      )}

      {/* Live region for screen readers */}
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {!feedResult.needsTopics && total > 0
          ? `Card ${activeIndex + 1} of ${total}: ${visibleItems[activeIndex]?.title ?? ""}`
          : ""}
      </p>

      <div
        ref={containerRef}
        tabIndex={0}
        role="feed"
        aria-label={`Ideas feed — ${total} cards${!feedResult.needsTopics ? `, showing ${visibleCount}` : ""}. Use arrow keys or J/K to navigate.`}
        aria-busy={visibleCount < total}
        onKeyDown={handleContainerKeyDown}
        className="flex-1 min-h-0 snap-y snap-mandatory overflow-y-auto overscroll-contain focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
      >
        {feedResult.needsTopics ? (
          <NeedsTopicsCard />
        ) : (
          <>
            {visibleItems.map((node, i) => (
              <FeedCard
                key={node.id}
                node={node}
                index={i}
                first={i === 0}
                source={feedResult.source[i]}
                total={total}
              />
            ))}
            {visibleCount < total && (
              <div
                ref={sentinelRef}
                className="flex snap-start items-center justify-center py-8"
                aria-hidden
              >
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                  Loading more ideas… ({visibleCount}/{total})
                </span>
              </div>
            )}
            {visibleCount >= total && feedResult.exhausted && <ExhaustedCard />}
            {/* Keyboard hint for desktop */}
            <div className="sr-only" id="feed-kb-hint">
              Feed keyboard: arrow up/down or J/K to move, page up/down to jump, Home/End for
              start/end.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FeedCard({
  node,
  index,
  first,
  source,
  total,
}: {
  node: Node;
  index: number;
  first: boolean;
  source: FeedSource;
  total: number;
}) {
  const bookmarked = useStore((s) => !!s.bookmarks[node.id]);
  const mastered = useStore((s) => !!s.gotIt[node.id]);
  const isVisited = useStore((s) => !!s.visited[node.id]);
  const queued = useStore((s) => s.readNext.includes(node.id));
  const toggleBookmark = useStore((s) => s.toggleBookmark);
  const markGotIt = useStore((s) => s.markGotIt);
  const addReadNext = useStore((s) => s.addReadNext);
  const removeReadNext = useStore((s) => s.removeReadNext);
  const [quiz, setQuiz] = useState(false);

  function toggleReadNext() {
    if (queued) removeReadNext(node.id);
    else addReadNext(node.id);
  }

  async function share() {
    const url = `${window.location.origin}/node/${node.id}`;
    try {
      if (navigator.share) await navigator.share({ title: node.title, url });
      else await navigator.clipboard.writeText(url);
    } catch {
      /* user cancelled */
    }
  }

  return (
    <article
      id={`feed-card-${node.id}`}
      data-feed-card
      data-index={index}
      aria-posinset={index + 1}
      aria-setsize={total}
      aria-labelledby={`feed-card-title-${node.id}`}
      tabIndex={-1}
      className={cn(
        "flex min-h-[calc(100dvh-7.5rem)] snap-start flex-col px-5 py-6 outline-none focus-visible:ring-1 focus-visible:ring-accent motion-reduce:snap-none",
        first && "rise",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2">
          {/* The idea's mark: a small piece of lattice unique to this node,
              the same one it carries on its page, in Skim and in Review. */}
          <IdeaGlyph nodeId={node.id} animate={first} className="h-6 w-6 shrink-0" />
          <MicroLabel>
            {node.epistemicStatus ? `${node.epistemicStatus} · ` : ""}
            <span className="hidden sm:inline">
              {CLUSTER_TITLE[node.clusterId] ?? node.clusterId} ·{" "}
            </span>
            {node.medium}
          </MicroLabel>
          {source === "adjacent" && (
            <span className="inline-block px-1.5 py-0.5 border border-accent/20 bg-accent/5 text-accent font-mono text-[10px] uppercase tracking-[0.1em]">
              Beyond your topics
            </span>
          )}
          {source === "queue" && (
            <span className="inline-block px-1.5 py-0.5 border border-line bg-paper text-ink-soft font-mono text-[10px] uppercase tracking-[0.1em]">
              In Read Next
            </span>
          )}
          {isVisited && (
            <span
              aria-label="Read"
              className="inline-block px-1.5 py-0.5 bg-ink text-paper font-mono text-[10px] uppercase tracking-[0.1em]"
            >
              Read ✓
            </span>
          )}
        </div>
        <Link
          to="/node/$id"
          params={{ id: node.id }}
          aria-describedby={`feed-card-meta-${node.id}`}
          className="group mt-4 -mx-4 flex flex-1 flex-col border border-transparent px-4 py-2 transition-colors hover:border-line hover:bg-line/10 active:bg-line/20"
        >
          <span
            id={`feed-card-title-${node.id}`}
            className="block font-serif text-2xl leading-tight text-ink transition-colors group-hover:text-accent sm:text-3xl"
          >
            {node.title}
          </span>
          <span className="mt-4 block flex-1 font-serif text-lg leading-relaxed text-ink-soft">
            {node.layer0}
          </span>
          <span className="mt-4 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft transition-colors group-hover:text-ink">
            Continue reading
            <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </span>
        </Link>

        {quiz && <Quiz node={node} />}

        <div id={`feed-card-meta-${node.id}`} className="mt-5 flex items-center justify-between">
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

      <div
        role="toolbar"
        aria-label={`Actions for ${node.title}`}
        className="flex shrink-0 items-center justify-around gap-2 pt-6 mt-4 border-t border-line/50"
      >
        <RailButton
          label={`Save ${node.title}`}
          shortLabel="Save"
          active={bookmarked}
          onClick={() => toggleBookmark(node.id)}
        >
          <Bookmark className="h-5 w-5" aria-hidden />
        </RailButton>
        <RailButton
          label={`Mark ${node.title} as Got it`}
          shortLabel="Got it"
          active={mastered}
          onClick={() => markGotIt(node.id)}
        >
          <Check className="h-5 w-5" aria-hidden />
        </RailButton>
        <RailButton
          label={queued ? `Remove ${node.title} from Read Next` : `Add ${node.title} to Read Next`}
          shortLabel="Queue"
          active={queued}
          onClick={toggleReadNext}
        >
          {queued ? (
            <Minus className="h-5 w-5" aria-hidden />
          ) : (
            <Plus className="h-5 w-5" aria-hidden />
          )}
        </RailButton>
        <RailButton
          label={`Toggle quiz for ${node.title}`}
          shortLabel="Quiz"
          active={quiz}
          onClick={() => setQuiz((q) => !q)}
        >
          <HelpCircle className="h-5 w-5" aria-hidden />
        </RailButton>
        <RailButton label={`Share ${node.title}`} shortLabel="Share" onClick={share}>
          <Share2 className="h-5 w-5" aria-hidden />
        </RailButton>
      </div>
    </article>
  );
}

function RailButton({
  label,
  shortLabel,
  active,
  onClick,
  children,
}: {
  label: string;
  shortLabel?: string;
  active?: boolean;
  onClick: (e: React.MouseEvent) => void;
  children: ReactNode;
}) {
  // One beat when the control turns on — the acknowledgement that a tap
  // registered, since nothing else on the card changes for Save/Got it.
  const [beat, setBeat] = useState(false);
  const wasActive = useRef(active);
  useEffect(() => {
    if (active && !wasActive.current) {
      setBeat(true);
      const t = setTimeout(() => setBeat(false), 450);
      wasActive.current = active;
      return () => clearTimeout(t);
    }
    wasActive.current = active;
  }, [active]);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "group flex flex-col items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors",
        active ? "text-ink" : "text-ink-soft hover:text-ink",
      )}
    >
      <div
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center rounded-full border transition-[background-color,border-color,color] duration-[var(--duration-fast)] active:scale-95",
          beat && "pulse-beat",
          active
            ? "border-ink bg-ink text-paper"
            : "border-line bg-transparent text-ink-soft group-hover:border-ink group-hover:text-ink",
        )}
      >
        {children}
      </div>
      <span className="opacity-80">{shortLabel ?? label}</span>
    </button>
  );
}
