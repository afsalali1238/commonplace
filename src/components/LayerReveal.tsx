import { useEffect, useState, type ReactNode } from "react";
import { MicroLabel } from "./MicroLabel";
import { cn } from "@/lib/utils";

export function LayerReveal({
  label,
  children,
  onReveal,
  revealSignal = 0,
}: {
  label: string;
  children: ReactNode;
  onReveal?: () => void;
  /** External open trigger — bumping it (e.g. when audio narration reaches
   * this layer) forces the panel open so the spoken text is never hidden
   * behind a collapsed panel. 0 (default) = fully self-managed. */
  revealSignal?: number;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (revealSignal > 0) setOpen(true);
  }, [revealSignal]);

  return (
    <div className="w-full">
      {!open && (
        <button
          onClick={() => {
            setOpen(true);
            onReveal?.();
          }}
          className="mt-8 flex w-full items-center justify-between border-y border-line py-4 text-left transition-colors hover:bg-line/40"
        >
          <MicroLabel className="text-accent">{label}</MicroLabel>
          <span className="font-mono text-lg text-accent">↓</span>
        </button>
      )}
      <div
        className={cn(
          "grid transition-all duration-500 ease-in-out",
          open ? "mt-8 grid-rows-[1fr] opacity-100" : "mt-0 grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-line pt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
