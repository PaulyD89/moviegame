import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: "Privacy — Movie Horse",
  description: "What Movie Horse stores, what it doesn't, and how to reach us.",
};

const CONTACT = "moviehorsegame@gmail.com";

export default function PrivacyPage() {
  return (
    <Shell>
      <Logo size="sm" />
      <article className="mt-4 space-y-6 text-[15px] leading-relaxed text-zinc-200">
        <header>
          <h2 className="font-display text-4xl tracking-wide text-amber-400">PRIVACY</h2>
          <p className="text-sm text-zinc-400">Last updated October 14, 2026</p>
        </header>

        <p className="text-white">
          Movie Horse is a game, not a data business. There are no accounts, no ads, and we never sell
          or share your information.
        </p>

        <Section title="What stays on your device">
          Your daily game progress, your stats and streaks, the nickname you last used, and the list of
          challenges you&apos;ve joined are saved in your browser. Clearing your browser&apos;s site data
          for moviehorsegame.com erases them.
        </Section>

        <Section title="What we store on our servers">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <b className="text-white">An anonymous player ID.</b> A random code kept in a cookie so the game
              can recognize you in challenges. It isn&apos;t linked to your name, email, or phone number.
            </li>
            <li>
              <b className="text-white">Challenge games.</b> The nickname you choose and the moves in each game.
              Other players in that game can see your nickname.
            </li>
            <li>
              <b className="text-white">Daily results.</b> For each daily Movie Chain: how far you got, letters,
              and time, tied only to the anonymous ID. We use these for overall counts,
              the &ldquo;you beat X% of players&rdquo; line, and your global rank. Rankings only show you
              your own place; nobody else can see your rank or results.
            </li>
            <li>
              <b className="text-white">Notification settings</b>, only if you turn notifications on: the address
              your browser gives us for sending them, and whether you want the nightly reminder.
            </li>
          </ul>
        </Section>

        <Section title="Analytics">
          We use Vercel Web Analytics to see things like page visits, country, and device type, plus a few
          game events (for example, &ldquo;finished the daily&rdquo;). It doesn&apos;t use cookies and doesn&apos;t
          track you across other sites.
        </Section>

        <Section title="Services we use">
          The site runs on Vercel, game data is stored with Supabase, and movie data and images come from
          TMDB. Notifications are delivered by your browser&apos;s own push service (Apple, Google, or
          Mozilla). This product uses the TMDB API but is not endorsed or certified by TMDB.
        </Section>

        <Section title="Your choices">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Turn notifications off anytime in your phone or browser settings.</li>
            <li>Clear the site&apos;s data in your browser to remove what&apos;s stored on your device.</li>
            <li>
              To delete server data, email us with your game codes and we&apos;ll remove those games and their
              results.
            </li>
          </ul>
        </Section>

        <Section title="Kids">Movie Horse isn&apos;t aimed at children under 13, and we don&apos;t knowingly collect their information.</Section>

        <Section title="Contact" id="contact">
          Questions, feedback, or a movie we got wrong? Email{" "}
          <a href={`mailto:${CONTACT}`} className="font-semibold text-amber-400 underline">
            {CONTACT}
          </a>
          .
        </Section>
      </article>
    </Shell>
  );
}

function Section({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id}>
      <h3 className="mb-1.5 text-xs uppercase tracking-widest text-zinc-300">{title}</h3>
      <div>{children}</div>
    </section>
  );
}
