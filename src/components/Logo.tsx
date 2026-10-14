import Image from "next/image";

/** Compact during play so the poster and input fit; large on the results screen. */
export function Logo({ size }: { size: "sm" | "lg" }) {
  const large = size === "lg";
  return (
    <h1 className="flex justify-center">
      <Image
        src={large ? "/logo-960.webp" : "/logo-480.webp"}
        alt="Movie Horse"
        width={large ? 960 : 480}
        height={large ? 640 : 320}
        priority
        className={`h-auto drop-shadow-[0_6px_24px_rgb(251_191_36/0.25)] ${large ? "w-72" : "w-36"}`}
      />
    </h1>
  );
}
