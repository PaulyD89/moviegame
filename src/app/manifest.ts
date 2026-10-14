import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "The Movie Game",
    short_name: "Movie Game",
    description: "Name the actor. Name the movie. Don't spell M-O-V-I-E.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0908",
    theme_color: "#0b0908",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" }],
  };
}
