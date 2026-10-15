"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { logout, stats } from "@/app/admin/actions";
import type { AdminStats } from "@/lib/admin";

const REFRESH_MS = 5_000;

function ago(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

export function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState<AdminStats | null>(null);
  const [loadedAt, setLoadedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [error, setError] = useState(false);

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
        <h1 className="font-display text-3xl tracking-wide text-amber-400">MOVIE HORSE ADMIN</h1>
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

      <PlaysChart days={data.daily_last7} />

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
    </div>
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

/** Daily players over the last 7 puzzles. One series, so no legend; tap or hover a bar for details. */
function PlaysChart({ days }: { days: AdminStats["daily_last7"] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((d) => d.started));
  const peak = days.reduce((a, b) => (b.started > a.started ? b : a), days[0]);
  const latest = days.at(-1)?.number;

  return (
    <figure>
      <figcaption className="mb-2 text-xs uppercase tracking-widest text-zinc-300">
        Daily players, last {days.length} {days.length === 1 ? "puzzle" : "puzzles"}
      </figcaption>
      <div className="flex h-36 items-end gap-0.5 rounded-xl bg-white/5 px-3 pt-4 pb-0">
        {days.map((d) => {
          const show = d.number === active || d.number === latest || d === peak;
          return (
            <button
              key={d.number}
              type="button"
              onClick={() => setActive(active === d.number ? null : d.number)}
              onMouseEnter={() => setActive(d.number)}
              onMouseLeave={() => setActive(null)}
              aria-label={`Puzzle ${d.number}: ${d.started} started, ${d.finished} finished`}
              className="relative flex h-full flex-1 flex-col items-center justify-end outline-none"
            >
              {active === d.number && (
                <span className="absolute -top-1 z-10 -translate-y-full whitespace-nowrap rounded-md bg-zinc-800 px-2 py-1 text-xs text-white ring-1 ring-white/15">
                  #{d.number}: {d.started} started · {d.finished} finished
                </span>
              )}
              {show && d.started > 0 && <span className="mb-0.5 text-xs font-semibold text-white">{d.started}</span>}
              <span
                className={`w-full max-w-10 rounded-t ${d.number === latest ? "bg-amber-400" : "bg-amber-400/45"}`}
                style={{ height: d.started ? `${(d.started / max) * 80}%` : "2px" }}
              />
            </button>
          );
        })}
      </div>
      <div className="flex gap-0.5 border-t border-white/15 px-3 pt-1">
        {days.map((d) => (
          <span key={d.number} className="flex-1 text-center text-xs text-zinc-400">
            #{d.number}
          </span>
        ))}
      </div>
    </figure>
  );
}
