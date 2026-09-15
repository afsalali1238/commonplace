// The Marginalia mark (docs/BRAND.md concept 1) as an inline component so it
// follows the light/dark theme tokens: the five arms take the surrounding
// text color (currentColor), the accent arm takes the accent token. Static
// contexts (favicon, app icons, OG images) keep the baked ink colors of
// public/logo.svg and the icon PNGs instead — those must stay readable
// outside the app's theming system.
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" role="img" aria-hidden="true" className={className}>
      <g stroke="currentColor" strokeWidth={14.8} strokeLinecap="round" fill="none">
        <line x1="50" y1="24.6" x2="50" y2="75.4" />
        <line x1="27.9" y1="37.3" x2="72.1" y2="62.7" />
        <line x1="27.9" y1="62.7" x2="72.1" y2="37.3" />
      </g>
      <line
        x1="50"
        y1="50"
        x2="72.1"
        y2="37.3"
        stroke="currentColor"
        strokeWidth={14.8}
        strokeLinecap="round"
        className="text-accent"
      />
    </svg>
  );
}
