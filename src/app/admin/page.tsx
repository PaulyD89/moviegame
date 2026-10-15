import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { isAdmin } from "@/lib/admin";

export const metadata: Metadata = {
  title: "Admin — Movie Horse",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-8">
      <Suspense fallback={<p className="p-8 text-center text-zinc-400">Loading…</p>}>
        <Gate />
      </Suspense>
    </main>
  );
}

async function Gate() {
  return (await isAdmin()) ? <AdminDashboard /> : <AdminLogin />;
}
