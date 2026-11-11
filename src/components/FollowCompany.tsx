"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BellPlus, BellRing } from "lucide-react";
import { Button } from "./ui/Button";
import { toast } from "./ui/Toaster";

/** "Follow" = an instant alert for every new role at this company. */
export default function FollowCompany({ slug, name, signedIn }: { slug: string; name: string; signedIn: boolean }) {
  const router = useRouter();
  const [done, setDone] = useState(false);
  return (
    <Button
      variant={done ? "secondary" : "primary"}
      size="lg"
      onClick={async () => {
        if (!signedIn) return router.push(`/sign-in?next=${encodeURIComponent(`/companies/${slug}`)}`);
        const res = await fetch("/api/me/searches", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: `New at ${name}`, query: `company=${slug}&us=0`, frequency: "instant" }),
        });
        if (!res.ok) return toast.error("Couldn't follow. Try again.");
        setDone(true);
        toast.success(`Following ${name}`, { description: "We'll email you within minutes of a new opening." });
      }}
    >
      {done ? <BellRing size={17} className="text-accent" /> : <BellPlus size={17} />}
      {done ? "Following" : "Follow"}
    </Button>
  );
}
