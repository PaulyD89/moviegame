import { Game } from "@/components/Game";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="flex flex-1 flex-col">
        <Game />
      </div>

      <footer className="pt-6 text-center text-[11px] leading-relaxed text-zinc-600">
        Movie data &amp; images from TMDB. This product uses the TMDB API but is not endorsed or
        certified by TMDB.
      </footer>
    </main>
  );
}
