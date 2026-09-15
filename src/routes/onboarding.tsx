import { useMemo, useState } from "react";
import {
  Bookmark,
  Check,
  HelpCircle,
  Plus,
  MousePointerClick,
  Headphones,
  Download,
} from "lucide-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MicroLabel } from "@/components/MicroLabel";
import { BrandMark } from "@/components/BrandMark";
import { InstallAppButton } from "@/components/InstallAppButton";
import { NODES, TAGS } from "@/data/nodes";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Welcome — Commonplace" },
      { name: "description", content: "Pick a few things you care about to personalize your map." },
    ],
  }),
  component: OnboardingScreen,
});

const MIN_PICKS = 2;

function OnboardingScreen() {
  const navigate = useNavigate();
  const completeOnboarding = useStore((s) => s.completeOnboarding);
  const skipOnboarding = useStore((s) => s.skipOnboarding);
  const [picked, setPicked] = useState<string[]>([]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    NODES.forEach((n) =>
      n.tags.forEach((t) => {
        c[t] = (c[t] ?? 0) + 1;
      }),
    );
    return c;
  }, []);

  const [step, setStep] = useState<1 | 2>(1);

  function toggle(tag: string) {
    setPicked((p) => (p.includes(tag) ? p.filter((t) => t !== tag) : [...p, tag]));
  }

  function finish() {
    completeOnboarding(picked);
    navigate({ to: "/" });
  }

  function skip() {
    if (step === 1) {
      setStep(2);
    } else {
      skipOnboarding();
      navigate({ to: "/" });
    }
  }

  const canContinue = picked.length >= MIN_PICKS;

  return (
    <>
      <div className="fixed inset-0 overflow-hidden pointer-events-none flex items-center justify-center opacity-[0.03]">
        <BrandMark className="w-[120vw] h-[120vw] max-w-none animate-[spin_120s_linear_infinite]" />
      </div>
      <div className="relative z-10 flex min-h-screen flex-col px-5 pt-12 pb-8">
        {step === 1 ? (
          <>
            <div className="rise">
              <MicroLabel>Welcome</MicroLabel>
              <h1 className="mt-3 font-serif text-4xl leading-[1.1] text-ink">
                Let's look into Commonplace
              </h1>
            </div>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-soft">
              Choose your rabbit holes. Pick at least {MIN_PICKS} to start your descent into the
              lattice. Don't worry, you can always change course later.
            </p>

            <div className="mt-8 flex flex-1 flex-wrap content-start gap-2">
              {TAGS.map((t, i) => {
                const on = picked.includes(t);
                const count = counts[t] ?? 0;
                return (
                  <button
                    key={t}
                    onClick={() => toggle(t)}
                    aria-pressed={on}
                    style={{ "--i": Math.floor(i / 3) } as React.CSSProperties}
                    className={cn(
                      "settle min-h-11 border px-4 py-2.5 text-left font-serif text-sm leading-snug transition-[background-color,border-color,color,transform] duration-[var(--duration-fast)] active:scale-[0.98]",
                      on && "border-ink bg-ink text-paper",
                      !on &&
                        "border-line bg-transparent text-ink-soft hover:border-ink/30 hover:text-ink",
                    )}
                  >
                    {t}
                    <span
                      className={cn(
                        "ml-2 font-mono text-[10px] uppercase tracking-[0.14em]",
                        on ? "text-paper/70" : "text-ink-soft",
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="sticky bottom-0 mt-10 border-t border-line bg-paper pt-5">
              <div className="flex items-center justify-between">
                <MicroLabel>
                  {picked.length} selected
                  {!canContinue && picked.length > 0
                    ? ` · pick ${MIN_PICKS - picked.length} more`
                    : ""}
                </MicroLabel>
                <button
                  onClick={skip}
                  className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft hover:text-ink"
                >
                  Skip for now
                </button>
              </div>
              <button
                onClick={() => setStep(2)}
                disabled={!canContinue}
                className="mt-4 w-full border border-ink bg-ink py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-paper disabled:opacity-30"
              >
                Continue →
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="rise">
              <MicroLabel>How it works</MicroLabel>
              <h1 className="mt-3 font-serif text-4xl leading-[1.1] text-ink">
                Read, save, master
              </h1>
            </div>

            <div className="mt-12 flex-1 space-y-8">
              <div className="settle flex gap-4" style={{ "--i": 1 } as React.CSSProperties}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-ink bg-ink text-paper">
                  <MousePointerClick className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-serif text-lg text-ink">Tap to open</h3>
                  <p className="mt-1 text-sm text-ink-soft">
                    Tap any card, anywhere, to open the full idea — the layers, the sources, the
                    quiz.
                  </p>
                </div>
              </div>

              <div className="settle flex gap-4" style={{ "--i": 2 } as React.CSSProperties}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-line bg-paper text-ink">
                  <Bookmark className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-serif text-lg text-ink">Save for later</h3>
                  <p className="mt-1 text-sm text-ink-soft">
                    Build your personal library of ideas.
                  </p>
                </div>
              </div>

              <div className="settle flex gap-4" style={{ "--i": 3 } as React.CSSProperties}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-line bg-paper text-ink">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-serif text-lg text-ink">Read next</h3>
                  <p className="mt-1 text-sm text-ink-soft">Queue ideas to read immediately.</p>
                </div>
              </div>

              <div className="settle flex gap-4" style={{ "--i": 4 } as React.CSSProperties}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-line bg-paper text-ink">
                  <Check className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-serif text-lg text-ink">Got it</h3>
                  <p className="mt-1 text-sm text-ink-soft">
                    Mark ideas you've mastered for spaced repetition.
                  </p>
                </div>
              </div>

              <div className="settle flex gap-4" style={{ "--i": 5 } as React.CSSProperties}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-line bg-paper text-ink">
                  <HelpCircle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-serif text-lg text-ink">Quiz</h3>
                  <p className="mt-1 text-sm text-ink-soft">
                    Test your understanding of complex topics.
                  </p>
                </div>
              </div>

              <div className="settle flex gap-4" style={{ "--i": 6 } as React.CSSProperties}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-line bg-paper text-ink">
                  <Headphones className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-serif text-lg text-ink">Listen</h3>
                  <p className="mt-1 text-sm text-ink-soft">
                    Every idea can be read aloud — open a card and hit play to listen instead.
                  </p>
                </div>
              </div>

              <div className="settle flex gap-4" style={{ "--i": 7 } as React.CSSProperties}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-line bg-paper text-ink">
                  <Download className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-serif text-lg text-ink">Install for offline</h3>
                  <p className="mt-1 text-sm text-ink-soft">
                    Add Commonplace to your home screen — the feed, every node, and Review work with
                    no connection.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <InstallAppButton />
            </div>

            <div className="sticky bottom-0 mt-6 border-t border-line bg-paper pt-5">
              <button
                onClick={finish}
                className="w-full border border-ink bg-ink py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-paper transition-opacity hover:opacity-90"
              >
                Got it, let's go
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
