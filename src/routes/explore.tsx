import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { CLUSTERS, NODES_BY_CLUSTER, type NodeIndex as Node } from "@/data/nodes";
import { SearchBar } from "@/components/SearchBar";
import { MicroLabel } from "@/components/MicroLabel";
import { LatticeIndex } from "@/components/LatticeIndex";
import { TopicPlate, IdeaGlyph } from "@/components/Artwork";
import { useStore } from "@/lib/store";
import { useHydrated } from "@/lib/hydrated";
import { cn } from "@/lib/utils";
import { Check, Plus, Minus, ArrowLeft } from "lucide-react";

const exploreSearchSchema = z.object({
  cluster: z.string().optional(),
  view: z.enum(["playlists", "lattice"]).optional(),
});

export const Route = createFileRoute("/explore")({
  validateSearch: exploreSearchSchema,
  head: () => ({
    meta: [
      { title: "Explore — Commonplace" },
      {
        name: "description",
        content: "Browse the full latticework of powerful ideas.",
      },
    ],
  }),
  component: ExploreScreen,
});

function PlaylistCard({
  cluster,
  nodes,
  index,
}: {
  cluster: (typeof CLUSTERS)[0];
  nodes: Node[];
  index: number;
}) {
  const visited = useStore((s) => s.visited);
  const readCount = nodes.filter((n) => visited[n.id]).length;
  const leftCount = nodes.length - readCount;
  const progress = nodes.length > 0 ? readCount / nodes.length : 0;
  const circ = 2 * Math.PI * 16;

  return (
    <Link
      to="/explore"
      search={{ cluster: cluster.id }}
      className="group settle flex flex-col border border-line bg-paper transition-[border-color,box-shadow] duration-[var(--duration-base)] hover:border-ink hover:shadow-[var(--shadow-card)]"
      style={{ "--i": index } as React.CSSProperties}
    >
      <div className="relative flex-1 min-h-[220px] overflow-hidden bg-paper p-5 flex flex-col justify-end">
        {/* The plate is the card's image: a generated field of arcs unique
            to this topic (lib/artwork.ts). It sits behind the title and
            the opened share of the topic lights its outer arcs in accent. */}
        <TopicPlate
          clusterId={cluster.id}
          progress={progress}
          className="absolute inset-0 h-full w-full transition-transform duration-[var(--duration-slow)] ease-[var(--ease-out)] group-hover:scale-[1.03]"
        />
        {/* Paper fades back in over the lower half so the title always sits
            on clean ground however the plate happens to fall. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-paper via-paper/85 to-transparent"
        />
        <h2 className="relative font-serif text-xl sm:text-2xl leading-tight text-ink transition-colors duration-[var(--duration-fast)] group-hover:text-accent text-balance">
          {cluster.title}
        </h2>
        <p className="relative mt-3 font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.14em] text-ink-soft">
          {cluster.subtitle}
        </p>
      </div>
      <div className="p-4 flex items-center justify-between shrink-0">
        <MicroLabel>{nodes.length} ideas</MicroLabel>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-ink-soft">
            {readCount} read · {leftCount} left
          </span>
          <svg viewBox="0 0 36 36" className="w-5 h-5 -rotate-90 shrink-0">
            <circle cx="18" cy="18" r="16" fill="none" className="stroke-line" strokeWidth="4" />
            <circle
              cx="18"
              cy="18"
              r="16"
              fill="none"
              className="ring-draw stroke-accent"
              strokeWidth="4"
              strokeDasharray={`${progress * circ} ${circ}`}
            />
          </svg>
        </div>
      </div>
    </Link>
  );
}

function TrackRow({ node }: { node: Node }) {
  const gotIt = useStore((s) => !!s.gotIt[node.id]);
  const queued = useStore((s) => s.readNext.includes(node.id));
  const addReadNext = useStore((s) => s.addReadNext);
  const removeReadNext = useStore((s) => s.removeReadNext);
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-4 py-3 group">
      <div className="w-6 shrink-0 flex justify-center">
        {gotIt ? (
          <Check className="w-4 h-4 text-ink-soft" />
        ) : (
          <div className="w-1.5 h-1.5 rounded-full bg-ink-soft/30" />
        )}
      </div>
      <div
        className="flex-1 min-w-0 cursor-pointer"
        onClick={() => navigate({ to: "/node/$id", params: { id: node.id } })}
      >
        <div className="truncate font-serif text-lg text-ink group-hover:underline">
          {node.title}
        </div>
        <div className="truncate font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
          {node.author} · {node.medium}
        </div>
      </div>
      <button
        onClick={() => (queued ? removeReadNext(node.id) : addReadNext(node.id))}
        className={cn(
          "shrink-0 p-2 border transition-colors",
          queued ? "border-ink bg-ink text-paper" : "border-line text-ink hover:border-ink",
        )}
        aria-label={queued ? "Remove from Read Next" : "Add to Read Next"}
      >
        {queued ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
      </button>
    </div>
  );
}

function ClusterDetail({ cluster, nodes }: { cluster: (typeof CLUSTERS)[0]; nodes: Node[] }) {
  const navigate = useNavigate();
  const visited = useStore((s) => s.visited);
  const hydrated = useHydrated();
  const readCount = hydrated ? nodes.filter((n) => visited[n.id]).length : 0;
  const progress = nodes.length > 0 ? readCount / nodes.length : 0;
  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate({ to: "/explore" })}
        className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="w-4 h-4" /> Back to topics
      </button>
      <div className="relative -mx-5 overflow-hidden border-y border-line px-5 py-8">
        {/* Same plate as the topic's card on the previous screen, now large
            and drawing itself on: the card you tapped opens up. */}
        <TopicPlate
          clusterId={cluster.id}
          progress={progress}
          animate
          className="absolute inset-0 h-full w-full"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-paper via-paper/70 to-transparent"
        />
        <div className="relative">
          <h2 className="rise font-serif text-3xl leading-tight text-ink sm:text-4xl">
            {cluster.title}
          </h2>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
            {cluster.subtitle}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link
              to="/skim"
              search={{ cluster: cluster.id }}
              className="inline-flex min-h-11 items-center border border-line bg-paper/80 px-4 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft backdrop-blur transition-colors hover:border-ink hover:text-ink"
            >
              Skim this topic →
            </Link>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
              {nodes.length} ideas{hydrated ? ` · ${readCount} opened` : ""}
            </span>
          </div>
        </div>
      </div>
      <div className="divide-y divide-line border-y border-line">
        {nodes.map((n, i) => (
          <TrackRow key={n.id} node={n} index={i} />
        ))}
      </div>
    </div>
  );
}

function ExploreScreen() {
  const hydrated = useHydrated();
  const visited = useStore((s) => s.visited);
  const { cluster: targetCluster, view = "playlists" } = Route.useSearch();

  if (targetCluster) {
    const cluster = CLUSTERS.find((c) => c.id === targetCluster);
    if (cluster) {
      const nodes = NODES_BY_CLUSTER[cluster.id];
      return (
        <div className="px-5 pt-8 pb-12">
          <SearchBar />
          <div className="mt-8">
            <ClusterDetail cluster={cluster} nodes={nodes} />
          </div>
        </div>
      );
    }
  }

  return (
    <div className="px-5 pt-8 pb-12">
      <header className="flex items-center justify-between">
        <h1 className="font-serif text-3xl leading-tight text-ink">Explore</h1>
      </header>

      <div className="mt-6">
        <SearchBar />
      </div>

      <div className="mt-8 flex items-center gap-2">
        <Link
          to="/explore"
          search={{ view: "playlists" }}
          className={cn(
            "flex items-center justify-center min-h-11 border px-4 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors",
            view === "playlists"
              ? "border-ink bg-ink text-paper"
              : "border-line text-ink-soft hover:border-ink hover:text-ink",
          )}
        >
          Topics
        </Link>
        <Link
          to="/explore"
          search={{ view: "lattice" }}
          className={cn(
            "flex items-center justify-center min-h-11 border px-4 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors",
            view === "lattice"
              ? "border-ink bg-ink text-paper"
              : "border-line text-ink-soft hover:border-ink hover:text-ink",
          )}
        >
          Every idea
        </Link>
        {/* Skim is the third way through the lattice — one thesis per
            screen, at speed. It lives here rather than in the bottom bar:
            it is a mode of browsing, not a distinct daily job (see
            PRODUCT-BRIEF.md §5). */}
        <Link
          to="/skim"
          search={{}}
          className="flex items-center justify-center min-h-11 border border-line px-4 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft transition-colors hover:border-ink hover:text-ink"
        >
          Skim →
        </Link>
      </div>

      {view === "lattice" ? (
        <div className="mt-12">
          <LatticeIndex visited={visited} hydrated={hydrated} />
        </div>
      ) : (
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {CLUSTERS.map((c, i) => {
            const allNodes = NODES_BY_CLUSTER[c.id];
            const nodes = allNodes;
            if (nodes.length === 0) return null;
            return <PlaylistCard key={c.id} cluster={c} nodes={nodes} index={i} />;
          })}
        </div>
      )}

      <footer className="mt-16 border-t border-line pt-6">
        <MicroLabel>Retention over reach</MicroLabel>
      </footer>
    </div>
  );
}
