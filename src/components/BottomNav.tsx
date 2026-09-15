import { Link, useLocation } from "@tanstack/react-router";
import { MAIN_TABS } from "@/lib/mainRoutes";
import { useStore, dueCount } from "@/lib/store";
import { useHydrated } from "@/lib/hydrated";

export function BottomNav() {
  const { pathname } = useLocation();
  const review = useStore((s) => s.review);
  const hydrated = useHydrated();
  // The count lives in the persisted store, so it only exists client-side —
  // rendering it before hydration would mismatch the SSR markup.
  const due = hydrated ? dueCount(review) : 0;
  const tabs = MAIN_TABS;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl">
        {tabs.map((t) => {
          const active = t.match(pathname);
          const showDueBadge = "badge" in t && t.badge === "due" && due > 0;
          return (
            <Link
              key={t.to}
              to={t.to}
              aria-label={showDueBadge ? `${t.label}, ${due} due` : t.label}
              aria-current={active ? "page" : undefined}
              className="relative flex flex-1 flex-col items-center justify-center gap-1 py-3 min-h-14"
            >
              <span
                className={`relative font-mono text-[11px] uppercase tracking-[0.18em] ${
                  active ? "text-accent" : "text-ink-soft"
                }`}
              >
                {t.label}
                {showDueBadge && (
                  <span
                    aria-hidden="true"
                    className="absolute -right-5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 font-mono text-[9px] leading-none text-paper"
                  >
                    {due > 99 ? "99+" : due}
                  </span>
                )}
              </span>
              {active && <span className="absolute inset-x-6 top-0 h-px bg-accent" />}
            </Link>
          );
        })}
      </div>
      <div style={{ height: "env(safe-area-inset-bottom)" }} />
    </nav>
  );
}
