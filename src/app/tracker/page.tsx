import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import TrackerBoard from "@/components/TrackerBoard";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tracker · SourceFirst" };

export default async function TrackerPage() {
  if (!(await currentUser())) redirect("/sign-in?next=/tracker");
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 pb-24 pt-6 sm:px-6 sm:pb-12">
        <div className="mb-5">
          <h1 className="text-2xl font-semibold tracking-tight">Application tracker</h1>
          <p className="mt-1 text-sm text-muted">Drag cards between columns as things move. Notes are private to you.</p>
        </div>
        <TrackerBoard />
      </main>
    </>
  );
}
