import { cn } from "@/lib/utils";

/**
 * Hydration placeholders. Several screens can't render real content until
 * the persisted store has loaded (feed order, due queue, progress), and
 * used to return an empty div for that first frame — a white flash between
 * the SSR shell and the content. These draw the *shape* of what's coming in
 * the paper/line tokens with a slow shimmer, so the wait reads as loading
 * rather than broken. Marked aria-busy so assistive tech knows it's
 * transient.
 */

export function Bone({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("shimmer block rounded-sm", className)} />;
}

export function FeedSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading your feed" className="flex flex-col h-[100dvh]">
      <header className="shrink-0 flex items-center justify-between px-5 py-2.5">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="" className="h-6 w-6 spiral-spin" />
          <span className="font-serif text-lg tracking-tight text-ink">Unknown</span>
        </div>
        <Bone className="h-3 w-14" />
      </header>
      <div className="flex-1 px-5 py-6">
        <div className="flex items-center gap-2">
          <Bone className="h-6 w-6 rounded-full" />
          <Bone className="h-3 w-40" />
        </div>
        <Bone className="mt-6 h-8 w-11/12" />
        <Bone className="mt-3 h-8 w-3/4" />
        <div className="mt-6 space-y-3">
          <Bone className="h-4 w-full" />
          <Bone className="h-4 w-full" />
          <Bone className="h-4 w-5/6" />
          <Bone className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  );
}

export function ScreenSkeleton({ title }: { title?: string }) {
  return (
    <div aria-busy="true" className="px-5 pt-8">
      {title ? (
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">{title}</p>
      ) : (
        <Bone className="h-3 w-20" />
      )}
      <Bone className="mt-4 h-9 w-2/3" />
      <div className="mt-8 space-y-3">
        <Bone className="h-4 w-full" />
        <Bone className="h-4 w-11/12" />
        <Bone className="h-4 w-3/4" />
      </div>
    </div>
  );
}
