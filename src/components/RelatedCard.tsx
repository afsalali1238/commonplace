import { Link } from "@tanstack/react-router";
import type { NodeIndex as Node } from "@/data/nodes";
import { CLUSTER_BY_ID } from "@/data/nodes";
import { MicroLabel } from "./MicroLabel";
import { useStore } from "@/lib/store";
import { useHydrated } from "@/lib/hydrated";

export function RelatedCard({ node }: { node: Node }) {
  const cluster = CLUSTER_BY_ID[node.clusterId];
  const hydrated = useHydrated();
  const gotIt = useStore((s) => s.gotIt[node.id]);
  const visited = useStore((s) => s.visited[node.id]);
  return (
    <Link
      to="/node/$id"
      params={{ id: node.id }}
      className="group block border-t border-line py-5 first:border-t-0"
    >
      <div className="flex items-center justify-between gap-2">
        <MicroLabel>{cluster?.title}</MicroLabel>
        {hydrated &&
          (gotIt ? (
            <span className="font-mono text-[11px] text-accent">✓</span>
          ) : visited ? (
            <span
              title="Opened, not yet mastered"
              className="h-1.5 w-1.5 rounded-full bg-ink-soft"
            />
          ) : null)}
      </div>
      <h4 className="mt-2 font-serif text-xl leading-snug text-ink group-hover:text-accent">
        {node.title}
      </h4>
      <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
        {node.author} · {node.year} · {node.medium}
      </p>
      <p className="mt-2 text-sm text-ink-soft leading-relaxed">{node.thesis}</p>
      <span className="mt-3 inline-flex font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
        Follow the thread →
      </span>
    </Link>
  );
}
