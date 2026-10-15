import "server-only";
import { cookies } from "next/headers";

const COOKIE = "mh_pid";
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Anonymous player id, kept in an httpOnly cookie so it can't be swapped from the page. */
export async function playerId(create: true): Promise<string>;
export async function playerId(create: false): Promise<string | null>;
export async function playerId(create: boolean) {
  const store = await cookies();
  const existing = store.get(COOKIE)?.value;
  if (existing && UUID.test(existing)) return existing;
  if (!create) return null;
  const id = crypto.randomUUID();
  store.set(COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return id;
}
