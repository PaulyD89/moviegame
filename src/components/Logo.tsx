import Image from "next/image";
import Link from "next/link";

/** Compact during play so the poster and input fit; large on the results screen. Links home. */
export function Logo({ size }: { size: "sm" | "lg" }) {
  const large = size === "lg";
  return (
    <h1 className="flex justify-center">
      <Link
        href="/"
        aria-label="Movie Horse: back to today's Movie Chain"
        className="rounded-xl outline-none transition-transform hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.98]"
      >
        <Image
          src={large ? "/logo-960.webp" : "/logo-480.webp"}
          alt="Movie Horse"
          width={large ? 960 : 480}
          height={large ? 640 : 320}
          priority
          className={`h-auto drop-shadow-[0_6px_24px_rgb(251_191_36/0.25)] ${large ? "w-72" : "w-36"}`}
        />
      </Link>
    </h1>
  );
}
