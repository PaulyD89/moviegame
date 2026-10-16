import type { Metadata } from "next";
import Link from "next/link";
import { HowToPlayRules } from "@/components/HowToPlay";
import { Logo } from "@/components/Logo";
import { Shell } from "@/components/Shell";

/**
 * The rules as a plain page search engines can read (the ? pop-up only exists after a tap).
 * Reached from the sitemap, not the footer, by the owner's choice.
 */
export const metadata: Metadata = {
  title: "How to Play Movie Horse — The Daily Movie Chain Game",
  description:
    "Movie Horse is a free daily movie trivia game. Name an actor in the movie, then a movie with that actor, and keep the chain going for 10 links. Don't spell M-O-V-I-E.",
  alternates: { canonical: "/how-to-play" },
};

export default function HowToPlayPage() {
  return (
    <Shell>
      <div className="relative w-full">
        <Link
          href="/"
          className="absolute top-0 left-0 z-10 flex h-11 items-center rounded-full border border-white/15 px-4 text-sm text-zinc-300 active:bg-white/10"
        >
          ← Play
        </Link>
        <Logo size="md" />
      </div>
      <article className="mt-4 space-y-6 text-[15px] leading-relaxed text-zinc-200">
        <header className="text-center">
          <h2 className="font-display text-[1.9rem] tracking-wide text-amber-400">HOW TO PLAY</h2>
          <p className="text-sm text-zinc-300">
            A free daily movie trivia game: a new chain of movies and actors every day.
          </p>
        </header>

        <section>
          <HowToPlayRules />
        </section>

        <Section title="What is Movie Horse?">
          Movie Horse is a daily movie game for anyone who loves films. Like HORSE in basketball, every miss
          earns you a letter, and spelling M-O-V-I-E means you&apos;re out. Each day everyone gets the same
          starting movie or actor, then builds their own chain: actor to movie, movie to actor, for 10 links. It
          takes a few minutes, works on any phone or computer, and needs no account or download.
        </Section>

        <Section title="Scoring and ranks">
          A win scores 10 points plus 2 for every letter you didn&apos;t use. Finishing without winning scores
          2. Each link answered within 20 seconds adds a speed bonus point. Your daily points add up to a
          monthly and an all-time global rank, which only you can see.
        </Section>

        <Section title="Streaks and badges">
          Play the daily on consecutive days to build a streak. Earn badges for your first win, a perfect game
          with no letters, all 10 links at full speed, a top-10 month and more. Play 7 days in a row and you can
          claim your own Movie Horse nickname, marked with a gold check.
        </Section>

        <Section title="Play with friends">
          Start a VS game and text the link to up to five friends. You take turns on one shared chain, live
          together or at your own pace, and the last player not to spell M-O-V-I-E wins.
        </Section>

        <Section title="Good to know">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Small typos and spellings by ear are fine; we&apos;ll show you the correct name.</li>
            <li>Alternate titles count, like &ldquo;The Road Warrior&rdquo; for Mad Max 2.</li>
            <li>After a wrong guess, skipping that card is free.</li>
            <li>A new chain starts every day at midnight Eastern.</li>
          </ul>
        </Section>

        <Link
          href="/"
          className="flex min-h-12 w-full items-center justify-center rounded-xl bg-amber-400 text-lg font-bold text-black active:scale-[0.98]"
        >
          Play today&apos;s Movie Chain
        </Link>
      </article>
    </Shell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-xs uppercase tracking-widest text-zinc-300">{title}</h3>
      <div>{children}</div>
    </section>
  );
}
