import { useId } from "react";
import { arcPath, glyphSpec, plateSpec } from "@/lib/artwork";
import { cn } from "@/lib/utils";

/**
 * The two brand-artwork components. Both are pure SVG driven by
 * `lib/artwork.ts`, so they are identical on server and client, cost no
 * network bytes, and re-theme with the tokens (they draw in `currentColor`
 * and `var(--color-accent)`).
 *
 * Motion is opt-in per instance and lives in CSS (`plate-draw`,
 * `glyph-draw` utilities in styles.css) so `prefers-reduced-motion` can
 * switch it off globally in one place.
 */

export function TopicPlate({
  clusterId,
  className,
  animate = false,
  /** 0..1 — how much of the topic has been opened; lights the outer arcs. */
  progress = 0,
}: {
  clusterId: string;
  className?: string;
  animate?: boolean;
  progress?: number;
}) {
  const spec = plateSpec(clusterId);
  const lit = Math.round(Math.max(0, Math.min(1, progress)) * spec.arcs.length);
  const threadD = spec.thread.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      className={cn("block text-ink", animate && "plate-draw", className)}
    >
      <g fill="none" strokeLinecap="round">
        {spec.arcs.map((arc, i) => (
          <path
            key={i}
            d={arcPath(spec.cx, spec.cy, arc)}
            stroke={i < lit ? "var(--color-accent)" : "currentColor"}
            strokeOpacity={i < lit ? 0.85 : Math.max(0.14, 0.42 - i * 0.025)}
            strokeWidth={arc.weight}
            style={animate ? { animationDelay: `${i * 70}ms` } : undefined}
            className={animate ? "plate-arc" : undefined}
            pathLength={1}
          />
        ))}
        <path
          d={threadD}
          stroke="currentColor"
          strokeOpacity={0.5}
          strokeWidth={0.7}
          pathLength={1}
          className={animate ? "plate-thread" : undefined}
        />
      </g>
      <circle
        cx={spec.knot.x}
        cy={spec.knot.y}
        r={spec.knot.r}
        fill="var(--color-accent)"
        className={animate ? "plate-knot" : undefined}
      />
    </svg>
  );
}

export function IdeaGlyph({
  nodeId,
  className,
  animate = false,
  /** 0..1 — lights that share of the dots in accent (e.g. Leitner box / 5). */
  progress,
  title,
}: {
  nodeId: string;
  className?: string;
  animate?: boolean;
  progress?: number;
  title?: string;
}) {
  const spec = glyphSpec(nodeId);
  const id = useId();
  const litCount =
    progress === undefined
      ? 0
      : Math.round(Math.max(0, Math.min(1, progress)) * spec.points.length);
  const litIndex = new Set<number>();
  // Light dots starting from the accent dot and walking the thread, so a
  // half-lit glyph reads as "half the way along", not scattered.
  if (litCount > 0) {
    const order = [spec.accent];
    for (const [a, b] of spec.edges) {
      if (!order.includes(a)) order.push(a);
      if (!order.includes(b)) order.push(b);
    }
    order.slice(0, litCount).forEach((i) => litIndex.add(i));
  }
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden={title ? undefined : "true"}
      role={title ? "img" : undefined}
      focusable="false"
      className={cn("block text-ink", animate && "glyph-draw", className)}
    >
      {title && <title id={id}>{title}</title>}
      <g
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.45}
        strokeWidth={0.8}
        strokeLinecap="round"
      >
        {spec.edges.map(([a, b], i) => (
          <line
            key={i}
            x1={spec.points[a][0]}
            y1={spec.points[a][1]}
            x2={spec.points[b][0]}
            y2={spec.points[b][1]}
            pathLength={1}
            className={animate ? "glyph-edge" : undefined}
            style={animate ? { animationDelay: `${i * 90}ms` } : undefined}
          />
        ))}
      </g>
      {spec.points.map(([x, y], i) => {
        const accent = i === spec.accent || litIndex.has(i);
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={accent ? 1.9 : 1.3}
            fill={accent ? "var(--color-accent)" : "currentColor"}
            fillOpacity={accent ? 1 : 0.75}
            className={animate ? "glyph-dot" : undefined}
            style={animate ? { animationDelay: `${120 + i * 60}ms` } : undefined}
          />
        );
      })}
    </svg>
  );
}
