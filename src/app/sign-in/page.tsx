import { Suspense } from "react";
import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { currentUser, googleEnabled } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in · SourceFirst" };

export default async function Page() {
  if (await currentUser()) redirect("/account");
  return (
    <main className="flex-1 bg-bg">
      <Suspense>
        <AuthForm mode="sign-in" googleEnabled={googleEnabled} />
      </Suspense>
    </main>
  );
}
