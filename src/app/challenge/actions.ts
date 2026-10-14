"use server";

import { cookies } from "next/headers";
import {
  cleanNickname,
  createChallenge,
  joinChallenge,
  startChallenge,
  submitMove,
  viewChallenge,
} from "@/lib/challenge";

const COOKIE = "mh_pid";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Anonymous player id, kept in an httpOnly cookie so it can't be swapped from the page. */
async function playerId(create: true): Promise<string>;
async function playerId(create: false): Promise<string | null>;
async function playerId(create: boolean) {
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

function checkId(id: string) {
  if (!UUID.test(id)) throw new Error("Bad challenge id");
}

export async function create(nickname: string) {
  const name = cleanNickname(nickname);
  if (!name) throw new Error("Nickname required");
  return createChallenge(await playerId(true), name);
}

export async function join(id: string, nickname: string) {
  checkId(id);
  const name = cleanNickname(nickname);
  if (!name) return { ok: false as const, reason: "nickname" };
  return joinChallenge(id, await playerId(true), name);
}

export async function start(id: string) {
  checkId(id);
  return startChallenge(id, await playerId(true));
}

export async function move(id: string, version: number, guess: string | null) {
  checkId(id);
  return submitMove(id, await playerId(true), version, guess === null ? null : guess.slice(0, 120));
}

export async function view(id: string) {
  checkId(id);
  return viewChallenge(id, await playerId(false));
}
