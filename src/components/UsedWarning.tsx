/** Red heads-up for naming something already in the chain. Never costs a letter. */
export function UsedWarning({ name }: { name: string }) {
  return (
    <p
      role="alert"
      className="flex animate-pop items-center justify-center gap-2 rounded-xl border border-red-500/60 bg-red-950/60 px-4 py-2.5 text-center text-sm text-red-200"
    >
      <span aria-hidden>⚠️</span>
      <span>
        <b className="text-white">{name}</b> has already been used. No letter, try another.
      </span>
    </p>
  );
}
