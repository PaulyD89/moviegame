"use client";

import { track } from "@vercel/analytics";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { join, kick, move, rematch, start, view, waitlist } from "@/app/challenge/actions";
import {
  MAX_PLAYERS,
  SHOT_CLOCK_MS,
  type ChallengeMove,
  type ChallengePlayer,
  type ChallengeView,
} from "@/lib/challenge-types";
import { WORD, type Card } from "@/lib/types";
import { Logo } from "../Logo";
import { NotifyButton } from "../push/NotifyButton";
import { recordChallenge } from "../storage";
import { UsedWarning } from "../UsedWarning";
import { backupAfterGame } from "../progress/snapshot";
import { markResultSeen, rememberGame } from "./myGames";
import { loadNickname, saveNickname } from "./nickname";

const POLL_MS = 2_000;

export function ChallengeRoom({ id }: { id: string }) {
  const [state, setState] = useState<ChallengeView | null | undefined>(undefined);
  const [offset, setOffset] = useState(0); // server clock minus ours, for the shot clock
  const refresh = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    let active = true;
    async function tick() {
      if (document.hidden) return;
      try {
        const next = await view(id);
        if (!active) return;
        setState(next);
        if (next) setOffset(next.serverNow - Date.now());
        if ((next?.youSeat !== null && next?.youSeat !== undefined) || next?.youWaiting) rememberGame(next.id);
      } catch {
        // Network blip; the next poll will catch up.
      }
    }
    // Leaving the screen tells the server right away, so turn alerts start again.
    // (While you're watching, the game shows moves itself and skips the notification.)
    const away = () => navigator.sendBeacon?.(`/api/challenge/${id}/away`);
    const onVisibility = () => (document.hidden ? away() : tick());
    refresh.current = tick;
    tick();
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", away);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", away);
      away();
    };
  }, [id]);

  if (state === undefined) {
    return <Centered>Loading challenge…</Centered>;
  }
  if (state === null) {
    return (
      <Centered>
        <p>This challenge doesn&apos;t exist.</p>
        <Link href="/challenge" className="mt-4 inline-block text-amber-400 underline">
          Start a new one
        </Link>
      </Centered>
    );
  }

  const reload = () => refresh.current();
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <Header />
      {state.status === "lobby" && <Lobby state={state} reload={reload} />}
      {state.status === "playing" && <Playing state={state} offset={offset} reload={reload} />}
      {state.status === "finished" && <Finished state={state} reload={reload} />}
    </div>
  );
}

function Header() {
  return (
    <div className="relative w-full">
      <Logo size="sm" />
      <Link
        href="/"
        className="absolute top-0 left-0 flex h-11 items-center rounded-full border border-white/15 px-4 text-sm text-zinc-300 active:bg-white/10"
      >
        ← Daily
      </Link>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="p-8 text-center text-zinc-400">{children}</div>;
}

/* ---------- Lobby ---------- */

function Lobby({ state, reload }: { state: ChallengeView; reload: () => Promise<void> }) {
  const joined = state.youSeat !== null;
  const host = state.players.find((p) => p.isHost)?.nickname ?? "The host";
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div className="text-center">
        <h2 className="font-display text-4xl tracking-wide text-amber-400">
          {joined ? "THE LOBBY" : "YOU'VE BEEN CHALLENGED"}
        </h2>
        <p className="mt-1 text-zinc-300">
          {joined
            ? "Invite up to " + MAX_PLAYERS + " players, then start."
            : `${host} wants to play Movie Horse. Take turns naming actors and movies. First to spell M-O-V-I-E is out.`}
        </p>
      </div>

      <ul className="w-full space-y-2">
        {state.players.map((p) => (
          <li
            key={p.seat}
            className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3"
          >
            <span className="flex items-center gap-2 font-medium">
              <LiveDot live={p.live} />
              {p.nickname}
              {p.isYou && <span className="text-xs text-zinc-500">(you)</span>}
            </span>
            {p.isHost ? (
              <span className="text-xs uppercase tracking-wider text-amber-400">Host</span>
            ) : (
              state.youAreHost && (
                <button
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      if (!(await kick(state.id, p.seat))) setError(`Couldn't remove ${p.nickname}.`);
                      await reload();
                    })
                  }
                  aria-label={`Remove ${p.nickname}`}
                  className="-my-2 -mr-2 flex h-11 items-center rounded-lg px-3 text-sm text-zinc-400 active:bg-white/10"
                >
                  Remove
                </button>
              )
            )}
          </li>
        ))}
      </ul>

      {state.code && (
        <div className="text-center">
          <div className="text-xs uppercase tracking-widest text-zinc-300">Game code</div>
          <div className="font-display text-4xl tracking-[0.3em] text-white">{state.code}</div>
        </div>
      )}

      {joined ? (
        <>
          <InviteButton host={host} code={state.code} />
          <NotifyButton mode="challenge" code={state.code} />
          {state.youAreHost ? (
            <button
              disabled={isPending || state.players.length < 2}
              onClick={() =>
                startTransition(async () => {
                  const ok = await start(state.id);
                  if (!ok) setError("Couldn't start. Need at least 2 players.");
                  await reload();
                })
              }
              className="min-h-12 w-full rounded-xl border border-amber-400 text-lg font-bold text-amber-400 active:scale-[0.98] disabled:opacity-40"
            >
              {isPending
                ? "Starting…"
                : state.players.length < 2
                  ? "Waiting for a friend to join…"
                  : `Start game (${state.players.length} players)`}
            </button>
          ) : (
            <p className="text-center text-zinc-400">Waiting for {host} to start the game…</p>
          )}
        </>
      ) : (
        <>
          <IPhoneJoinHint code={state.code} />
          <JoinForm id={state.id} reload={reload} />
        </>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}

function JoinForm({ id, reload }: { id: string; reload: () => Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (inputRef.current && !inputRef.current.value) inputRef.current.value = loadNickname();
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nickname = inputRef.current?.value.trim() ?? "";
    if (!nickname) return setError("Pick a nickname first.");
    startTransition(async () => {
      saveNickname(nickname);
      const result = await join(id, nickname);
      if (result.ok) track("challenge_joined");
      if (!result.ok) {
        setError(
          result.reason === "full"
            ? "This game is full."
            : result.reason === "started"
              ? "This game already started."
              : "Couldn't join. Try again.",
        );
      }
      await reload();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-3">
      <input
        ref={inputRef}
        maxLength={20}
        autoComplete="nickname"
        placeholder="Your nickname"
        aria-label="Your nickname"
        className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3.5 text-lg outline-none placeholder:text-zinc-600 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30"
      />
      <button
        type="submit"
        disabled={isPending}
        className="min-h-12 rounded-xl bg-amber-400 text-lg font-bold text-black active:scale-[0.98] disabled:opacity-40"
      >
        {isPending ? "Joining…" : "Join the game"}
      </button>
      {error && <p className="text-center text-sm text-red-400">{error}</p>}
    </form>
  );
}

function InviteButton({
  host,
  code,
  label = "Invite friends",
}: {
  host: string;
  code?: string | null;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  async function invite() {
    const url = window.location.origin + window.location.pathname;
    const text =
      `${host} challenged you to Movie Horse 🐴 Name actors & movies. Don't spell M-O-V-I-E.` +
      (code ? ` Game code: ${code}` : "");
    try {
      if (navigator.share) return await navigator.share({ title: "Movie Horse", text, url });
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Share sheet dismissed.
    }
  }
  return (
    <button
      onClick={invite}
      className="min-h-12 w-full rounded-xl bg-amber-400 text-lg font-bold text-black active:scale-[0.98]"
    >
      {copied ? "Link copied!" : label}
    </button>
  );
}

/* ---------- Playing ---------- */

function Playing({
  state,
  offset,
  reload,
}: {
  state: ChallengeView;
  offset: number;
  reload: () => Promise<void>;
}) {
  const current = state.players.find((p) => p.seat === state.turnSeat);
  const me = state.players.find((p) => p.isYou);
  const myTurn = !!me && state.turnSeat === me.seat;
  const card = state.card!;

  // Buzz and retitle the tab when it becomes your turn.
  const wasMyTurn = useRef(myTurn);
  useEffect(() => {
    if (myTurn && !wasMyTurn.current) navigator.vibrate?.([60, 40, 60]);
    wasMyTurn.current = myTurn;
    document.title = myTurn ? "Your turn! — Movie Horse" : "Movie Horse";
  }, [myTurn]);

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {!me && (
        <p className="w-full rounded-xl bg-amber-400/15 px-4 py-3 text-center text-sm text-amber-100 ring-1 ring-amber-400/50">
          🍿 This game started without you. You&apos;re watching live.
        </p>
      )}
      <PlayerStrip players={state.players} turnSeat={state.turnSeat} />
      <LastMove move={state.moves.at(-1)} />
      {state.turnDeadline && (
        <ShotClock deadline={state.turnDeadline} offset={offset} key={state.version} />
      )}
      <CardArt card={card} key={`${card.kind}:${card.id}`} />

      {myTurn ? (
        <TurnForm state={state} reload={reload} />
      ) : (
        <div className="w-full rounded-xl bg-white/5 p-4 text-center">
          <p className="text-zinc-200">
            {me?.out ? "You're out! " : ""}Waiting for{" "}
            <b className="text-white">{current?.nickname}</b>
            {card.kind === "movie" ? " to name an actor…" : " to name a movie…"}
          </p>
          {me && current && !current.live && (
            <>
              <p className="mt-1 text-sm text-zinc-500">
                They&apos;re not on the screen right now. The game is saved; give them a nudge.
                {!state.turnDeadline && " If they don't play within a day, they're skipped and get a letter."}
              </p>
              <div className="mt-3">
                <InviteButton host={me?.nickname ?? "A friend"} code={state.code} label={`Nudge ${current.nickname}`} />
              </div>
            </>
          )}
        </div>
      )}

      {!myTurn && me && !me.out && <NotifyButton mode="challenge" code={state.code} />}
      {!me && <NextGamePanel state={state} reload={reload} />}
      {me && <WaitingFriends names={state.waiting} />}
      <ChainLog moves={state.moves} />
    </div>
  );
}

/** iPhone players who want turn alerts should join from the Home Screen app. */
function IPhoneJoinHint({ code }: { code: string | null }) {
  const [show] = useState(
    () =>
      typeof navigator !== "undefined" &&
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !window.matchMedia("(display-mode: standalone)").matches,
  );
  if (!show || !code) return null;
  return (
    <p className="rounded-xl bg-white/5 p-3 text-center text-sm text-zinc-200">
      📱 Want a ping when it&apos;s your turn? Add Movie Horse to your Home Screen (Share → Add to Home
      Screen), open it, then tap <b>VS</b> → <b>Join with code</b> <b className="tracking-widest text-amber-400">{code}</b>.
      Or just join here.
    </p>
  );
}

function TurnForm({ state, reload }: { state: ChallengeView; reload: () => Promise<void> }) {
  const [guess, setGuess] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [used, setUsed] = useState<{ name: string; id: number } | null>(null);
  const [isPending, startTransition] = useTransition();
  const card = state.card!;

  function send(text: string | null) {
    if (isPending) return;
    setUsed(null);
    startTransition(async () => {
      const result = await move(state.id, state.version, text);
      if (!result.ok) {
        if (result.reason === "used") {
          setGuess("");
          setUsed({ name: result.answer.name, id: Date.now() });
          return;
        }
        if (result.reason === "slow") return setFeedback("Whoa, slow down a sec. Try again in a moment.");
        setFeedback("The game moved on. Refreshing…");
        await reload();
        return;
      }
      setGuess("");
      setFeedback(null);
      if (result.outcome === "wrong") navigator.vibrate?.(120);
      await reload();
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (guess.trim()) send(guess.trim());
      }}
      className="flex w-full flex-col gap-2"
    >
      <label htmlFor="guess" className="text-center text-sm uppercase tracking-wider text-amber-400">
        Your turn! Name {card.kind === "movie" ? "an actor in this movie" : "a movie this actor was in"}
      </label>
      <input
        id="guess"
        value={guess}
        onChange={(e) => setGuess(e.target.value)}
        placeholder={card.kind === "movie" ? "Actor's name" : "Movie title"}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="words"
        spellCheck={false}
        enterKeyHint="go"
        disabled={isPending}
        autoFocus
        className="w-full rounded-xl border border-amber-400/60 bg-black/40 px-4 py-3.5 text-lg outline-none placeholder:text-zinc-600 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => send(null)}
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
      {used ? (
        <UsedWarning key={used.id} name={used.name} />
      ) : (
        <p className="min-h-5 text-center text-sm text-zinc-400" aria-live="polite">
          {feedback ?? "One shot per turn. Miss or pass and you get a letter."}
        </p>
      )}
    </form>
  );
}

function ShotClock({ deadline, offset }: { deadline: number; offset: number }) {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + offset), 200);
    return () => clearInterval(t);
  }, [offset]);
  const left = Math.max(0, deadline - now);
  const pct = (left / SHOT_CLOCK_MS) * 100;
  const urgent = left < 10_000;
  return (
    <div className="flex w-full items-center gap-3" aria-label={`${Math.ceil(left / 1000)} seconds left`}>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-[width] duration-200 ease-linear ${urgent ? "bg-red-500" : "bg-amber-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`w-8 text-right font-display text-xl ${urgent ? "text-red-400" : "text-zinc-300"}`}>
        {Math.ceil(left / 1000)}
      </span>
    </div>
  );
}

/* ---------- Shared pieces ---------- */

function LiveDot({ live }: { live: boolean }) {
  return (
    <span
      className={`h-2 w-2 shrink-0 rounded-full ${live ? "bg-emerald-400" : "bg-zinc-600"}`}
      aria-label={live ? "on screen" : "away"}
    />
  );
}

function PlayerStrip({ players, turnSeat }: { players: ChallengePlayer[]; turnSeat: number | null }) {
  return (
    <ul className="flex w-full flex-wrap justify-center gap-2">
      {players.map((p) => (
        <li
          key={p.seat}
          className={`min-w-0 rounded-xl px-3 py-2 ring-1 transition ${
            p.seat === turnSeat
              ? "bg-amber-400/15 ring-amber-400"
              : p.out
                ? "opacity-40 ring-white/10"
                : "ring-white/10"
          }`}
        >
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <LiveDot live={p.live} />
            <span className="max-w-24 truncate">{p.isYou ? "You" : p.nickname}</span>
          </div>
          <div className="mt-1 flex gap-0.5">
            {WORD.split("").map((ch, i) => (
              <span
                key={ch}
                className={`flex h-4 w-4 items-center justify-center rounded-sm font-display text-[9px] ${
                  i < p.letters ? "bg-red-600 text-white" : "bg-white/5 text-white/20"
                }`}
              >
                {ch}
              </span>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

function describe(m: ChallengeMove) {
  switch (m.outcome) {
    case "correct":
      return { tone: "text-emerald-400", text: `${m.nickname} said ${m.answer?.name} ✓` };
    case "wrong":
      return { tone: "text-red-400", text: `${m.nickname} guessed "${m.guess}" ✗ and gets a letter` };
    case "pass":
      return { tone: "text-zinc-400", text: `${m.nickname} passed and gets a letter` };
    case "timeout":
      return { tone: "text-red-400", text: `${m.nickname} ran out of time and gets a letter` };
    case "skip":
      return { tone: "text-red-400", text: `${m.nickname} didn't play for a day, got skipped and gets a letter` };
  }
}

function LastMove({ move }: { move?: ChallengeMove }) {
  if (!move) return <p className="min-h-5 text-sm text-zinc-500">First up: name the opposite!</p>;
  const { tone, text } = describe(move);
  return (
    <p key={move.id} className={`min-h-5 animate-fade text-center text-sm ${tone}`}>
      {text}
    </p>
  );
}

function CardArt({ card }: { card: Card }) {
  return (
    <figure className="flex animate-rise flex-col items-center gap-2">
      <div className="relative aspect-[2/3] w-[min(46vw,22dvh)] overflow-hidden rounded-xl bg-zinc-800 shadow-2xl shadow-amber-950/40 ring-1 ring-white/10">
        {card.image ? (
          <Image src={card.image} alt={card.name} fill sizes="200px" className="object-cover" priority />
        ) : (
          <div className="flex h-full items-center justify-center p-3 text-center text-zinc-400">{card.name}</div>
        )}
      </div>
      <figcaption className="text-center">
        <div className="text-balance text-lg font-semibold leading-tight">{card.name}</div>
        {card.year && <div className="text-sm text-zinc-400">{card.year}</div>}
      </figcaption>
    </figure>
  );
}

function ChainLog({ moves }: { moves: ChallengeMove[] }) {
  if (moves.length === 0) return null;
  return (
    <details className="w-full rounded-xl bg-white/5 p-3 text-sm">
      <summary className="cursor-pointer text-zinc-400">Game log ({moves.length})</summary>
      <ol className="mt-2 space-y-1">
        {[...moves].reverse().map((m) => {
          const { tone, text } = describe(m);
          return (
            <li key={m.id} className={tone}>
              <span className="text-zinc-500">{m.prompt.name} → </span>
              {text}
            </li>
          );
        })}
      </ol>
    </details>
  );
}

/* ---------- Late arrivals ---------- */

/** For someone who opened the link after the start: get a seat in the next game. */
function NextGamePanel({ state, reload }: { state: ChallengeView; reload: () => Promise<void> }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (inputRef.current && !inputRef.current.value) inputRef.current.value = loadNickname();
  }, [state.youWaiting]);

  if (state.youInNext && state.rematchId) {
    return (
      <Link
        href={`/c/${state.rematchId}`}
        className="flex min-h-12 w-full items-center justify-center rounded-xl bg-amber-400 text-lg font-bold text-black active:scale-[0.98]"
      >
        You&apos;re in! Go to the next game →
      </Link>
    );
  }
  if (state.youWaiting) {
    return (
      <div className="flex w-full flex-col gap-3 rounded-xl bg-white/5 p-4 text-center">
        <p className="text-white">✓ You&apos;re in the next game.</p>
        <p className="text-sm text-zinc-300">
          When someone taps Rematch, you&apos;ll be added automatically. Watch along until then.
        </p>
        <NotifyButton mode="challenge" code={state.code} />
      </div>
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nickname = inputRef.current?.value.trim() ?? "";
    if (!nickname) return setError("Pick a nickname first.");
    startTransition(async () => {
      saveNickname(nickname);
      const result = await waitlist(state.id, nickname);
      if (!result.ok) {
        setError(result.reason === "full" ? "The next game is already full." : "Couldn't add you. Try again.");
        return;
      }
      track("challenge_waitlisted");
      if ("rematchId" in result && result.rematchId) router.push(`/c/${result.rematchId}`);
      else await reload();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-3 rounded-xl bg-white/5 p-4">
      <p className="text-center text-sm text-zinc-200">
        Want to play? Get a seat in the next game. You&apos;ll be added when someone taps Rematch.
      </p>
      <input
        ref={inputRef}
        maxLength={20}
        autoComplete="nickname"
        placeholder="Your nickname"
        aria-label="Your nickname"
        className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3.5 text-lg outline-none placeholder:text-zinc-600 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30"
      />
      <button
        type="submit"
        disabled={isPending}
        className="min-h-12 rounded-xl bg-amber-400 text-lg font-bold text-black active:scale-[0.98] disabled:opacity-40"
      >
        {isPending ? "Saving your seat…" : "Put me in the next game"}
      </button>
      {error && <p className="text-center text-sm text-red-400">{error}</p>}
    </form>
  );
}

/** Lets the players know friends are waiting, so someone starts a rematch. */
function WaitingFriends({ names, finished }: { names: string[]; finished?: boolean }) {
  if (names.length === 0) return null;
  const who = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return (
    <p className="w-full rounded-xl bg-white/5 px-4 py-3 text-center text-sm text-zinc-200">
      ⏳ <b className="text-white">{who}</b> {names.length === 1 ? "is" : "are"} waiting for the next game.
      {finished && " Tap Rematch to bring them in."}
    </p>
  );
}

/* ---------- Finished ---------- */

function Finished({ state, reload }: { state: ChallengeView; reload: () => Promise<void> }) {
  const router = useRouter();
  const me = state.players.find((p) => p.isYou);
  const youWon = !!me && state.winnerSeat === me.seat;
  const [isPending, startTransition] = useTransition();

  // Count this game in the device's challenge stats (once per game).
  useEffect(() => {
    if (!me) return;
    recordChallenge(state.id, youWon);
    markResultSeen(state.id);
    backupAfterGame();
  }, [me, state.id, youWon]);
  const standings = finalStandings(state);
  const chain = state.moves.filter((m) => m.outcome === "correct" && m.answer);

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div className="text-center">
        <h2 className="font-display text-5xl tracking-wide text-amber-400">
          {youWon ? "YOU WIN!" : `${state.winner ?? "Nobody"} WINS`}
        </h2>
        <p className="mt-1 text-zinc-300">
          {youWon ? "Last one standing. Everyone else spelled it." : "Last one standing takes it."}
        </p>
      </div>

      <ol className="w-full space-y-2">
        {standings.map((p, i) => (
          <li key={p.seat} className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
            <span className="font-medium">
              {i === 0 ? "🏆 " : `${i + 1}. `}
              {p.nickname}
              {p.isYou && <span className="text-xs text-zinc-500"> (you)</span>}
            </span>
            <span className="font-display tracking-widest text-red-400">
              {WORD.slice(0, p.letters) || "—"}
            </span>
          </li>
        ))}
      </ol>

      {chain.length > 0 && (
        <div className="w-full">
          <div className="mb-2 text-xs uppercase tracking-wider text-zinc-500">
            {chain.length} {chain.length === 1 ? "link" : "links"} made
          </div>
          <ol className="-mx-4 flex w-[calc(100%+2rem)] snap-x gap-3 overflow-x-auto px-4 pb-2">
            {chain.map((m) => (
              <li key={m.id} className="w-20 shrink-0 snap-start text-center">
                <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-zinc-800 ring-1 ring-white/10">
                  {m.answer!.image && (
                    <Image src={m.answer!.image} alt={m.answer!.name} fill sizes="80px" className="object-cover" />
                  )}
                </div>
                <div className="mt-1 line-clamp-2 text-[11px] text-zinc-300">{m.answer!.name}</div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {me && <ShareChallenge state={state} standings={standings} links={chain.length} youWon={youWon} />}
      {me && !state.rematchId && <WaitingFriends names={state.waiting} finished />}
      {!me && <NextGamePanel state={state} reload={reload} />}
      {me && state.rematchId ? (
        <Link
          href={`/c/${state.rematchId}`}
          className="flex min-h-12 w-full items-center justify-center rounded-xl bg-amber-400 text-lg font-bold text-black active:scale-[0.98]"
        >
          Join the rematch →
        </Link>
      ) : me ? (
        <button
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const id = await rematch(state.id);
              track("rematch");
              if (id) router.push(`/c/${id}`);
            })
          }
          className="min-h-12 w-full rounded-xl bg-amber-400 text-lg font-bold text-black active:scale-[0.98] disabled:opacity-50"
        >
          {isPending ? "Setting up…" : "🔁 Rematch"}
        </button>
      ) : null}
      <Link
        href="/challenge"
        className="flex min-h-12 w-full items-center justify-center rounded-xl border border-white/20 text-lg font-semibold text-white active:scale-[0.98]"
      >
        New challenge
      </Link>
      <Link href="/" className="text-sm text-zinc-400 underline">
        Play today&apos;s daily
      </Link>
    </div>
  );
}

/**
 * Winner first, then everyone else by when they were knocked out (last out = 2nd).
 * A player's knock-out moment is their final miss in the game log.
 */
function finalStandings(state: ChallengeView) {
  const lastMiss = new Map<number, number>();
  state.moves.forEach((m, i) => {
    if (m.outcome !== "correct") lastMiss.set(m.seat, i);
  });
  return [...state.players].sort((a, b) => {
    if (a.seat === state.winnerSeat) return -1;
    if (b.seat === state.winnerSeat) return 1;
    if (a.letters !== b.letters) return a.letters - b.letters;
    return (lastMiss.get(b.seat) ?? -1) - (lastMiss.get(a.seat) ?? -1);
  });
}

const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? "th"}`;

export function challengeShareText(standings: ChallengePlayer[], links: number, youWon: boolean) {
  const others = standings.length - 1;
  const place = standings.findIndex((p) => p.isYou) + 1;
  const medal = ["🏆", "🥈", "🥉"][place - 1] ?? "🎬";
  const headline = youWon
    ? `🏆 I beat ${others} ${others === 1 ? "friend" : "friends"} at Movie Horse!`
    : `${medal} I finished ${ordinal(place)} of ${standings.length} at Movie Horse`;
  const board = standings.map((p, i) => {
    const tiles = WORD.split("").map((_, j) => (j < p.letters ? "🟥" : "⬛")).join("");
    return `${i === 0 ? "🏆" : `${i + 1}.`} ${p.nickname} ${tiles}`;
  });
  return [headline, `🔗 ${links}-link chain 🐴`, ...board].join("\n");
}

function ShareChallenge({
  state,
  standings,
  links,
  youWon,
}: {
  state: ChallengeView;
  standings: ChallengePlayer[];
  links: number;
  youWon: boolean;
}) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const text = challengeShareText(standings, links, youWon);
    const url = `${window.location.origin}/challenge`;
    const tail = youWon ? `Think you can beat me? ${url}` : `Play us: ${url}`;
    track("challenge_shared", { won: youWon, players: state.players.length });
    try {
      if (navigator.share) return await navigator.share({ text: `${text}\n${tail}` });
      await navigator.clipboard.writeText(`${text}\n${tail}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Share sheet dismissed.
    }
  }
  return (
    <button
      onClick={share}
      className="min-h-12 w-full rounded-xl border border-amber-400 text-lg font-bold text-amber-400 active:scale-[0.98]"
    >
      {copied ? "Copied!" : youWon ? "📣 Share your win" : "📣 Share result"}
    </button>
  );
}
