import type { Metadata } from "next";
import { NewChallenge } from "@/components/challenge/NewChallenge";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = { title: "Challenge a Friend — Movie Horse" };

export default function ChallengePage() {
  return (
    <Shell>
      <NewChallenge />
    </Shell>
  );
}
