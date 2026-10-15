import type { Instrumentation } from "next";

/** Every server error (pages, server actions, API routes, crons) goes to the admin page's error log. */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const digest =
    typeof err === "object" && err !== null && "digest" in err ? String((err as { digest: unknown }).digest) : null;
  // Redirects and not-found are normal control flow, not errors.
  if (digest?.startsWith("NEXT_")) return;
  const message = err instanceof Error ? err.message : String(err);
  const { logError } = await import("./lib/errors");
  await logError(request.path.startsWith("/api/cron") ? "cron" : "server", message, `${context.routeType} ${request.path}`, digest);
};
