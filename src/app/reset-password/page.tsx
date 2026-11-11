import { Suspense } from "react";
import AuthForm from "@/components/AuthForm";
import { googleEnabled } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "New password · SourceFirst" };

export default async function Page() {
  return (
    <main className="flex-1 bg-bg">
      <Suspense>
        <AuthForm mode="reset" googleEnabled={googleEnabled} />
      </Suspense>
    </main>
  );
}
