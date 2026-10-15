"use client";

import { useState } from "react";
import { ProgressModal } from "./ProgressModal";

/** "Save progress" in the footer, or a line at the bottom of the stats window. */
export function ProgressLink({ className, children }: { className?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      {open && <ProgressModal onClose={() => setOpen(false)} />}
    </>
  );
}
