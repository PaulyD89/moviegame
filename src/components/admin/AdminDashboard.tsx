"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { dismiss, letterboxdList, logout, missedAnswers, stats } from "@/app/admin/actions";
import type { LetterboxdKit } from "@/lib/letterboxd-kit";
import type { SuspectMiss } from "@/lib/missed";
import type { AdminStats } from "@/lib/admin";

const REFRESH_MS = 5_000;

function ago(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86_400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86_400)}d ago`;
}

export function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState<AdminStats | null>(null);
  const [loadedAt, setLoadedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [error, setError] = useState(false);
  const refresh = useRef<() => void>(() => {});

  useEffect(() => {
    let active = true;
    const load = () =>
      stats()
        .then((d) => {
          if (!active) return;
          setData(d);
          setLoadedAt(Date.now());
          setError(false);
        })
        .catch(() => active && setError(true));
    refresh.current = load;
    load();
    const poll = setInterval(load, REFRESH_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      active = false;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, []);

  if (!data) return <p className="p-8 text-center text-zinc-400">{error ? "Couldn't load stats." : "Loading…"}</p>;
  const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "–");

  return (
    <div className="flex flex-col gap-6 text-white">
      <header className="flex items-center justify-between">
        <h1 className="flex items-center gap-3">
          <Image
            src="/logo-480.webp"
            alt="Movie Horse"
            width={480}
            height={320}
            priority
            className="h-auto w-24 drop-shadow-[0_4px_14px_rgb(251_191_36/0.25)]"
          />
          <span className="text-xl font-light tracking-wide text-amber-400">Admin Dashboard</span>
        </h1>
        <div className="flex items-center gap-3 text-sm text-zinc-300">
          <span aria-live="polite">{error ? "⚠ Refresh failed" : `Updated ${Math.max(0, Math.round((now - loadedAt) / 1000))}s ago`}</span>
          <button
            onClick={async () => {
              await logout();
              router.refresh();
            }}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-zinc-200"
          >
            Sign out
          </button>
        </div>
      </header>

      <ErrorBanner errors={data.errors} now={now || loadedAt} onChange={() => refresh.current()} />

      <Section title="Live right now">
        <Tile label="Live games" value={data.live_games} hint="someone on screen in the last 30s" big />
        <Tile label="Players on screen" value={data.players_on_screen} hint="in a lobby or game" big />
      </Section>

      <Section title={`Daily Movie Chain #${data.puzzleNumber} (today)`}>
        <Tile label="Started" value={data.daily_started} />
        <Tile label="Finished" value={data.daily_finished} />
        <Tile label="Win rate" value={pct(data.daily_won, data.daily_finished)} />
        <Tile label="Avg links" value={data.daily_avg_links ?? "–"} />
      </Section>

      <Growth growth={data.growth} />
      <Returns returns={data.returns} today={data.puzzleNumber} />
      <Funnel
        title="Top sources · last 7 days"
        column="Source"
        rows={data.sources.map((s) => ({ ...s, label: s.source }))}
        empty="Recording started Oct 16; this fills in as people play."
      />
      <Funnel
        title="Browsers · last 7 days"
        column="Browser"
        rows={data.browsers.map((b) => ({ ...b, label: b.browser }))}
        empty="Recording started Oct 17; this fills in as people play."
      />
      <Countries countries={data.countries} />

      <Section title="Challenges">
        <Tile label="In progress" value={data.games_in_progress} />
        <Tile label="Lobbies open" value={data.lobbies_open} hint="last 24h" />
        <Tile label="Created today" value={data.challenges_today} />
        <Tile label="Finished today" value={data.finished_today} />
        <Tile label="All time" value={data.challenges_total} />
      </Section>

      <Section title="Notifications">
        <Tile label="Devices with alerts" value={data.push_devices} />
        <Tile label="Nightly reminder" value={data.push_daily} />
      </Section>

      <section>
        <h2 className="mb-2 text-xs uppercase tracking-widest text-zinc-300">Active games (last 24h)</h2>
        {data.activeGames.length === 0 ? (
          <p className="text-sm text-zinc-400">No active games.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl ring-1 ring-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-wider text-zinc-300">
                <tr>
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Players</th>
                  <th className="px-3 py-2 text-right">Last move</th>
                </tr>
              </thead>
              <tbody>
                {data.activeGames.map((g, i) => (
                  <tr key={g.code ?? i} className="border-t border-white/5">
                    <td className="px-3 py-2 font-display tracking-widest">{g.code ?? "—"}</td>
                    <td className="px-3 py-2 text-zinc-200">{g.status === "lobby" ? "Lobby" : "Playing"}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {g.players.map((p, j) => (
                          <span key={j} className="inline-flex items-center gap-1 whitespace-nowrap">
                            <span
                              className={`h-2 w-2 rounded-full ${p.live ? "bg-emerald-400" : "bg-zinc-600"}`}
                              aria-label={p.live ? "on screen" : "away"}
                            />
                            <span className={p.turn ? "font-bold text-amber-400" : ""}>{p.nickname}</span>
                            {p.letters > 0 && <span className="text-xs text-red-400">{"MOVIE".slice(0, p.letters)}</span>}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-zinc-300">{ago(g.updatedAt, now || loadedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-zinc-400">Gold name = whose turn it is. Green dot = on screen now.</p>
      </section>

      <MissedAnswers />
      <LetterboxdPanel today={data.puzzleNumber} />
    </div>
  );
}

/** Red while there are errors you haven't dismissed; green otherwise. Dismissed ones stay in the log. */
function ErrorBanner({ errors, now, onChange }: { errors: AdminStats["errors"]; now: number; onChange: () => void }) {
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const open = errors.open.filter((e) => !hidden.has(e.id));
  // Only count dismissals still in this list (after a refresh, dismissed ones are already gone from it).
  const remaining = errors.openCount - (errors.open.length - open.length);

  async function dismissOne(id: number) {
    setHidden((h) => new Set(h).add(id));
    await dismiss(id).catch(() => {});
    onChange();
  }
  async function dismissAll() {
    setHidden(new Set(errors.open.map((e) => e.id)));
    await dismiss().catch(() => {});
    onChange();
  }

  if (remaining === 0 || open.length === 0) {
    return (
      <p className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300 ring-1 ring-emerald-500/40">
        ✓ No new errors
        {errors.dismissedThisWeek > 0 && (
          <span className="text-emerald-300/70"> · {errors.dismissedThisWeek} dismissed this week</span>
        )}
      </p>
    );
  }
  return (
    <section className="rounded-xl bg-red-500/10 p-4 ring-1 ring-red-500/60" role="alert">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-red-300">
          ⚠️ {remaining} new {remaining === 1 ? "error" : "errors"}
        </h2>
        {open.length > 1 && (
          <button onClick={dismissAll} className="min-h-11 rounded-lg border border-white/15 px-3 text-sm text-zinc-200">
            Dismiss all
          </button>
        )}
      </div>
      <ul className="mt-2 space-y-2 text-sm">
        {open.map((e) => (
          <li key={e.id} className="flex items-start gap-3 rounded-lg bg-black/30 px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-x-3 text-xs text-zinc-400">
                <span>{ago(e.at, now)}</span>
                <span className="uppercase tracking-wider">{e.source}</span>
                {e.path && <span className="break-all">{e.path}</span>}
              </div>
              <div className="mt-0.5 break-words text-zinc-100">{e.message}</div>
            </div>
            <button
              onClick={() => dismissOne(e.id)}
              aria-label="Dismiss this error"
              className="min-h-11 shrink-0 rounded-lg border border-white/15 px-3 text-xs text-zinc-300"
            >
              Dismiss
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-zinc-400">Send me these and I&apos;ll dig in. Dismissed errors stay in the log.</p>
    </section>
  );
}

/** Copy-and-upload kit for each day's Letterboxd list, until Letterboxd grants API access. */
function LetterboxdPanel({ today }: { today: number }) {
  // Yesterday's chain is finished; today's is still being played.
  const [number, setNumber] = useState(Math.max(1, today - 1));
  const [kit, setKit] = useState<LetterboxdKit | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const load = (n: number) => {
    setNumber(n);
    setBusy(true);
    letterboxdList(n)
      .then(setKit)
      .catch(() => setKit(null))
      .finally(() => setBusy(false));
  };
  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  };
  const download = (name: string, csv: string) => {
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };
  const button = "rounded-lg border border-white/15 px-3 py-1.5 text-sm text-zinc-200 disabled:opacity-50";
  return (
    <section className="rounded-xl border border-white/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xs uppercase tracking-widest text-zinc-300">Letterboxd list</h2>
        <div className="flex items-center gap-2">
          <select
            value={number}
            onChange={(e) => load(Number(e.target.value))}
            className="rounded-lg border border-white/15 bg-black px-2 py-1.5 text-sm text-zinc-200"
          >
            {Array.from({ length: today }, (_, i) => today - i).map((n) => (
              <option key={n} value={n}>
                #{n}
                {n === today ? " (today, still playing)" : ""}
              </option>
            ))}
          </select>
          <button onClick={() => load(number)} disabled={busy} className={button}>
            {busy ? "Building…" : kit ? "Rebuild" : "Build"}
          </button>
        </div>
      </div>
      {kit === null && <p className="mt-2 text-sm text-zinc-400">Couldn&apos;t build that list.</p>}
      {kit && (
        <div className="mt-3 space-y-3 text-sm">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs uppercase tracking-wider text-zinc-400">Title</span>
              <button onClick={() => copy("title", kit.title)} className={button}>
                {copied === "title" ? "Copied ✓" : "Copy"}
              </button>
            </div>
            <p className="mt-1 text-white">{kit.title}</p>
          </div>
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs uppercase tracking-wider text-zinc-400">Description</span>
              <button onClick={() => copy("description", kit.description)} className={button}>
                {copied === "description" ? "Copied ✓" : "Copy"}
              </button>
            </div>
            <p className="mt-1 whitespace-pre-line text-zinc-300">{kit.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => download(`movie-horse-${kit.number}-letterboxd.csv`, kit.csv)} className={button}>
              Download list file ({kit.films.length} films)
            </button>
            <button onClick={() => download("movie-horse-openers-letterboxd.csv", kit.openersCsv)} className={button}>
              Download &ldquo;Every opener&rdquo; file
            </button>
          </div>
          <p className="text-xs text-zinc-400">
            On Letterboxd: Lists → Start a new list → Import, upload the file, then paste the title and description.
            For the openers list, import into your existing &ldquo;Every Movie Horse opener&rdquo; list to replace it.
          </p>
        </div>
      )}
    </section>
  );
}

/** Wrong guesses that look like real answers, checked on demand (it looks up every card's credits). */
function MissedAnswers() {
  const [rows, setRows] = useState<SuspectMiss[] | null>(null);
  const [busy, setBusy] = useState(false);
  const check = () => {
    setBusy(true);
    missedAnswers()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setBusy(false));
  };
  return (
    <section className="rounded-xl border border-white/10 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs uppercase tracking-widest text-zinc-300">Possible missed answers · last 3 days</h2>
        <button onClick={check} disabled={busy} className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-zinc-200 disabled:opacity-50">
          {busy ? "Checking…" : rows ? "Check again" : "Check"}
        </button>
      </div>
      {rows && rows.length === 0 && <p className="mt-2 text-sm text-zinc-400">Nothing suspicious. Wrong guesses all look genuinely wrong.</p>}
      {rows && rows.length > 0 && (
        <ul className="mt-2 divide-y divide-white/10 text-sm">
          {rows.map((r, i) => (
            <li key={i} className="flex flex-wrap items-baseline gap-x-2 py-1.5">
              <span className="text-zinc-400">{r.mode === "vs" ? "VS" : "Daily"}</span>
              <span className="text-zinc-300">{r.card}:</span>
              <b className="text-red-300">&ldquo;{r.guess}&rdquo;</b>
              <span className="text-zinc-400">closest real answer</span>
              <b className="text-amber-300">{r.closest}</b>
              <span className="text-xs text-zinc-500">{Math.round(r.score * 100)}% alike</span>
              {r.acceptedNow && <span className="text-xs text-emerald-400">✓ counts now</span>}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-zinc-400">Send me anything here that should have counted and I&apos;ll widen the matching for it.</p>
    </section>
  );
}

const regionName = (() => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    return null;
  }
})();

/** Share of players per source or browser (last 7 days), and how many of each made a move and finished. */
function Funnel({
  title,
  column,
  rows,
  empty,
}: {
  title: string;
  column: string;
  rows: { label: string; players: number; moved: number; finished: number }[];
  empty: string;
}) {
  const total = rows.reduce((n, s) => n + s.players, 0);
  return (
    <section className="rounded-xl border border-white/10 p-4">
      <h2 className="text-xs uppercase tracking-widest text-zinc-300">{title}</h2>
      {total === 0 ? (
        <p className="mt-2 text-sm text-zinc-400">{empty}</p>
      ) : (
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-zinc-400">
              <th className="py-1 font-normal">{column}</th>
              <th className="py-1 font-normal">Share</th>
              <th className="py-1 text-right font-normal">Made a move</th>
              <th className="py-1 text-right font-normal">Finished</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 10).map((s) => {
              const share = Math.round((s.players / total) * 100);
              return (
                <tr key={s.label} className="border-t border-white/5">
                  <td className="py-1.5 pr-2 text-zinc-200">{s.label}</td>
                  <td className="py-1.5 pr-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.max(2, share)}%` }} />
                      </div>
                      <span className="tabular-nums text-zinc-300">{share}%</span>
                    </div>
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-zinc-300">{pct(s.moved, s.players)}</td>
                  <td className="py-1.5 text-right tabular-nums text-zinc-300">{pct(s.finished, s.players)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

/**
 * Next-day return: of the players who made a move on a puzzle, how many opened the next one.
 * Per puzzle (the newest is still filling in), then split by how their game ended, source and
 * browser, counting only next days that are over.
 */
function Returns({ returns, today }: { returns: AdminStats["returns"]; today: number }) {
  const puzzles = returns.filter((r) => r.dim === "puzzle").sort((a, b) => Number(b.label) - Number(a.label));
  const groups = [
    { dim: "outcome", title: "By how their game ended" },
    { dim: "source", title: "By source" },
    { dim: "browser", title: "By browser" },
  ] as const;
  const bar = (r: { label: string; players: number; back: number }, label: React.ReactNode) => {
    const share = r.players ? Math.round((r.back / r.players) * 100) : 0;
    return (
      <div key={r.label} className="flex items-center gap-2 py-1 text-sm">
        <span className="w-32 shrink-0 truncate text-zinc-200">{label}</span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.max(2, share)}%` }} />
        </div>
        <span className="w-10 text-right tabular-nums text-zinc-200">{share}%</span>
        <span className="w-24 text-right text-xs tabular-nums text-zinc-500">
          {r.back} of {r.players}
        </span>
      </div>
    );
  };
  return (
    <section className="rounded-xl border border-white/10 p-4">
      <h2 className="text-xs uppercase tracking-widest text-zinc-300">Came back the next day</h2>
      <p className="mt-1 text-xs text-zinc-400">Players who made a move, and how many opened the next day&apos;s chain.</p>
      <div className="mt-2">
        {puzzles.map((r) =>
          bar(
            r,
            <>
              #{r.label} → #{Number(r.label) + 1}
              {Number(r.label) === today - 1 && <span className="text-zinc-500"> · so far</span>}
            </>,
          ),
        )}
      </div>
      {groups.map(({ dim, title }) => {
        const rows = returns.filter((r) => r.dim === dim).sort((a, b) => b.players - a.players).slice(0, 6);
        return (
          <div key={dim} className="mt-3">
            <h3 className="text-[11px] uppercase tracking-widest text-zinc-400">{title}</h3>
            {rows.length ? (
              rows.map((r) => bar(r, r.label))
            ) : (
              <p className="py-1 text-xs text-zinc-500">Fills in once a full next day has passed.</p>
            )}
          </div>
        );
      })}
    </section>
  );
}

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "–");

/** Share of players by country, last 7 days. Shows percentages only, never player counts. */
function Countries({ countries }: { countries: AdminStats["countries"] }) {
  const total = countries.reduce((n, c) => n + c.players, 0);
  const top = countries.slice(0, 8);
  const rest = total - top.reduce((n, c) => n + c.players, 0);
  const rows = [...top.map((c) => ({ label: regionName?.of(c.country) ?? c.country, n: c.players })), ...(rest > 0 ? [{ label: "Other", n: rest }] : [])];
  return (
    <section className="rounded-xl border border-white/10 p-4">
      <h2 className="text-xs uppercase tracking-widest text-zinc-300">Where players are from · last 7 days</h2>
      {total === 0 ? (
        <p className="mt-2 text-sm text-zinc-400">Recording started Oct 16; this fills in as people play.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {rows.map((r) => {
            const pct = Math.round((r.n / total) * 100);
            return (
              <li key={r.label} className="flex items-center gap-3 text-sm">
                <span className="w-36 shrink-0 truncate text-zinc-200">{r.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.max(2, pct)}%` }} />
                </div>
                <span className="w-10 text-right tabular-nums text-zinc-300">{pct}%</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-xs uppercase tracking-widest text-zinc-300">{title}</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{children}</div>
    </section>
  );
}

function Tile({ label, value, hint, big }: { label: string; value: number | string; hint?: string; big?: boolean }) {
  return (
    <div className="rounded-xl bg-white/5 p-3">
      <div className={`font-bold ${big ? "text-4xl text-amber-400" : "text-2xl"}`}>{value}</div>
      <div className="text-sm text-zinc-200">{label}</div>
      {hint && <div className="text-xs text-zinc-400">{hint}</div>}
    </div>
  );
}

const SERIES = [
  { key: "new", label: "New", swatch: "bg-sky-400" },
  { key: "returning", label: "Played yesterday too", swatch: "bg-amber-400" },
  { key: "back", label: "Back after a break", swatch: "bg-zinc-500" },
] as const;

const shortDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** Is it growing? All-time totals, who's coming back, and the last 30 days. */
function Growth({ growth }: { growth: AdminStats["growth"] }) {
  const { days, totals } = growth;
  const today = days.at(-1);
  const cameBack = today && today.prev_players ? `${Math.round((today.returning / today.prev_players) * 100)}%` : "–";
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xs uppercase tracking-widest text-zinc-300">Growth</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label="All-time players" value={totals.players} hint="daily or challenges" />
        <Tile label="Came back today" value={cameBack} hint={today ? `${today.returning} of yesterday's ${today.prev_players}` : undefined} />
        <Tile label="Dailies finished" value={totals.daily_games} hint="all time" />
        <Tile label="Challenges" value={totals.challenges} hint={`${totals.challenges_finished} finished`} />
      </div>
      <GrowthChart days={days} />
      <GrowthTable days={days} />
    </section>
  );
}

/** Daily players per puzzle, split into new, returning and back-after-a-break. Tap a bar for numbers. */
function GrowthChart({ days }: { days: AdminStats["growth"]["days"] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((d) => d.players));
  const shown = days.find((d) => d.number === active) ?? days.at(-1);
  const parts = (d: (typeof days)[number]) => ({
    new: d.new_players,
    returning: d.returning,
    back: Math.max(0, d.players - d.new_players - d.returning),
  });

  return (
    <figure className="rounded-xl bg-white/5 p-3">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm text-zinc-200">Daily players, last {days.length} {days.length === 1 ? "day" : "days"}</span>
        <span className="flex flex-wrap gap-3 text-xs text-zinc-300">
          {SERIES.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-sm ${s.swatch}`} aria-hidden />
              {s.label}
            </span>
          ))}
        </span>
      </figcaption>
      {shown && (
        <p className="mt-2 text-xs text-zinc-300" aria-live="polite">
          <b className="text-white">
            #{shown.number} · {shortDate(shown.date)}:
          </b>{" "}
          {shown.players} {shown.players === 1 ? "player" : "players"} ({parts(shown).new} new, {parts(shown).returning} played
          yesterday too, {parts(shown).back} back after a break)
        </p>
      )}
      <div className="mt-3 flex h-32 items-end gap-0.5">
        {days.map((d) => {
          const p = parts(d);
          return (
            <button
              key={d.number}
              type="button"
              onClick={() => setActive(active === d.number ? null : d.number)}
              onMouseEnter={() => setActive(d.number)}
              onMouseLeave={() => setActive(null)}
              aria-label={`Puzzle ${d.number}: ${d.players} players, ${p.new} new, ${p.returning} returning, ${p.back} back after a break`}
              className={`flex h-full min-w-0 flex-1 flex-col justify-end gap-[2px] outline-none ${
                active === d.number ? "opacity-100" : active === null ? "opacity-100" : "opacity-60"
              }`}
            >
              {d.players === 0 ? (
                <span className="h-0.5 w-full max-w-10 self-center rounded-t bg-white/15" />
              ) : (
                (["back", "returning", "new"] as const).map((k) =>
                  p[k] ? (
                    <span
                      key={k}
                      className={`w-full max-w-10 self-center first:rounded-t ${SERIES.find((s) => s.key === k)!.swatch}`}
                      style={{ height: `${(p[k] / max) * 100}%` }}
                    />
                  ) : null,
                )
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between border-t border-white/15 pt-1 text-xs text-zinc-400">
        <span>#{days[0]?.number}</span>
        {days.length > 1 && <span>#{days.at(-1)?.number}</span>}
      </div>
    </figure>
  );
}

/** Day-by-day numbers, newest first. */
function GrowthTable({ days }: { days: AdminStats["growth"]["days"] }) {
  const cols = ["Day", "Active", "Daily", "New", "Came back", "Won", "Challenges", "Rematches"];
  return (
    <div className="overflow-x-auto rounded-xl ring-1 ring-white/10">
      <table className="w-full text-left text-sm tabular-nums">
        <thead className="bg-white/5 text-xs uppercase tracking-wider text-zinc-300">
          <tr>
            {cols.map((c, i) => (
              <th key={c} className={`whitespace-nowrap px-3 py-2 ${i ? "text-right" : ""}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...days].reverse().map((d) => (
            <tr key={d.number} className="border-t border-white/5">
              <td className="whitespace-nowrap px-3 py-2">
                #{d.number} <span className="text-zinc-400">{shortDate(d.date)}</span>
              </td>
              <td className="px-3 py-2 text-right font-semibold text-white">{d.active}</td>
              <td className="px-3 py-2 text-right">{d.players}</td>
              <td className="px-3 py-2 text-right">{d.new_players}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right">
                {d.prev_players ? `${d.returning} (${Math.round((d.returning / d.prev_players) * 100)}%)` : "–"}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right">
                {d.won}/{d.finished}
              </td>
              <td className="px-3 py-2 text-right">{d.challenges}</td>
              <td className="px-3 py-2 text-right">{d.rematches}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-3 py-2 text-xs text-zinc-400">
        Active = played the daily or a challenge that day (Eastern time). Came back = also played the day before.
      </p>
    </div>
  );
}
