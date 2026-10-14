import { Game } from "@/components/Game";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="pb-4 text-center">
        <h1 className="font-display text-3xl tracking-widest text-white">MOVIE HORSE</h1>
        <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">Don&apos;t spell M-O-V-I-E</p>
      </header>

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
