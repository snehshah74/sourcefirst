import type { Ats } from "./types";
import discovered from "./companies.discovered.json";

/**
 * Starter list of companies and their public ATS board tokens.
 * The token is the path segment in the company's job board URL, e.g.
 *   boards.greenhouse.io/<token>   jobs.lever.co/<token>   jobs.ashbyhq.com/<token>
 * Growing this list is the main lever for coverage.
 * Add more with `npm run discover -- <ats> <token> [domain]` or by editing this file.
 */
export interface Company {
  ats: Ats;
  slug: string;
  name: string;
  domain?: string;
}

const gh = (slug: string, name: string, domain?: string): Company => ({ ats: "greenhouse", slug, name, domain });
const lv = (slug: string, name: string, domain?: string): Company => ({ ats: "lever", slug, name, domain });
const ab = (slug: string, name: string, domain?: string): Company => ({ ats: "ashby", slug, name, domain });

const MANUAL: Company[] = [
  // Greenhouse
  gh("figma", "Figma", "figma.com"),
  gh("airbnb", "Airbnb", "airbnb.com"),
  gh("stripe", "Stripe", "stripe.com"),
  gh("coinbase", "Coinbase", "coinbase.com"),
  gh("reddit", "Reddit", "reddit.com"),
  gh("discord", "Discord", "discord.com"),
  gh("databricks", "Databricks", "databricks.com"),
  gh("datadog", "Datadog", "datadoghq.com"),
  gh("okta", "Okta", "okta.com"),
  gh("robinhood", "Robinhood", "robinhood.com"),
  gh("lyft", "Lyft", "lyft.com"),
  gh("dropbox", "Dropbox", "dropbox.com"),
  gh("instacart", "Instacart", "instacart.com"),
  gh("pinterest", "Pinterest", "pinterest.com"),
  gh("cloudflare", "Cloudflare", "cloudflare.com"),
  gh("gitlab", "GitLab", "gitlab.com"),
  gh("twilio", "Twilio", "twilio.com"),
  gh("brex", "Brex", "brex.com"),
  gh("anthropic", "Anthropic", "anthropic.com"),
  gh("scaleai", "Scale AI", "scale.com"),
  gh("spacex", "SpaceX", "spacex.com"),
  gh("andurilindustries", "Anduril", "anduril.com"),
  gh("samsara", "Samsara", "samsara.com"),
  gh("mongodb", "MongoDB", "mongodb.com"),
  gh("elastic", "Elastic", "elastic.co"),
  gh("asana", "Asana", "asana.com"),
  gh("gusto", "Gusto", "gusto.com"),
  gh("chime", "Chime", "chime.com"),
  gh("affirm", "Affirm", "affirm.com"),
  gh("flexport", "Flexport", "flexport.com"),
  gh("vercel", "Vercel", "vercel.com"),
  gh("webflow", "Webflow", "webflow.com"),
  gh("duolingo", "Duolingo", "duolingo.com"),
  gh("roblox", "Roblox", "roblox.com"),
  gh("waymo", "Waymo", "waymo.com"),
  gh("lightningai", "Lightning AI", "lightning.ai"),
  gh("fivetran", "Fivetran", "fivetran.com"),
  gh("airtable", "Airtable", "airtable.com"),
  gh("carta", "Carta", "carta.com"),
  gh("jamf", "Jamf", "jamf.com"),
  gh("opentable", "OpenTable", "opentable.com"),
  gh("fictiv", "Fictiv", "fictiv.com"),
  // Lever
  lv("spotify", "Spotify", "spotify.com"),
  lv("palantir", "Palantir", "palantir.com"),
  lv("shieldai", "Shield AI", "shield.ai"),
  lv("zoox", "Zoox", "zoox.com"),
  lv("wealthsimple", "Wealthsimple", "wealthsimple.com"),
  lv("lessen", "Lessen", "lessen.com"),
  lv("outreach", "Outreach", "outreach.io"),
  // Ashby
  ab("linear", "Linear", "linear.app"),
  ab("notion", "Notion", "notion.so"),
  ab("ramp", "Ramp", "ramp.com"),
  ab("openai", "OpenAI", "openai.com"),
  ab("cohere", "Cohere", "cohere.com"),
  ab("vanta", "Vanta", "vanta.com"),
  ab("replit", "Replit", "replit.com"),
  ab("supabase", "Supabase", "supabase.com"),
  ab("posthog", "PostHog", "posthog.com"),
  ab("clickhouse", "ClickHouse", "clickhouse.com"),
  ab("Etched", "Etched", "etched.com"),
  ab("cursor", "Cursor (Anysphere)", "cursor.com"),
  ab("perplexity", "Perplexity", "perplexity.ai"),
  ab("elevenlabs", "ElevenLabs", "elevenlabs.io"),
  ab("runway", "Runway", "runwayml.com"),
  ab("modal", "Modal", "modal.com"),
  ab("sierra", "Sierra", "sierra.ai"),
  ab("harvey", "Harvey", "harvey.ai"),
  ab("decagon", "Decagon", "decagon.ai"),
  ab("deel", "Deel", "deel.com"),
];

/** Boards found to be wrong (test boards, other companies with the same slug). */
const BLOCKLIST = new Set(["lever/linkedin"]);

/**
 * Manual list + boards found by `npm run discover` (src/lib/companies.discovered.json).
 * A company sometimes has stale boards on several ATSs; keep only its biggest one.
 */
function merge(): Company[] {
  const out = new Map<string, Company>(MANUAL.map((c) => [`${c.ats}/${c.slug.toLowerCase()}`, c]));
  const manualNames = new Set(MANUAL.map((c) => c.name.toLowerCase()));
  const best = new Map<string, (typeof discovered)[number]>();
  for (const d of discovered) {
    if (BLOCKLIST.has(`${d.ats}/${d.slug}`) || manualNames.has(d.name.toLowerCase())) continue;
    const cur = best.get(d.name);
    if (!cur || d.jobs > cur.jobs) best.set(d.name, d);
  }
  for (const d of best.values()) {
    const key = `${d.ats}/${d.slug.toLowerCase()}`;
    if (!out.has(key)) out.set(key, { ats: d.ats as Ats, slug: d.slug, name: d.name, domain: d.domain });
  }
  return [...out.values()].filter((c) => !BLOCKLIST.has(`${c.ats}/${c.slug}`));
}

export const COMPANIES: Company[] = merge();
