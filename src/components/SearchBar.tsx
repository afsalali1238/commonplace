import { useEffect, useState, useMemo, useId, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { NODES } from "@/data/nodes";
import { MicroLabel } from "./MicroLabel";
import MiniSearch from "minisearch";

// Lazy, non-blocking index build — defers the ~450-node MiniSearch
// construction until after first paint (or first focus), so the feed's
// initial interaction isn't janked by text indexing work.
//
// Indexes the bundled index only. layer1/layer2 live in the on-demand body
// files (lib/bodies.ts) and aren't searched — title + thesis + layer0 is
// what a query is realistically matching anyway; the deeper layers mostly
// re-use those terms. Revisit if search misses show up in feedback.
let sharedIndex: MiniSearch | null = null;
let indexing: Promise<MiniSearch> | null = null;

function getSearchIndex(): Promise<MiniSearch> {
  if (sharedIndex) return Promise.resolve(sharedIndex);
  if (indexing) return indexing;
  indexing = new Promise((resolve) => {
    const build = () => {
      const ms = new MiniSearch({
        fields: ["title", "author", "thesis", "layer0"],
        storeFields: ["id", "title", "author", "year"],
        searchOptions: { boost: { title: 2, author: 1.5 } },
      });
      ms.addAll(NODES);
      sharedIndex = ms;
      resolve(ms);
    };
    // Use idle time if available, otherwise next tick
    const win = window as unknown as { requestIdleCallback?: (cb: () => void) => number };
    if (typeof win.requestIdleCallback === "function") {
      win.requestIdleCallback(build);
    } else {
      setTimeout(build, 0);
    }
  });
  return indexing;
}

export function SearchBar() {
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const [index, setIndex] = useState<MiniSearch | null>(sharedIndex);
  const [indexingState, setIndexingState] = useState(false);
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  // Start building index lazily — on mount via idle, or immediately on focus
  useEffect(() => {
    if (index) return;
    let cancelled = false;
    setIndexingState(true);
    getSearchIndex().then((ms) => {
      if (!cancelled) {
        setIndex(ms);
        setIndexingState(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [index]);

  const ensureIndex = () => {
    if (!index && !indexing) {
      setIndexingState(true);
      getSearchIndex().then((ms) => {
        setIndex(ms);
        setIndexingState(false);
      });
    }
  };

  const trimmed = q.trim();
  // Debounce input by 80ms (cheap, avoids search on every keystroke)
  const [debounced, setDebounced] = useState(trimmed);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(trimmed), 80);
    return () => window.clearTimeout(t);
  }, [trimmed]);

  const results = useMemo(() => {
    if (!index) return [];
    if (debounced.length < 2) return [];
    try {
      return index.search(debounced, { prefix: true, fuzzy: 0.2 }).slice(0, 8);
    } catch {
      return [];
    }
  }, [index, debounced]);

  const showPanel = focused && trimmed.length >= 2;
  const hasResults = results.length > 0;

  return (
    <div className="relative">
      <label htmlFor="lattice-search" className="sr-only">
        Search ideas, authors, and themes
      </label>
      <input
        ref={inputRef}
        id="lattice-search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => {
          setFocused(true);
          ensureIndex();
        }}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder={indexingState ? "Indexing ideas…" : "Search ideas, authors, themes…"}
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        aria-autocomplete="list"
        aria-busy={indexingState}
        autoComplete="off"
        className="w-full border-b border-line bg-transparent py-3 font-serif text-lg text-ink placeholder:text-ink-soft/60 transition-colors duration-[var(--duration-fast)] focus:border-ink focus-visible:outline-none disabled:opacity-60"
      />

      {/* Announces result count to screen readers without moving focus. */}
      <p className="sr-only" role="status" aria-live="polite">
        {showPanel
          ? !index
            ? "Search index loading"
            : hasResults
              ? `${results.length} result${results.length === 1 ? "" : "s"} for ${debounced}`
              : `No results for ${debounced}`
          : ""}
      </p>

      {showPanel && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Search results"
          className="absolute inset-x-0 top-full z-20 mt-2 border border-line bg-paper shadow-[var(--shadow-raised)]"
        >
          {!index ? (
            <div className="px-4 py-4 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
              Indexing… try again in a moment
            </div>
          ) : hasResults ? (
            results.map((n) => (
              <Link
                key={n.id}
                to="/node/$id"
                params={{ id: n.id }}
                role="option"
                aria-selected={false}
                onClick={() => setQ("")}
                className="block border-b border-line px-4 py-3 outline-none last:border-b-0 hover:bg-line/40 focus-visible:bg-line/40"
              >
                <div className="font-serif text-base text-ink">{n.title}</div>
                <MicroLabel className="mt-1 block">
                  {n.author} · {n.year}
                </MicroLabel>
              </Link>
            ))
          ) : (
            <div className="px-4 py-4">
              <p className="font-serif text-base text-ink">No matches for “{trimmed}.”</p>
              <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                Try an author, a title, or a theme like “compounding”
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
