import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CLUSTERS, NODES_BY_CLUSTER } from "@/data/nodes";
import { Bone } from "@/components/Skeleton";

const DEFAULT_VISIBLE = 8;

/**
 * The Lattice Index — the Map screen's "browse clusters" job (see
 * docs/PRODUCT-BRIEF.md §7.1). Every cluster is one row on a single
 * continuous thread; each row's knot is a live conic-gradient dial of how
 * much of that cluster has been opened. The thread is the literal
 * "latticework" the app is named for, not a decorative rule — read top to
 * bottom, it's the shape of what's left.
 *
 * Collapsed to the first 8 clusters by default: the brief explicitly warns
 * against dropping the user onto a wall of equal choices, so the
 * full 38-cluster breadth is one deliberate tap away ("Show all") rather than
 * forced on every visit to the home screen.
 */
export function LatticeIndex({
  visited,
  hydrated,
}: {
  visited: Record<string, boolean>;
  hydrated: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleClusters = expanded ? CLUSTERS : CLUSTERS.slice(0, DEFAULT_VISIBLE);
  const remaining = CLUSTERS.length - DEFAULT_VISIBLE;

  const totalNodes = CLUSTERS.reduce((sum, c) => sum + (NODES_BY_CLUSTER[c.id]?.length ?? 0), 0);
  const totalVisited = hydrated
    ? CLUSTERS.reduce(
        (sum, c) => sum + (NODES_BY_CLUSTER[c.id] ?? []).filter((n) => visited[n.id]).length,
        0,
      )
    : 0;

  return (
    <section aria-labelledby="lattice-index-heading">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="lattice-index-heading" className="font-serif text-2xl leading-tight text-ink">
          The Lattice
        </h2>
        {hydrated ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
            {totalVisited} of {totalNodes} opened
          </p>
        ) : (
          <Bone className="h-3 w-24 rounded-full" />
        )}
      </div>
      <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
        {CLUSTERS.length} clusters, every idea on the map
      </p>

      <ul className="mt-6 flex flex-col">
        {visibleClusters.map((cluster, i) => {
          const nodes = NODES_BY_CLUSTER[cluster.id] ?? [];
          const total = nodes.length;
          const visitedCount = hydrated ? nodes.filter((n) => visited[n.id]).length : 0;
          const pct = total > 0 ? Math.round((visitedCount / total) * 100) : 0;
          const isFirst = i === 0;
          const isLastVisible = i === visibleClusters.length - 1;

          return (
            <li key={cluster.id} className="settle" style={{ "--i": i } as React.CSSProperties}>
              {/* resetScroll={false}: the router's own scroll restoration
                  (enabled in router.tsx) resets scroll to top on every
                  navigation by default, which fires after commit and wins
                  the race against ClusterSection's deep-link scrollIntoView
                  - the target section opened but the viewport stayed at the
                  top. Turning it off here leaves scroll entirely to that
                  effect for this specific navigation. */}
              <Link
                to="/explore"
                search={{ cluster: cluster.id }}
                resetScroll={false}
                className="group flex min-h-11 items-stretch gap-3 outline-none"
                aria-label={`${cluster.title}, ${total} ideas, ${visitedCount} opened`}
              >
                <span aria-hidden="true" className="flex w-5 shrink-0 flex-col items-center">
                  <span className={`w-px flex-1 ${isFirst ? "bg-transparent" : "bg-line"}`} />
                  <span
                    className="my-[3px] h-2.5 w-2.5 shrink-0 rounded-full border border-line transition-[background,border-color] duration-[var(--duration-slow)] ease-[var(--ease-out)] group-hover:border-accent"
                    style={{
                      backgroundImage:
                        pct > 0
                          ? `conic-gradient(var(--color-accent) ${pct}%, var(--color-paper) 0)`
                          : undefined,
                    }}
                  />
                  <span
                    className={`w-px flex-1 ${isLastVisible && !expanded ? "bg-transparent" : "bg-line"}`}
                  />
                </span>

                <span className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-sm border-b border-line py-2.5 pr-2 pl-1 transition-colors duration-[var(--duration-fast)] group-last:border-b-0 group-hover:border-ink group-hover:bg-line/25 group-focus-visible:border-ink">
                  <span className="truncate font-serif text-base leading-snug text-ink group-hover:text-accent">
                    {cluster.title}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-ink-soft">{total}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {remaining > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="group mt-1 flex min-h-11 w-full items-center gap-3 outline-none"
        >
          <span aria-hidden="true" className="flex w-5 shrink-0 flex-col items-center">
            <span className="w-px flex-1 bg-line" />
            <span className="my-[3px] flex h-2.5 w-2.5 shrink-0 items-center justify-center rounded-full border border-line text-[9px] leading-none text-ink-soft group-hover:border-accent group-hover:text-accent">
              {expanded ? "–" : "+"}
            </span>
            <span className="w-px flex-1 bg-transparent" />
          </span>
          <span className="border-b border-line py-2.5 pr-2 pl-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft transition-colors duration-[var(--duration-fast)] group-hover:border-ink group-hover:text-accent">
            {expanded ? "Show fewer" : `Show ${remaining} more clusters`}
          </span>
        </button>
      )}
    </section>
  );
}
