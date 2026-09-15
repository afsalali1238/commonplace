import { useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MicroLabel } from "@/components/MicroLabel";
import { InstallAppButton } from "@/components/InstallAppButton";
import { useStore, currentStreak, todayISO, dueCount } from "@/lib/store";
import { useHydrated } from "@/lib/hydrated";
import { NODES, NODE_BY_ID, TAGS } from "@/data/nodes";
import { cn } from "@/lib/utils";
import {
  Target,
  BarChart3,
  BookOpen,
  Heart,
  Headphones,
  Bookmark,
  Library,
  PenTool,
  CloudOff,
  Archive,
  ArrowRight,
  RotateCcw,
  SunMoon,
} from "lucide-react";

export const Route = createFileRoute("/you")({
  head: () => ({
    meta: [
      { title: "You — Commonplace" },
      { name: "description", content: "Streak, stats, bookmarks, glossary, and backup." },
    ],
  }),
  component: YouScreen,
});

function YouScreen() {
  const hydrated = useHydrated();
  const state = useStore();
  const streak = hydrated ? currentStreak(state.streakDays) : 0;
  const learned = Object.values(state.gotIt).filter(Boolean).length;
  const inReview = Object.keys(state.review).length;
  const mastered = Object.values(state.review).filter((r) => r.box >= 4).length;
  const bookmarked = Object.entries(state.bookmarks)
    .filter(([, v]) => v)
    .map(([id]) => NODE_BY_ID[id])
    .filter(Boolean);

  return (
    <div className="px-5 pt-8 pb-10 space-y-12">
      <header>
        <MicroLabel>You</MicroLabel>
        <h1 className="mt-2 font-serif text-4xl text-ink">Your practice</h1>
      </header>

      <Section title="Daily Goal" icon={Target}>
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-6xl text-accent leading-none">
              {hydrated ? state.dailyProgress[todayISO()] || 0 : 0}
            </span>
            <span className="font-mono text-2xl text-ink-soft leading-none">
              / {hydrated ? state.dailyGoal : 3}
            </span>
            <MicroLabel>nodes learned today</MicroLabel>
          </div>
          <div className="h-2 w-full bg-line overflow-hidden mt-2">
            <div
              className="h-full bg-accent transition-all duration-500 ease-out"
              style={{
                width: `${Math.min(100, ((hydrated ? state.dailyProgress[todayISO()] || 0 : 0) / (hydrated ? state.dailyGoal : 3)) * 100)}%`,
              }}
            />
          </div>
          {hydrated && (state.dailyProgress[todayISO()] || 0) >= state.dailyGoal && (
            <p className="text-xs text-accent mt-1 animate-in fade-in slide-in-from-bottom-2">
              Daily goal achieved! Great work.
            </p>
          )}
        </div>
      </Section>

      <Section title="Streak" icon={BarChart3}>
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-6xl text-ink leading-none">{streak}</span>
          <MicroLabel>consecutive days</MicroLabel>
        </div>
        <div className="mt-5 flex gap-1">
          {last14Days().map((d) => {
            const on = hydrated && state.streakDays.includes(d);
            return (
              <div key={d} title={d} className={cn("h-2 flex-1", on ? "bg-ink" : "bg-line")} />
            );
          })}
        </div>
      </Section>

      <Section title="Stats" index={3} icon={BarChart3}>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Learned" value={learned} hydrated={hydrated} />
          <Stat label="In review" value={inReview} hydrated={hydrated} />
          <Stat label="Mastered" value={mastered} hydrated={hydrated} />
        </div>
      </Section>

      <Reading />

      <ReviewSection />

      <Interests />
      <AppearanceSection />
      <AudioPreferences />

      <Section title="Saved" icon={Bookmark}>
        {!hydrated ? (
          <Bone className="h-24 border border-line" />
        ) : bookmarked.length === 0 ? (
          <div className="border border-line border-dashed p-6 text-center">
            <p className="font-serif text-lg text-ink">Nothing saved yet.</p>
            <p className="mt-2 text-sm text-ink-soft">
              Save ideas from any node to build your library here.
            </p>
            <Link
              to="/"
              className="mt-4 inline-block bg-ink text-paper px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em]"
            >
              Open the feed
            </Link>
          </div>
        ) : (
          <ul className="space-y-1">
            {bookmarked.map((n) => (
              <li key={n.id}>
                <Link
                  to="/node/$id"
                  params={{ id: n.id }}
                  className="block border-b border-line py-3"
                >
                  <span className="font-serif text-lg text-ink">{n.title}</span>
                  <MicroLabel className="ml-2">{n.author}</MicroLabel>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Glossary />
      <Scratchpad />
      <Offline />
      <Backup />
    </div>
  );
}

function Reading() {
  const hydrated = useHydrated();
  const visited = useStore((s) => s.visited);
  const readLog = useStore((s) => s.readLog);
  const lastNodeId = useStore((s) => s.lastNodeId);

  const readCount = Object.values(visited).filter(Boolean).length;
  const total = NODES.length;
  const left = Math.max(0, total - readCount);
  const pct = total ? Math.round((readCount / total) * 100) : 0;
  const cont = hydrated && lastNodeId ? NODE_BY_ID[lastNodeId] : null;
  const recent = hydrated
    ? [...readLog]
        .reverse()
        .map((id) => NODE_BY_ID[id])
        .filter(Boolean)
        .slice(0, 8)
    : [];

  return (
    <Section title="Reading" index={4} icon={BookOpen}>
      {!hydrated ? (
        <Bone className="h-16 border border-line" />
      ) : (
        <>
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-4xl text-accent leading-none">{readCount}</span>
            <MicroLabel>
              of {total} read · {left} left · {pct}%
            </MicroLabel>
          </div>
          <div className="mt-3 h-1.5 w-full bg-line">
            <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
          </div>

          {cont && (
            <Link
              to="/node/$id"
              params={{ id: cont.id }}
              className="mt-5 block border border-line p-4 hover:border-ink"
            >
              <MicroLabel>Continue</MicroLabel>
              <p className="mt-1 font-serif text-lg text-ink">{cont.title}</p>
              <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                {cont.author}
              </p>
            </Link>
          )}

          {recent.length > 0 && (
            <div className="mt-6">
              <MicroLabel>Recently read</MicroLabel>
              <ul className="mt-2 space-y-1">
                {recent.map((n) => (
                  <li key={n.id}>
                    <Link
                      to="/node/$id"
                      params={{ id: n.id }}
                      className="flex items-baseline justify-between gap-2 border-b border-line py-2"
                    >
                      <span className="truncate font-serif text-ink">{n.title}</span>
                      <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                        {n.clusterId}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {readCount === 0 && (
            <p className="mt-4 text-sm text-ink-soft">
              Nothing read yet — open an idea from your feed to start.
            </p>
          )}
        </>
      )}
    </Section>
  );
}

// Review is a bottom-nav tab (with the due badge) — this section is the
// progress view of the same queue: how it's distributed across the Leitner
// boxes, plus a link through. It deliberately doesn't restate the mechanic
// the tab already explains.
function ReviewSection() {
  const hydrated = useHydrated();
  const review = useStore((s) => s.review);
  const due = hydrated ? dueCount(review) : 0;
  const entries = Object.values(review);
  const total = entries.length;
  const boxes = [0, 1, 2, 3, 4, 5].map((b) => entries.filter((r) => r.box === b).length);
  const max = Math.max(1, ...boxes);

  return (
    <Section title="Review" index={5} icon={RotateCcw}>
      <Link
        to="/review"
        className="flex items-center justify-between border border-line p-4 hover:border-ink"
      >
        <div>
          <p className="font-serif text-lg text-ink">
            {!hydrated
              ? "Review queue"
              : due > 0
                ? `${due} due now`
                : total > 0
                  ? "All caught up"
                  : "Nothing in review yet"}
          </p>
          <MicroLabel>{total} tracked</MicroLabel>
        </div>
        <ArrowRight className="h-4 w-4 text-ink-soft" />
      </Link>
      {hydrated && total > 0 && (
        <div className="mt-4">
          <MicroLabel>Leitner boxes · 0 = just learned, 5 = 35-day interval</MicroLabel>
          <div className="mt-2 flex items-end gap-1" aria-hidden="true">
            {boxes.map((count, b) => (
              <div key={b} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-10 w-full items-end">
                  <div
                    className={cn(
                      "w-full origin-bottom transition-[height] duration-[var(--duration-slow)] ease-[var(--ease-out)]",
                      b >= 4 ? "bg-accent" : "bg-ink",
                    )}
                    style={{ height: `${Math.max(count > 0 ? 8 : 2, (count / max) * 100)}%` }}
                  />
                </div>
                <span className="font-mono text-[10px] text-ink-soft">{b}</span>
              </div>
            ))}
          </div>
          <p className="sr-only">{boxes.map((c, b) => `box ${b}: ${c}`).join(", ")}</p>
        </div>
      )}
    </Section>
  );
}

function Section({
  title,
  icon: Icon,
  children,
  index,
}: {
  title: string;
  icon?: React.ElementType;
  children: React.ReactNode;
  /** Position on the page; sections settle in top-to-bottom. */
  index?: number;
}) {
  return (
    <section
      className="settle border-t border-line pt-6"
      style={{ "--i": index ?? 0 } as React.CSSProperties}
    >
      <div className="flex items-center gap-2 text-ink-soft">
        {Icon && <Icon className="w-4 h-4" />}
        <MicroLabel>{title}</MicroLabel>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Stat({ label, value, hydrated }: { label: string; value: number; hydrated: boolean }) {
  return (
    <div className="border border-line p-3">
      {hydrated ? (
        <p className="font-mono text-3xl text-ink leading-none">{value}</p>
      ) : (
        <Bone className="h-7 w-8" />
      )}
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft">
        {label}
      </p>
    </div>
  );
}

function Interests() {
  const navigate = useNavigate();
  const interests = useStore((s) => s.interests);
  const toggleInterest = useStore((s) => s.toggleInterest);
  const redoOnboarding = useStore((s) => s.redoOnboarding);
  const resetHints = useStore((s) => s.resetHints);
  const [hintsReset, setHintsReset] = useState(false);

  return (
    <Section title="Interests" icon={Heart}>
      <p className="text-sm text-ink-soft">These decide what shows up first in your Feed.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {TAGS.map((tag) => {
          const active = interests.includes(tag);
          return (
            <button
              key={tag}
              onClick={() => toggleInterest(tag)}
              className={cn(
                "min-h-11 border px-3 py-2 font-serif text-sm",
                active
                  ? "border-ink bg-ink text-paper"
                  : "border-line text-ink-soft hover:border-ink",
              )}
            >
              {tag}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-4">
        <button
          onClick={() => {
            redoOnboarding();
            navigate({ to: "/onboarding" });
          }}
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft hover:text-accent"
        >
          Redo onboarding
        </button>
        <button
          onClick={() => {
            resetHints();
            setHintsReset(true);
          }}
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft hover:text-accent"
        >
          {hintsReset ? "Hints reset" : "Show hints again"}
        </button>
      </div>
    </Section>
  );
}

function AppearanceSection() {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const options = [
    { value: "light" as const, label: "Light" },
    { value: "dark" as const, label: "Dark" },
    { value: "system" as const, label: "System" },
  ];

  return (
    <Section title="Appearance" icon={SunMoon}>
      <p className="text-sm text-ink-soft">
        System matches your device's light/dark setting automatically.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => setTheme(o.value)}
            aria-pressed={theme === o.value}
            className={cn(
              "border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em]",
              theme === o.value
                ? "border-ink bg-ink text-paper"
                : "border-line text-ink-soft hover:border-ink hover:text-ink",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </Section>
  );
}

function AudioPreferences() {
  const ttsRate = useStore((s) => s.ttsRate);
  const setTtsRate = useStore((s) => s.setTtsRate);
  const speeds = [0.8, 1.0, 1.2, 1.5, 2.0];

  return (
    <Section title="Audio Preferences" icon={Headphones}>
      <p className="text-sm text-ink-soft">Adjust the playback speed for the narrator.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {speeds.map((s) => (
          <button
            key={s}
            onClick={() => setTtsRate(s)}
            className={cn(
              "border px-4 py-2 font-mono text-[11px]",
              ttsRate === s
                ? "border-ink bg-ink text-paper"
                : "border-line text-ink-soft hover:border-ink hover:text-ink",
            )}
          >
            {s.toFixed(1)}x
          </button>
        ))}
      </div>
    </Section>
  );
}

function last14Days(): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = 13; i >= 0; i--) {
    const x = new Date(d);
    x.setDate(d.getDate() - i);
    out.push(x.toISOString().slice(0, 10));
  }
  return out;
}

function Glossary() {
  const list = useStore((s) => s.glossary);
  const add = useStore((s) => s.addGlossary);
  const remove = useStore((s) => s.removeGlossary);
  const [term, setTerm] = useState("");
  const [def, setDef] = useState("");
  const [q, setQ] = useState("");
  const filtered = (
    q.trim()
      ? list.filter((g) => (g.term + " " + g.definition).toLowerCase().includes(q.toLowerCase()))
      : list
  ).sort((a, b) => a.term.localeCompare(b.term));
  return (
    <Section title="Glossary" icon={Library}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search terms…"
        className="w-full border-b border-line bg-transparent py-2 text-sm focus:border-ink focus:outline-none"
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!term.trim() || !def.trim()) return;
          add({ term: term.trim(), definition: def.trim() });
          setTerm("");
          setDef("");
        }}
        className="mt-3 space-y-2"
      >
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Term"
          className="w-full border-b border-line bg-transparent py-2 text-base focus:border-ink focus:outline-none"
        />
        <textarea
          value={def}
          onChange={(e) => setDef(e.target.value)}
          placeholder="Definition"
          className="w-full border-b border-line bg-transparent py-2 text-sm focus:border-ink focus:outline-none"
          rows={2}
        />
        <button
          type="submit"
          className="border border-ink px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink"
        >
          Add term
        </button>
      </form>
      {filtered.length === 0 && (
        <div className="border border-line border-dashed p-6 text-center mt-6">
          {list.length === 0 ? (
            <>
              <p className="font-serif text-lg text-ink">Your glossary is empty.</p>
              <p className="mt-2 text-sm text-ink-soft">
                Add terms above to build your own personal dictionary.
              </p>
            </>
          ) : (
            <p className="font-serif text-lg text-ink">No terms match &ldquo;{q}&rdquo;.</p>
          )}
        </div>
      )}
      <ul className="mt-4 space-y-3">
        {filtered.map((g) => (
          <li key={g.id} className="border-b border-line pb-3">
            <div className="flex items-baseline justify-between">
              <span className="font-serif text-lg text-ink">{g.term}</span>
              <button
                onClick={() => remove(g.id)}
                className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft hover:text-accent"
              >
                Remove
              </button>
            </div>
            <p className="mt-1 text-sm text-ink-soft">{g.definition}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Scratchpad() {
  const value = useStore((s) => s.scratchpad);
  const set = useStore((s) => s.setScratchpad);
  return (
    <Section title="Scratchpad" icon={PenTool}>
      <textarea
        value={value}
        onChange={(e) => set(e.target.value)}
        rows={6}
        placeholder="Half-formed thoughts, connections, quotes…"
        className="w-full border border-line bg-paper p-3 font-serif text-base leading-relaxed focus:border-ink focus:outline-none"
      />
    </Section>
  );
}

function Offline() {
  return (
    <Section title="Offline" icon={CloudOff}>
      <InstallAppButton />
    </Section>
  );
}

function Backup() {
  const exportJSON = useStore((s) => s.exportJSON);
  const importJSON = useStore((s) => s.importJSON);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const onExport = () => {
    const data = exportJSON();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `unknown-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImport = async (f: File) => {
    const text = await f.text();
    const ok = importJSON(text);
    setMsg(ok ? "Imported." : "Import failed — not valid JSON.");
    setTimeout(() => setMsg(null), 3000);
  };

  return (
    <Section title="Backup" icon={Archive}>
      <p className="text-sm text-ink-soft">
        All progress lives in this browser. Export to keep it.
      </p>
      <div className="mt-4 flex gap-2">
        <button
          onClick={onExport}
          className="border border-ink px-4 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-ink"
        >
          Export JSON
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="border border-line px-4 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-ink hover:border-ink"
        >
          Import
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImport(f);
            e.target.value = "";
          }}
        />
      </div>
      {msg && (
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-accent">{msg}</p>
      )}
    </Section>
  );
}
