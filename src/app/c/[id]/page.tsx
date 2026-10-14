import type { Metadata } from "next";
import { Suspense } from "react";
import { ChallengeRoom } from "@/components/challenge/ChallengeRoom";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: "You've been challenged — Movie Horse",
  description: "Take turns naming actors and movies. First to spell M-O-V-I-E loses.",
};

export default function ChallengeRoomPage({ params }: PageProps<"/c/[id]">) {
  return (
    <Shell>
      <Suspense fallback={<p className="p-8 text-center text-zinc-400">Loading challenge…</p>}>
        <Room params={params} />
      </Suspense>
    </Shell>
  );
}

async function Room({ params }: { params: PageProps<"/c/[id]">["params"] }) {
  const { id } = await params;
  return <ChallengeRoom id={id} />;
}
