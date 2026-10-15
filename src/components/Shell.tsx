import Link from "next/link";
import { ProgressLink } from "./progress/ProgressLink";

/** Page frame shared by every screen: phone-width column, safe areas, TMDB credit. */
export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="flex flex-1 flex-col">{children}</div>

      <footer className="pt-6 text-center text-[11px] leading-relaxed text-zinc-400">
        <nav className="mb-1.5 flex justify-center gap-4 text-xs text-zinc-300">
          <Link href="/privacy" className="underline-offset-2 hover:underline">
            Privacy
          </Link>
          <a href="mailto:moviehorsegame@gmail.com" className="underline-offset-2 hover:underline">
            Contact
          </a>
          <ProgressLink className="underline-offset-2 hover:underline">Save Progress</ProgressLink>
        </nav>
        Movie data &amp; images from TMDB. This product uses the TMDB API but is not endorsed or
        certified by TMDB.
      </footer>
    </main>
  );
}
