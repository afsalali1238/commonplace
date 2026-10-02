import { MARK_ARMS, MARK_STROKE_WIDTH } from "@/lib/brandMark";

// The Marginalia mark (docs/BRAND.md §3) as an inline component so it
// follows the light/dark theme tokens: the ink arms take the surrounding
// text color (currentColor), the accent arm takes the accent token. Static
// contexts (favicon, app icons, OG image) are generated from the same
// geometry in lib/brandMark.ts with baked colours instead — those must stay
// readable outside the app's theming system.
const INK_ARMS = MARK_ARMS.filter((a) => !a.accent);
const ACCENT_ARMS = MARK_ARMS.filter((a) => a.accent);

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" role="img" aria-hidden="true" className={className}>
      <g stroke="currentColor" strokeWidth={MARK_STROKE_WIDTH} strokeLinecap="round" fill="none">
        {INK_ARMS.map((a, i) => (
          <line key={i} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} />
        ))}
      </g>
      {ACCENT_ARMS.map((a, i) => (
        <line
          key={i}
          x1={a.x1}
          y1={a.y1}
          x2={a.x2}
          y2={a.y2}
          stroke="currentColor"
          strokeWidth={MARK_STROKE_WIDTH}
          strokeLinecap="round"
          className="text-accent"
        />
      ))}
    </svg>
  );
}
