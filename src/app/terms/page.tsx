import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: "Terms of Use — Movie Horse",
  description: "The ground rules for playing Movie Horse.",
};

const CONTACT = "moviehorsegame@gmail.com";

export default function TermsPage() {
  return (
    <Shell>
      <div className="relative w-full">
        <Link
          href="/"
          className="absolute top-0 left-0 z-10 flex h-11 items-center rounded-full border border-white/15 px-4 text-sm text-zinc-300 active:bg-white/10"
        >
          ← Daily
        </Link>
        <Logo size="lg" />
      </div>
      <article className="mt-4 space-y-6 text-[15px] leading-relaxed text-zinc-200">
        <header className="text-center">
          <h2 className="font-display text-[1.9rem] tracking-wide text-amber-400">TERMS OF USE</h2>
          <p className="text-sm text-zinc-400">Last updated October 15, 2026</p>
        </header>

        <p className="text-white">
          Movie Horse is a free movie game. By playing, you agree to these terms. They&apos;re short, and
          they&apos;re written in plain English.
        </p>

        <Section title="Playing the game">
          Movie Horse is free and needs no account. You can play the daily Movie Chain, challenge friends, and
          use features like notifications and save codes. We may add, change, or remove features at any time,
          and the game may occasionally be unavailable.
        </Section>

        <Section title="Play fair">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Don&apos;t use bots, scripts, or automated tools to play, guess, or create games.</li>
            <li>Don&apos;t try to fake scores, rankings, or results, or to get around limits we put in place.</li>
            <li>Don&apos;t interfere with the site, overload it, or try to access data that isn&apos;t yours.</li>
            <li>
              Keep nicknames friendly. No hateful, harassing, sexual, or impersonating names. We may remove
              nicknames, games, or rankings that break these rules.
            </li>
          </ul>
        </Section>

        <Section title="Rankings and results">
          Global rankings, points, and &ldquo;how you compare&rdquo; stats are for fun. We may adjust scoring,
          reset or remove results that look automated or unfair, and change how rankings work. There are no
          prizes unless we announce otherwise.
        </Section>

        <Section title="Save codes and challenge links">
          Anyone with your save code can restore your progress, and anyone with a challenge link can open that
          game. Keep them to yourself and the friends you invite. We aren&apos;t responsible for progress lost
          because a code was shared.
        </Section>

        <Section title="Movie data and other services">
          Movie titles, cast, and images come from TMDB. This product uses the TMDB API but is not endorsed or
          certified by TMDB. Links to Letterboxd and other sites are for convenience; those sites have their own
          terms. Movie Horse isn&apos;t affiliated with any studio, TMDB, or Letterboxd, and all movie titles,
          images, and trademarks belong to their owners.
        </Section>

        <Section title="Our stuff">
          The Movie Horse name, logo, design, and game are ours. You&apos;re welcome to share screenshots and
          results; please don&apos;t copy the game or use our name and logo in a way that suggests you&apos;re us.
        </Section>

        <Section title="No guarantees">
          The game is provided &ldquo;as is.&rdquo; We work to keep answers and data accurate, but movie data can
          have mistakes, and we can&apos;t promise the game will always be available, error-free, or that every
          correct answer will be recognized. To the extent the law allows, we aren&apos;t liable for any damages
          from using Movie Horse.
        </Section>

        <Section title="Age">
          Movie Horse isn&apos;t aimed at children under 13. If you&apos;re under 18, play with a parent or
          guardian&apos;s permission.
        </Section>

        <Section title="Changes">
          We may update these terms. When we do, we&apos;ll change the date at the top. If you keep playing after
          a change, the new terms apply.
        </Section>

        <Section title="Contact">
          Questions about these terms? Email{" "}
          <a href={`mailto:${CONTACT}`} className="font-semibold text-amber-400 underline">
            {CONTACT}
          </a>
          . Also see our{" "}
          <Link href="/privacy" className="font-semibold text-amber-400 underline">
            Privacy page
          </Link>
          .
        </Section>

        <Link
          href="/"
          className="flex min-h-12 w-full items-center justify-center rounded-xl bg-amber-400 text-lg font-bold text-black active:scale-[0.98]"
        >
          Back to the game
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
