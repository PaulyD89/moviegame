"use server";

import {
  cleanNickname,
  createChallenge,
  findByCode,
  joinChallenge,
  startChallenge,
  submitMove,
  summarizeChallenges,
  viewChallenge,
} from "@/lib/challenge";
import { playerId, UUID } from "@/lib/player";

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

export async function lookupCode(code: string) {
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  return clean ? findByCode(clean) : null;
}

/** Status of the games this device has played, for the "Your games" list. */
export async function myGames(ids: string[]) {
  const valid = ids.filter((id) => UUID.test(id)).slice(0, 20);
  if (valid.length === 0) return [];
  return summarizeChallenges(valid, await playerId(false));
}
