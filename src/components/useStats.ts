"use client";

import { useEffect, useState } from "react";
import { myStreak } from "@/app/actions";
import { loadStats, saveStreak } from "./storage";

/** This phone's stats, with the streak brought up to date from the server's record of finished dailies. */
export function useSyncedStats() {
  const [stats, setStats] = useState(loadStats);
  useEffect(() => {
    myStreak()
      .then((s) => s && setStats(saveStreak(s.current, s.best, s.lastPlayed)))
      .catch(() => {});
  }, []);
  return stats;
}
