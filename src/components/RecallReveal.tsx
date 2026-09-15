import { useState, useId } from "react";
import { MicroLabel } from "./MicroLabel";

export function RecallReveal({ text }: { text: string }) {
  const [shown, setShown] = useState(false);
  const takeawayId = useId();

  return (
    <section className="mt-10 border-t border-line pt-8" aria-label="Takeaway recall">
      <MicroLabel>The takeaway — recall it first</MicroLabel>
      <button
        type="button"
        onClick={() => setShown(true)}
        disabled={shown}
        aria-expanded={shown}
        aria-controls={takeawayId}
        aria-label={shown ? "Takeaway revealed" : "Tap to reveal takeaway"}
        className="mt-3 block w-full text-left"
      >
        <p
          id={takeawayId}
          className={`font-serif text-2xl leading-snug transition-all duration-300 ${
            shown ? "" : "blur-md select-none"
          }`}
        >
          {text}
        </p>
        {!shown && (
          <span className="mt-3 inline-flex font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
            Tap to reveal
          </span>
        )}
      </button>
      {shown && (
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
          Just for you — the quiz below is what schedules this in Review.
        </p>
      )}
    </section>
  );
}
