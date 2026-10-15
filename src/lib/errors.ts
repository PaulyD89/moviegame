import "server-only";
import { createAdminClient } from "./supabase/admin";

export type ErrorSource = "server" | "phone" | "cron";

/** Record an error for the admin page. Never throws: logging must not break the game. */
export async function logError(source: ErrorSource, message: string, path?: string | null, digest?: string | null) {
  try {
    await createAdminClient()
      .from("app_errors")
      .insert({ source, message: message.slice(0, 500), path: path?.slice(0, 200) ?? null, digest: digest ?? null });
  } catch {
    // Nowhere left to report it; Vercel's logs still have it.
  }
}
