"use client";

import Image from "next/image";
import { track } from "@vercel/analytics";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { openToday, playToday } from "@/app/actions";
import { msUntilNextPuzzle, puzzleDate, puzzleNumber } from "@/lib/daily-clock";
import type { DailySync } from "@/lib/daily-play";
import { cardKey, LINKS_TO_WIN, WORD } from "@/lib/types";
import { loadNickname } from "./challenge/nickname";
import { VsButton } from "./challenge/VsButton";
import { HelpButton, HowToPlay } from "./HowToPlay";
import { StatsButton, StatsSheet } from "./StatsSheet";
import { Logo } from "./Logo";
import { backupAfterGame } from "./progress/snapshot";
import { InBoxClock } from "./SpeedClock";
import { UsedWarning } from "./UsedWarning";
import { Results } from "./Results";
import { currentStreak, loadGame, recordResult, saveGame, type SavedGame } from "./storage";
import { useSyncedStats } from "./useStats";

const SLOW = "Whoa, slow down a sec. Try again in a moment.";

type Feedback = { tone: "good" | "bad" | "info" | "used"; text: string; id?: number } | null;

/** The server's copy of the game, with the card clock moved into this phone's time. */
function fromServer(date: string, s: DailySync): SavedGame {
  return { ...s.state, date, number: s.number, cardShownAt: s.cardShownAt - s.serverNow + Date.now() };
}

export function Game() {
  const [game, setGame] = useState<SavedGame | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guess, setGuess] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [misses, setMisses] = useState(0); // re-triggers the shake animation
  // The first card's clock waits for a tap in the guess box, so newcomers can look around first.
  const [clockStarted, setClockStarted] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  /** Show what the server has; a game that just ended gets counted in this phone's stats. */
  const apply = useCallback((next: SavedGame) => {
    if (next.status !== "playing" && recordResult(next)) {
      track("daily_finished", { won: next.status === "won", links: next.links.length, fast: next.fastLinks });
      backupAfterGame();
    }
    setGame(next);
  }, []);

  /** Load (or re-sync) today's game. Before the first move this also restarts the card clock. */
  const open = useCallback(async () => {
    const date = puzzleDate();
    const saved = loadGame(date);
    // Finished on this phone before the server kept games: that result stands.
    if (saved && !saved.cardShownAt && saved.status !== "playing") return saved;
    const legacy = saved && !saved.cardShownAt && saved.status === "playing" ? saved : null;
    const synced = await openToday(date, legacy);
    return synced ? fromServer(date, synced) : saved;
  }, []);

  useEffect(() => {
    open()
      .then((g) => {
        if (!g) throw new Error("No game");
        apply(g);
      })
      .catch(() => setError("Couldn't load today's game. Check your connection and try again."));
  }, [open, apply]);

  // Coming back to the app before playing restarts the clock, so opening early doesn't cost time.
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden && game?.status === "playing" && game.events.length === 0) {
        setClockStarted(false);
        open().then((g) => g && setGame(g)).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [open, game?.status, game?.events.length]);

  useEffect(() => {
    if (game) saveGame(game);
  }, [game]);

  // At midnight Eastern, move to the new chain. A game in progress isn't yanked away: it gets a
  // banner instead, and can still be finished. Also checked on return, since phones sleep timers.
  const [newChainOut, setNewChainOut] = useState(false);
  const midGameAtReset = useRef(false);
  const date = game?.date;
  const midGame = game?.status === "playing" && (game?.events.length ?? 0) > 0;
  useEffect(() => {
    if (!date) return;
    const check = () => {
      if (document.hidden || puzzleDate() === date) return;
      if (midGame) midGameAtReset.current = true;
      if (midGameAtReset.current) setNewChainOut(true);
      else window.location.reload();
    };
    const atMidnight = setTimeout(check, msUntilNextPuzzle() + 1500);
    const backup = setInterval(check, 60_000);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      clearTimeout(atMidnight);
      clearInterval(backup);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, [date, midGame]);
  const banner = newChainOut && <NewChainBanner />;

  if (error)
    return (
      <>
        <Logo size="sm" />
        <p className="p-8 text-center text-red-300">{error}</p>
      </>
    );
  if (!game)
    return (
      <>
        <Logo size="sm" />
        <p className="p-8 text-center text-zinc-400 animate-pulse">Rolling film…</p>
      </>
    );
  if (game.status !== "playing")
    return (
      <>
        {banner}
        <Results game={game} />
      </>
    );

  const { card } = game;
  const askingFor = card.kind === "movie" ? "an actor in this movie" : "a movie this actor was in";

  function closeHelp() {
    setShowHelp(false);
    // Reading the rules shouldn't count against your time.
    if (game!.events.length === 0) {
      setClockStarted(false);
      open().then((g) => g && setGame(g)).catch(() => {});
    }
  }

  /** First tap in the box on the first card: restart its clock now (the server does the same). */
  function startClock() {
    if (clockStarted || game!.events.length > 0) return;
    setClockStarted(true);
    setGame((g) => g && { ...g, cardShownAt: Date.now() });
    open().then((g) => g && setGame(g)).catch(() => {});
  }

  /** Send a guess (or a pass, with null) and show what the server decided. */
  function play(text: string | null) {
    startTransition(async () => {
      const date = game!.date;
      let result: Awaited<ReturnType<typeof playToday>>;
      try {
        result = await playToday(date, text);
      } catch {
        // A server hiccup: nothing was saved, so the same move can simply be tried again.
        return setFeedback({ tone: "info", text: "Something went wrong. Try again." });
      }
      if (result.outcome === "slow") return setFeedback({ tone: "info", text: SLOW });
      if (result.outcome === "used") {
        setGuess("");
        setFeedback({ tone: "used", text: result.answer.name, id: Date.now() });
        inputRef.current?.focus();
        return;
      }
      if (result.outcome === "stale") {
        // Played on another tab, or a double tap: catch up with the server.
        if (result.sync) apply(fromServer(date, result.sync));
        setFeedback({ tone: "info", text: "Caught up with your game." });
        return;
      }
      const next = fromServer(date, result.sync);
      setGuess("");
      if (result.outcome === "wrong") {
        setFeedback({ tone: "bad", text: `"${text}" — nope! That's ${WORD[next.letters - 1]}.` });
        setMisses((m) => m + 1);
        navigator.vibrate?.(120);
      } else if (result.outcome === "pass") {
        setFeedback({ tone: "info", text: `Passed. That's ${WORD[next.letters - 1]}.` });
      } else if (result.outcome === "skip") {
        setFeedback({ tone: "info", text: "Skipped. No extra letter for that one." });
      } else if (result.outcome === "correct") {
        const name = result.answer.name;
        setFeedback({
          tone: "good",
          text: `${result.close ? "Close enough! " : ""}✓ ${name}${result.fast ? "  ⚡ +1" : ""}`,
        });
        inputRef.current?.focus();
      }
      apply(next);
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = guess.trim();
    if (text && !isPending) play(text);
  }

  function onPass() {
    if (!isPending) play(null);
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {showHelp && <HowToPlay onClose={closeHelp} />}
      {showStats && <StatsSheet todayNumber={game.number} onClose={() => setShowStats(false)} />}
      <div className="relative w-full">
        <Logo size="sm" />
        <VsButton />
        <StatsButton onClick={() => setShowStats(true)} className="right-12" />
        <HelpButton onClick={() => setShowHelp(true)} />
      </div>
      {banner}
      {game.events.length === 0 && <WelcomeBack todayNumber={game.number} />}
      <Letters count={game.letters} />

      <Progress links={game.links.length} />

      <figure
        key={`${cardKey(card)}-${misses}`}
        className={`flex w-full flex-col items-center gap-3 ${misses && feedback?.tone === "bad" ? "animate-shake" : "animate-rise"}`}
      >
        <div className="relative aspect-[2/3] w-[min(56vw,27dvh)] overflow-hidden rounded-xl bg-zinc-800 shadow-2xl shadow-amber-950/40 ring-1 ring-white/10">
          {card.image ? (
            <Image
              key={cardKey(card)}
              src={card.image}
              alt={card.name}
              fill
              sizes="(max-width: 640px) 56vw, 240px"
              className="object-cover"
              priority
            />
          ) : (
            <div className="flex h-full items-center justify-center p-4 text-center text-zinc-400">
              {card.name}
            </div>
          )}
        </div>
        <figcaption className="text-center">
          <div className="text-balance text-xl font-semibold leading-tight">{card.name}</div>
          {card.year && <div className="text-sm text-zinc-400">{card.year}</div>}
        </figcaption>
      </figure>

      <form onSubmit={onSubmit} className="flex w-full flex-col gap-2">
        <p id="guess-label" className="text-center text-sm uppercase tracking-wider text-zinc-400">
          Name {askingFor}
        </p>
        <div className="relative">
          <input
            ref={inputRef}
            id="guess"
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            placeholder={card.kind === "movie" ? "Type an actor…" : "Type a movie…"}
            aria-labelledby="guess-label"
            // Safari never offers contact AutoFill on a search box; it ignores autocomplete="off".
            type="search"
            name="mh-answer"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="words"
            spellCheck={false}
            enterKeyHint="go"
            onFocus={(e) => {
              startClock();
              const el = e.currentTarget;
              // Keep the input above the on-screen keyboard.
              setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 300);
            }}
            disabled={isPending}
            className="w-full rounded-xl border border-amber-400/40 bg-black/40 py-3.5 pr-16 pl-4 text-lg outline-none placeholder:text-zinc-600 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30"
          />
          {(clockStarted || game.events.length > 0) && (
            <InBoxClock key={`box-${cardKey(card)}-${game.links.length}`} shownAt={game.cardShownAt} />
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onPass}
            disabled={isPending}
            className="min-h-12 rounded-xl border border-white/15 px-5 text-zinc-300 active:bg-white/5 disabled:opacity-50"
          >
            {/* A miss already cost this card its letter, so moving on is free. */}
            {game.events.at(-1) === "wrong" ? "Skip (free)" : "Pass"}
          </button>
          <button
            type="submit"
            disabled={isPending || !guess.trim()}
            className="min-h-12 flex-1 rounded-xl bg-amber-400 text-lg font-bold text-black active:scale-[0.98] disabled:opacity-40"
          >
            {isPending ? "Checking…" : "Guess"}
          </button>
        </div>
      </form>

      {feedback?.tone === "used" ? (
        <UsedWarning key={feedback.id} name={feedback.text} />
      ) : (
        <p
          aria-live="polite"
          className={`min-h-6 text-center text-sm ${
            feedback?.tone === "good"
              ? "text-emerald-400"
              : feedback?.tone === "bad"
                ? "text-red-400"
                : "text-zinc-400"
          }`}
        >
          {feedback?.text}
        </p>
      )}
    </div>
  );
}

/** Shown when a new chain comes out while you're still playing (or finishing) the old one. */
function NewChainBanner() {
  return (
    <div className="mb-3 flex w-full items-center justify-between gap-3 rounded-xl bg-amber-400/15 px-4 py-3 ring-1 ring-amber-400/60">
      <span className="text-sm text-amber-100">
        🎬 <b className="text-white">Movie Chain #{puzzleNumber(puzzleDate())}</b> is out!
      </span>
      <button
        onClick={() => window.location.reload()}
        className="min-h-11 shrink-0 rounded-lg bg-amber-400 px-4 text-sm font-bold text-black active:scale-[0.98]"
      >
        Play it
      </button>
    </div>
  );
}

export function Letters({ count }: { count: number }) {
  return (
    <div className="flex gap-2" aria-label={`${count} of ${WORD.length} letters`}>
      {WORD.split("").map((ch, i) => (
        <span
          key={ch}
          className={`flex h-11 w-11 items-center justify-center rounded-lg font-display text-2xl ${
            i < count
              ? "animate-pop bg-red-600 text-white shadow-lg shadow-red-900/50"
              : "border border-white/15 text-white/15"
          }`}
        >
          {ch}
        </span>
      ))}
    </div>
  );
}

function Progress({ links }: { links: number }) {
  return (
    <div className="flex w-full items-center gap-1" aria-label={`${links} of ${LINKS_TO_WIN} links`}>
      {Array.from({ length: LINKS_TO_WIN }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 flex-1 rounded-full ${i < links ? "bg-amber-400" : "bg-white/10"}`}
        />
      ))}
    </div>
  );
}

/** A friendly hello for returning players, from stats saved on this device. */
function WelcomeBack({ todayNumber }: { todayNumber: number }) {
  // Rendered only after the game loads in the browser, so storage is available.
  const stats = useSyncedStats();
  const [name] = useState(loadNickname);
  if (stats.played === 0) return null;
  const streak = currentStreak(stats, todayNumber);
  return (
    <p className="-mb-1 text-center text-sm text-zinc-200">
      Welcome back{name ? `, ${name}` : ""}!{" "}
      {streak > 0 ? `🔥 ${streak}-day streak` : `${stats.played} ${stats.played === 1 ? "chain" : "chains"} played`}
    </p>
  );
}
