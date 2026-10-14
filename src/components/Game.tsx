"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { pass, startDaily, submitGuess } from "@/app/actions";
import { puzzleDate } from "@/lib/daily-clock";
import { cardKey, LINKS_TO_WIN, WORD } from "@/lib/types";
import { HelpButton, HowToPlay, hasSeenHowTo } from "./HowToPlay";
import { Logo } from "./Logo";
import { Results } from "./Results";
import { loadGame, recordResult, saveGame, type SavedGame } from "./storage";


type Feedback = { tone: "good" | "bad" | "info"; text: string } | null;

export function Game() {
  const [game, setGame] = useState<SavedGame | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guess, setGuess] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [misses, setMisses] = useState(0); // re-triggers the shake animation
  const [showHelp, setShowHelp] = useState(false);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load(): Promise<SavedGame> {
      const date = puzzleDate();
      const saved = loadGame(date);
      if (saved) return saved;
      const { number, card } = await startDaily(date);
      return {
        date,
        number,
        card,
        from: null,
        links: [],
        events: [],
        used: [cardKey(card)],
        letters: 0,
        status: "playing",
        startedAt: Date.now(),
      };
    }
    load()
      .then((g) => {
        setGame(g);
        if (g.status === "playing" && g.events.length === 0 && !hasSeenHowTo()) setShowHelp(true);
      })
      .catch(() => setError("Couldn't load today's game. Check your connection and try again."));
  }, []);

  useEffect(() => {
    if (game) saveGame(game);
  }, [game]);

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
  if (game.status !== "playing") return <Results game={game} />;

  const { card } = game;
  const askingFor = card.kind === "movie" ? "an actor in this movie" : "a movie this actor was in";

  function finish(next: SavedGame): SavedGame {
    if (next.status === "playing") return next;
    const done = { ...next, finishedAt: Date.now() };
    recordResult(done);
    return done;
  }

  function addLetter(g: SavedGame, event: "wrong" | "pass"): SavedGame {
    const letters = g.letters + 1;
    return {
      ...g,
      letters,
      events: [...g.events, event],
      status: letters >= WORD.length ? "lost" : "playing",
    };
  }

  function closeHelp() {
    setShowHelp(false);
    // Reading the rules shouldn't count against your time.
    if (game!.events.length === 0) setGame({ ...game!, startedAt: Date.now() });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = guess.trim();
    if (!text || isPending) return;

    startTransition(async () => {
      const result = await submitGuess(card, text, game!.used, game!.date);
      if (result.outcome === "used") {
        setFeedback({ tone: "info", text: `${result.answer.name} is already in your chain. Try another.` });
        return;
      }
      if (result.outcome === "wrong") {
        const next = addLetter(game!, "wrong");
        setGuess("");
        setFeedback({
          tone: "bad",
          text: `"${text}" — nope! That's ${WORD[next.letters - 1]}.`,
        });
        setMisses((m) => m + 1);
        navigator.vibrate?.(120);
        setGame(finish(next));
        return;
      }

      const { answer, next: nextCard, close } = result;
      const links = [...game!.links, { card, answer }];
      const won = links.length >= LINKS_TO_WIN;
      setGuess("");
      setFeedback({ tone: "good", text: close ? `Close enough! ✓ ${answer.name}` : `✓ ${answer.name}` });
      setGame(
        finish({
          ...game!,
          links,
          events: [...game!.events, "correct"],
          used: [...game!.used, cardKey(answer), ...(nextCard ? [cardKey(nextCard)] : [])],
          card: nextCard ?? card,
          from: answer,
          status: won ? "won" : "playing",
        }),
      );
      inputRef.current?.focus();
    });
  }

  function onPass() {
    if (isPending) return;
    startTransition(async () => {
      const nextCard = await pass(card, game!.from, game!.used, game!.date);
      const next = addLetter(game!, "pass");
      setFeedback({ tone: "info", text: `Passed. That's ${WORD[next.letters - 1]}.` });
      setGame(finish({ ...next, card: nextCard, used: [...next.used, cardKey(nextCard)] }));
    });
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {showHelp && <HowToPlay onClose={closeHelp} />}
      <div className="relative w-full">
        <Logo size="sm" />
        <Link
          href="/challenge"
          aria-label="Challenge a friend"
          className="absolute top-0 left-0 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 font-display text-sm tracking-wide text-amber-400 active:bg-white/10"
        >
          VS
        </Link>
        <HelpButton onClick={() => setShowHelp(true)} />
      </div>
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
        <label htmlFor="guess" className="text-center text-sm uppercase tracking-wider text-zinc-400">
          Name {askingFor}
        </label>
        <input
          ref={inputRef}
          id="guess"
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          placeholder={card.kind === "movie" ? "Actor's name" : "Movie title"}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="words"
          spellCheck={false}
          enterKeyHint="go"
          onFocus={(e) => {
            const el = e.currentTarget;
            // Keep the input above the on-screen keyboard.
            setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 300);
          }}
          disabled={isPending}
          className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3.5 text-lg outline-none placeholder:text-zinc-600 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onPass}
            disabled={isPending}
            className="min-h-12 rounded-xl border border-white/15 px-5 text-zinc-300 active:bg-white/5 disabled:opacity-50"
          >
            Pass
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
