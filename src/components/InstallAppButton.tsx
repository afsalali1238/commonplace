import { useState } from "react";
import { useInstallPrompt, type InstallPlatform } from "@/hooks/useInstallPrompt";
import { MicroLabel } from "./MicroLabel";

const INSTRUCTIONS: Record<InstallPlatform, { title: string; steps: string[] }> = {
  ios: {
    title: "Add Commonplace to your Home Screen",
    steps: [
      "Tap the Share icon in Safari's toolbar.",
      'Scroll down and tap "Add to Home Screen".',
      'Tap "Add" to confirm.',
    ],
  },
  android: {
    title: "Add Commonplace to your Home Screen",
    steps: [
      "Tap the menu (⋮) in your browser.",
      'Tap "Add to Home screen" or "Install app".',
      "Confirm to add it.",
    ],
  },
  desktop: {
    title: "Install Commonplace",
    steps: [
      "Click the install icon in the address bar (or open the browser menu).",
      'Select "Install Commonplace".',
    ],
  },
  unknown: {
    title: "Add Commonplace to your Home Screen",
    steps: ["Open your browser's menu.", 'Look for "Add to Home screen" or "Install app".'],
  },
};

/**
 * Download-and-view-offline entry point. Installing puts the app on the
 * home screen and — combined with useOfflineWarmup pre-caching every
 * route — makes the whole map, every node, and Review usable with no
 * connection at all.
 */
export function InstallAppButton({ variant = "button" }: { variant?: "button" | "icon" }) {
  const { platform, isStandalone, canPrompt, promptInstall } = useInstallPrompt();
  const [showInstructions, setShowInstructions] = useState(false);

  // Already running as an installed app - nothing to offer.
  if (isStandalone) return null;

  async function handleClick() {
    if (canPrompt) {
      await promptInstall();
    } else {
      setShowInstructions(true);
    }
  }

  const copy = INSTRUCTIONS[platform];

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={handleClick}
          aria-label="Install app"
          title="Install app"
          className="flex h-11 w-11 shrink-0 items-center justify-center border border-line text-ink-soft transition-colors hover:border-ink hover:text-ink"
        >
          <span className="font-mono text-[14px]">⇩</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className="flex min-h-11 w-full items-center justify-between border border-line px-4 py-3 text-left hover:border-ink"
        >
          <span>
            <span className="font-serif text-base text-ink">Download for offline</span>
            <span className="mt-1 block font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
              Install the app — the feed, every node, and Review work with no connection
            </span>
          </span>
          <span className="font-mono text-lg text-accent">⇩</span>
        </button>
      )}

      {showInstructions && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-4 sm:items-center"
          onClick={() => setShowInstructions(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={copy.title}
            className="w-full max-w-sm border border-line bg-paper p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-serif text-xl text-ink">{copy.title}</h2>
              <button
                type="button"
                onClick={() => setShowInstructions(false)}
                aria-label="Close"
                className="shrink-0 font-mono text-lg text-ink-soft hover:text-ink"
              >
                ×
              </button>
            </div>
            <ol className="mt-4 flex flex-col gap-3">
              {copy.steps.map((step, i) => (
                <li key={step} className="flex gap-3 text-sm leading-relaxed text-ink">
                  <MicroLabel className="shrink-0">{i + 1}.</MicroLabel>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </>
  );
}
