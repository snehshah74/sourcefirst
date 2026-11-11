import type { EnrichedJob, RawJob, Visa } from "./types";

/**
 * Rule-based enrichment. Regex rules catch the explicit cases cheaply and
 * default to "Maybe" when a posting says nothing.
 * To add an LLM pass, call it only for jobs that come back "Maybe" here.
 */

const US_STATES =
  "Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming|District of Columbia";
const US_ABBR =
  "AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC";
const US_CITIES =
  "San Francisco|SF|Bay Area|New York|NYC|Seattle|Austin|Boston|Los Angeles|Chicago|Denver|Atlanta|Miami|San Jose|Palo Alto|Mountain View|Menlo Park|Sunnyvale|Redwood City|San Mateo|San Diego|Portland|Washington DC|Pittsburgh|Philadelphia|Boulder|Salt Lake City|Dallas|Houston|Phoenix|Raleigh|Nashville|Minneapolis|Detroit|Starbase|Hawthorne|Costa Mesa|Santa Ana|Brooklyn|Irvine|Bellevue|Kirkland|Reston|Arlington|McLean";

const RE_US_STRONG = new RegExp(`\\b(United States|USA|U\\.S\\.A?\\.?|US|America|${US_STATES}|${US_CITIES})\\b`, "i");
// State abbreviations are ambiguous ("Berlin, DE"), so they only count when no foreign place matched.
const RE_US_WEAK = new RegExp(`,\\s*(${US_ABBR})\\b`);
const RE_NON_US =
  /\b(Canada|Toronto|Vancouver|Montreal|UK|United Kingdom|London|Dublin|Ireland|Germany|Berlin|Munich|France|Paris|Netherlands|Amsterdam|Spain|Madrid|Barcelona|Portugal|Lisbon|Poland|Warsaw|India|Bangalore|Bengaluru|Hyderabad|Pune|Mumbai|Delhi|Gurgaon|Singapore|Japan|Tokyo|Korea|Seoul|Australia|Sydney|Melbourne|Brazil|S[aã]o Paulo|Mexico|Argentina|Colombia|Israel|Tel Aviv|Switzerland|Zurich|Sweden|Stockholm|Denmark|Copenhagen|Philippines|Manila|China|Shanghai|Beijing|Hong Kong|Taiwan|EMEA|APAC|LATAM|Europe)\b/i;
const RE_REMOTE = /\bremote\b/i;

function country(job: RawJob): EnrichedJob["country"] {
  const loc = job.location;
  if (RE_US_STRONG.test(loc)) return "USA"; // multi-location postings that include a US site count as US
  if (RE_NON_US.test(loc)) return "Non-USA";
  if (RE_US_WEAK.test(loc)) return "USA";
  if (RE_REMOTE.test(loc) && /\b(US|U\.S\.|United States|USA)\b/.test(job.descriptionText)) return "USA";
  return "Unknown";
}

const VISA_NO = [
  /\b(not|unable to|cannot|can't|won't|will not|do not|don't|does not|doesn't)\s+(?:\w+\s+){0,3}(sponsor|provide sponsorship|offer sponsorship|support (?:visa|immigration))/i,
  /\bno (visa )?sponsorship\b/i,
  /\bsponsorship (is )?not (available|provided|offered)\b/i,
  /\bwithout (the )?(need for |requiring )?(current or future )?(visa )?sponsorship\b/i,
  /\bmust be (a )?(U\.?S\.? citizen|authorized to work .{0,40}without)/i,
  /\b(U\.?S\.? citizenship|security clearance) (is )?required\b/i,
  /\bITAR\b/,
  /\b(active|current) (TS|top secret|secret)(\/SCI)? clearance\b/i,
];
const VISA_YES = [
  /\b(will|can|able to|happy to|do|does|we)\s+(?:\w+\s+){0,2}(sponsor|provide (visa |immigration )?sponsorship|support (visa|immigration))/i,
  /\bvisa sponsorship (is )?(available|provided|offered)\b/i,
  /\b(H-?1B|O-?1|TN|E-?3|L-?1) (sponsorship|transfer)s? (available|supported|welcome)/i,
  /\bimmigration support\b/i,
];

export function classifyVisa(text: string): Visa {
  if (VISA_NO.some((r) => r.test(text))) return "No";
  if (VISA_YES.some((r) => r.test(text))) return "Yes";
  return "Maybe";
}

export function extractMinExp(text: string): number | null {
  const m =
    text.match(/(\d{1,2})\s*\+?\s*(?:-|–|to)?\s*(?:\d{1,2}\s*)?\+?\s*years?(?:\s+of)?(?:\s+\w+){0,4}\s+experience/i) ??
    text.match(/experience[^.]{0,40}?(\d{1,2})\s*\+?\s*years?/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n >= 0 && n <= 25 ? n : null;
}

const CATEGORIES: [string, RegExp][] = [
  ["Engineering", /\b(engineer|developer|swe|sre|devops|architect|programmer|software|infrastructure|firmware|backend|frontend|full[- ]?stack|ios|android)\b/i],
  ["Data & AI", /\b(data|machine learning|ml|ai|llm|research scientist|scientist|analytics|business intelligence|bi analyst)\b/i],
  ["Product", /\b(product manager|product owner|product lead|product analyst|product operations|pm\b|program manager|tpm)\b/i],
  ["Design", /\b(design|designer|ux|ui|creative|artist)\b/i],
  ["Sales", /\b(sales|account executive|account manager|business development|bdr|sdr|partnerships?)\b/i],
  ["Marketing", /\b(marketing|growth|content|brand|communications|seo|community)\b/i],
  ["Customer", /\b(customer|support|success|solutions|implementation)\b/i],
  ["Operations", /\b(operations|ops|supply chain|logistics|procurement|facilities|manufacturing|technician)\b/i],
  ["People", /\b(recruit\w*|sourcer|talent|people|hr|human resources)\b/i],
  ["Finance & Legal", /\b(finance|financial|fp&a|accounting|accountant|controller|tax|treasury|audit|legal|counsel|attorney|compliance|paralegal)\b/i],
];

const PRIORITY = ["Finance & Legal", "People"]; // "Financial Analyst", "People Analytics" are not data roles

export function categorize(title: string, dept: string | null): string {
  if (!/\bengineer/i.test(title)) for (const [name, re] of CATEGORIES) if (PRIORITY.includes(name) && re.test(title)) return name;
  for (const [name, re] of CATEGORIES) if (re.test(title)) return name;
  if (dept) for (const [name, re] of CATEGORIES) if (re.test(dept)) return name;
  if (/\banalyst\b/i.test(title)) return "Data & AI"; // last resort: most remaining analyst roles are analytics
  return "Other";
}

export function seniority(title: string, employmentType: string | null): string {
  if (/\b(intern|internship)\b/i.test(title) || /intern/i.test(employmentType ?? "")) return "Intern";
  if (/\b(new grad|graduate|entry[- ]level|junior|jr\.?|associate)\b/i.test(title)) return "Entry";
  if (/\b(vp|vice president|head of|chief|director|cto|ceo|cfo)\b/i.test(title)) return "Director+";
  if (/\b(staff|principal|distinguished|lead|manager)\b/i.test(title)) return "Staff/Lead";
  if (/\b(senior|sr\.?)\b/i.test(title)) return "Senior";
  return "Mid";
}

/**
 * Lowest yearly pay in the posted range, for sorting by salary. Hourly rates are annualized (×2,080).
 * "USD 177,000–266,000 per-year-salary" → 177000; "$45 – $60 per hour" → 93600; "$150K – $200K" → 150000.
 */
export function parseSalaryMin(raw: string | null): number | null {
  if (!raw) return null;
  const nums = [...raw.replace(/,/g, "").matchAll(/(\d+(?:\.\d+)?)\s*([kKmM])?/g)]
    .map((m) => parseFloat(m[1]) * (m[2]?.toLowerCase() === "k" ? 1e3 : m[2]?.toLowerCase() === "m" ? 1e6 : 1))
    .filter((n) => n >= 10);
  if (!nums.length) return null;
  const lo = Math.min(...nums.slice(0, 2));
  const hourly = /hour|hr\b/i.test(raw) || lo < 1000;
  const yearly = Math.round(hourly ? lo * 2080 : /month/i.test(raw) ? lo * 12 : lo);
  return yearly >= 10_000 && yearly <= 5_000_000 ? yearly : null;
}

export function enrich(job: RawJob): EnrichedJob {
  const text = job.descriptionText;
  return {
    ...job,
    country: country(job),
    remote: job.isRemote ?? RE_REMOTE.test(job.location),
    visa: classifyVisa(text),
    minExp: extractMinExp(text),
    category: categorize(job.title, job.department),
    seniority: seniority(job.title, job.employmentType),
    salaryMin: parseSalaryMin(job.salary),
  };
}
