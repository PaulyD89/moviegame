"use server";

import {
  cleanNickname,
  createChallenge,
  findByCode,
  joinChallenge,
  rematchChallenge,
  removeFromLobby,
  startChallenge,
  submitMove,
  summarizeChallenges,
  viewChallenge,
} from "@/lib/challenge";
import type { MoveResult } from "@/lib/challenge-types";
import { playerId, UUID } from "@/lib/player";
import { allow } from "@/lib/rate-limit";

function checkId(id: string) {
  if (!UUID.test(id)) throw new Error("Bad challenge id");
}

export async function create(nickname: string) {
  const name = cleanNickname(nickname);
  if (!name) throw new Error("Nickname required");
  const pid = await playerId(true);
  if (!(await allow("create", pid))) return { ok: false as const, reason: "slow" };
  return { ok: true as const, id: await createChallenge(pid, name) };
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

export async function move(id: string, version: number, guess: string | null): Promise<MoveResult> {
  checkId(id);
  const pid = await playerId(true);
  if (!(await allow("guess", pid))) return { ok: false, reason: "slow" };
  return submitMove(id, pid, version, guess === null ? null : guess.slice(0, 120));
}

export async function kick(id: string, seat: number) {
  checkId(id);
  if (!Number.isInteger(seat)) return false;
  return removeFromLobby(id, await playerId(true), seat);
}

export async function view(id: string) {
  checkId(id);
  return viewChallenge(id, await playerId(false));
}

export async function lookupCode(code: string) {
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  if (!clean) return { id: null };
  if (!(await allow("code", await playerId(false)))) return { id: null, slow: true };
  return { id: await findByCode(clean) };
}

/** Status of the games this device has played, for the "Your games" list. */
export async function myGames(ids: string[]) {
  const valid = ids.filter((id) => UUID.test(id)).slice(0, 50);
  if (valid.length === 0) return [];
  return summarizeChallenges(valid, await playerId(false));
}

export async function rematch(id: string) {
  checkId(id);
  const pid = await playerId(true);
  if (!(await allow("create", pid))) return null;
  return rematchChallenge(id, pid);
}
