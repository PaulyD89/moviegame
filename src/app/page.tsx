import type { Metadata } from "next";
import { Game } from "@/components/Game";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = { alternates: { canonical: "/" } };

/** Tells search engines this is a free browser game (shown in results as such). */
const structuredData = {
  "@context": "https://schema.org",
  "@type": "VideoGame",
  name: "Movie Horse",
  url: "https://moviehorsegame.com",
  description:
    "A free daily movie trivia game. Name an actor in the movie, then a movie with that actor, and keep the chain going for 10 links. Don't spell M-O-V-I-E.",
  genre: ["Trivia", "Puzzle", "Word game"],
  gamePlatform: ["Web browser", "iOS", "Android"],
  applicationCategory: "Game",
  playMode: ["SinglePlayer", "MultiPlayer"],
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  // The official accounts, so search engines link them to the game.
  sameAs: ["https://www.instagram.com/moviehorsegame/", "https://letterboxd.com/TheMovieHorse/"],
};

export default function Home() {
  return (
    <Shell>
      <script
        type="application/ld+json"
        // Static, trusted JSON; "<" is escaped so it can't close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <Game />
    </Shell>
  );
}
