import { useEffect, useRef, useState, useCallback } from "react";
import { useStore } from "@/lib/store";
import type { NodeIndex as Node } from "@/data/nodes";

/**
 * Real narration via the browser's Web Speech API (SpeechSynthesis).
 * Includes progress tracking, voice selection, and basic MediaSession integration.
 */
export function AudioBar({
  node,
  sentenceCount,
  l0Sents,
  l1Sents,
  onReachLayer1,
  onReachLayer2,
}: {
  node: Node;
  sentenceCount: number;
  /** Sentence-index boundaries, used to auto-reveal a layer's LayerReveal
   * panel just before narration starts reading into it, so what's
   * highlighted is never hidden behind a collapsed panel. */
  l0Sents?: number;
  l1Sents?: number;
  onReachLayer1?: () => void;
  onReachLayer2?: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const audioProgress = useStore((s) => s.audioProgress);
  const setAudioProgress = useStore((s) => s.setAudioProgress);

  const savedIdx = audioProgress[node.id] || 0;
  // Ensure we don't start past the end if content changed
  const initialIdx = savedIdx >= sentenceCount ? 0 : savedIdx;

  const [idx, setIdx] = useState(initialIdx);
  const [supported, setSupported] = useState(true);
  const ttsRate = useStore((s) => s.ttsRate);

  const ttsVoice = useStore((s) => s.ttsVoice);
  const setTtsVoice = useStore((s) => s.setTtsVoice);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  const idxRef = useRef(initialIdx);
  const stoppedRef = useRef(false);

  // A tiny silent audio element to keep iOS background context alive
  // and hook MediaSession controls effectively.
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);

    // Load voices
    const updateVoices = () => {
      const v = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
      setVoices(v);
    };
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      updateVoices();
      window.speechSynthesis.addEventListener("voiceschanged", updateVoices);
    }

    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.removeEventListener("voiceschanged", updateVoices);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      silentAudioRef.current = new Audio(
        "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA",
      );
      silentAudioRef.current.loop = true;
    }
  }, []);

  function setupMediaSession() {
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: node.title,
        artist: node.author,
        album: "Commonplace",
        artwork: [{ src: "/icon-512.png", sizes: "512x512", type: "image/png" }],
      });

      navigator.mediaSession.setActionHandler("play", () => toggle());
      navigator.mediaSession.setActionHandler("pause", () => toggle());
      navigator.mediaSession.setActionHandler("stop", () => {
        stop();
        setPlaying(false);
      });
    }
  }

  function sentenceEls(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>("[data-sentence]")).sort(
      (a, b) => Number(a.dataset.sentence) - Number(b.dataset.sentence),
    );
  }

  function highlight(active: number) {
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    sentenceEls().forEach((el) => {
      const i = Number(el.dataset.sentence);
      el.dataset.active = i === active ? "1" : "0";
      if (i === active) {
        el.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
      }
    });
  }

  function clearHighlight() {
    sentenceEls().forEach((el) => (el.dataset.active = "0"));
  }

  // Auto-open the layer panel a given sentence index lives in, so the
  // highlighted sentence is never hidden behind a collapsed panel. Uses >=
  // rather than an exact boundary match so resuming from a saved mid-layer
  // position (where the boundary-crossing moment isn't hit this mount)
  // still reveals the right panel.
  function revealForIndex(start: number) {
    if (l0Sents === undefined || l1Sents === undefined) return;
    if (start >= l0Sents + l1Sents) {
      onReachLayer1?.();
      onReachLayer2?.();
    } else if (start >= l0Sents) {
      onReachLayer1?.();
    }
  }

  function speakFrom(start: number) {
    const els = sentenceEls();
    if (start >= els.length) {
      finish();
      return;
    }
    stoppedRef.current = false;
    const u = new SpeechSynthesisUtterance(els[start].textContent ?? "");
    u.rate = ttsRate;

    if (ttsVoice && voices.length > 0) {
      const selected = voices.find((v) => v.voiceURI === ttsVoice);
      if (selected) u.voice = selected;
    }

    u.onstart = () => {
      idxRef.current = start;
      setIdx(start);
      highlight(start);
      // Save progress to store
      setAudioProgress(node.id, start);
      revealForIndex(start);
    };
    u.onend = () => {
      if (stoppedRef.current) return;
      const next = start + 1;
      if (next < els.length) speakFrom(next);
      else finish();
    };
    u.onerror = (e) => {
      console.error("Speech synthesis error", e);
      if (e.error === "interrupted" || stoppedRef.current) return;
      // On some errors (like iOS lock screen pause), we just pause UI
      setPlaying(false);
    };

    window.speechSynthesis.speak(u);
  }

  function finish() {
    // Flush any stray queued utterance defensively — nothing should be left
    // once the last sentence's onend has fired, but a rapid replay/toggle
    // race could otherwise leave the engine primed to speak again.
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    const finishedCount = sentenceEls().length;
    setPlaying(false);
    // Show the completed state (progress bar full, "N / N") instead of
    // snapping idx back to 0 — resetting idx immediately made a normal
    // finish visually indistinguishable from restarting from the top,
    // which read as the audio "looping back". idxRef still resets so the
    // next Play tap starts over from the beginning, as intended.
    setIdx(finishedCount);
    idxRef.current = 0;
    setAudioProgress(node.id, 0); // reset saved resume position on finish
    clearHighlight();
    silentAudioRef.current?.pause();
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "none";
    }
  }

  function stop() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    stoppedRef.current = true;
    window.speechSynthesis.cancel();
    silentAudioRef.current?.pause();
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "paused";
    }
  }

  function toggle() {
    if (!supported) return;
    if (playing) {
      setPlaying(false);
      stop();
    } else {
      setPlaying(true);
      silentAudioRef.current?.play().catch(() => {}); // Play silent track to keep alive
      setupMediaSession();
      if ("mediaSession" in navigator) {
        navigator.mediaSession.playbackState = "playing";
      }
      // If resuming into a still-collapsed layer2 panel, reveal it now and
      // defer speakFrom a tick — revealForIndex's setState needs to reach
      // the DOM before sentenceEls() can see the newly-mounted spans.
      const startAt = idxRef.current;
      revealForIndex(startAt);
      setTimeout(() => speakFrom(startAt), 0);
    }
  }

  // Stop speech if the component unmounts
  useEffect(() => stop, []);

  const total = Math.max(1, sentenceCount);
  const pct = playing ? ((idx + 1) / total) * 100 : (idx / total) * 100;

  return (
    <div className="fixed bottom-[64px] inset-x-0 z-30 border-t border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
        <button
          onClick={toggle}
          disabled={!supported}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-paper disabled:opacity-40"
          aria-label={playing ? "Pause narration" : "Play narration"}
        >
          {playing ? (
            <span className="font-mono text-xs">❚❚</span>
          ) : (
            <span className="ml-0.5 font-mono text-xs">▶</span>
          )}
        </button>
        <div className="flex-1">
          <div className="relative h-[2px] w-full bg-line">
            <div
              className="absolute inset-y-0 left-0 bg-accent transition-[width] duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between items-center font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft">
            <div className="flex items-center gap-2">
              <span>{supported ? "Listen" : "Audio not supported"}</span>
              {supported && voices.length > 0 && (
                <select
                  className="bg-transparent text-[10px] outline-none max-w-[100px] truncate"
                  value={ttsVoice || ""}
                  onChange={(e) => setTtsVoice(e.target.value)}
                  aria-label="Select voice"
                >
                  <option value="">Default Voice</option>
                  {voices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <span>
              {Math.min(idx + (playing ? 1 : 0), total)} / {total}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
