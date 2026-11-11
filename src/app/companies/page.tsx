import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import CompanyDirectory from "@/components/CompanyDirectory";
import { allCompanies } from "@/lib/query";

export const dynamic = "force-dynamic";
export const metadata = { title: "Companies hiring · SourceFirst", description: "Every company we track, with live open roles from their own career pages." };

export default async function Companies() {
  const list = await allCompanies();
  const total = list.reduce((n, c) => n + c.open_jobs, 0);
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 pb-24 pt-8 sm:px-6 sm:pb-12">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Companies hiring now</h1>
        <p className="mb-6 mt-1 text-sm text-muted">
          {list.length.toLocaleString()} companies · {total.toLocaleString()} open roles, read straight from their career pages.
        </p>
        <CompanyDirectory companies={list.map(({ slug, name, domain, open_jobs }) => ({ slug, name, domain, open_jobs }))} />
      </main>
      <SiteFooter />
    </>
  );
}
