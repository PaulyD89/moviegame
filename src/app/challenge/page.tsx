import type { Metadata } from "next";
import { NewChallenge } from "@/components/challenge/NewChallenge";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: "Play with Friends — Movie Horse",
  description: "Challenge up to five friends to a Movie Horse chain: take turns naming actors and movies.",
  alternates: { canonical: "/challenge" },
};

export default function ChallengePage() {
  return (
    <Shell>
      <NewChallenge />
    </Shell>
  );
}
