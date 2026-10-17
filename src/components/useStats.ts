"use client";

import { useEffect, useState } from "react";
import { myDailyRecord } from "@/app/actions";
import { loadStats, saveDailyRecord, saveStreak } from "./storage";

/**
 * This browser's stats, then brought up to date from the server's record of finished dailies
 * (played, wins, links chart, streak), so every device linked by a save code matches.
 */
export function useSyncedStats() {
  const [stats, setStats] = useState(loadStats);
  useEffect(() => {
    myDailyRecord()
      .then((r) => {
        if (!r) return;
        saveDailyRecord(r);
        setStats(saveStreak(r.current, r.best, r.lastPlayed));
      })
      .catch(() => {});
  }, []);
  return stats;
}
