/**
 * Countries and regions a job is in, read from its location text ("Bengaluru, India; London, UK").
 * Stored per job so people can filter by any country or region.
 */

export const REGIONS = ["North America", "Latin America", "Europe", "Middle East & Africa", "Asia-Pacific"] as const;
type Region = (typeof REGIONS)[number];

/** [country, region, other names and major cities]. Ambiguous cities (Cambridge, Birmingham, Perth) are left out. */
const COUNTRIES: [string, Region, string[]][] = [
  ["United States", "North America", []],
  ["Canada", "North America", ["Toronto", "Vancouver", "Montreal", "Montréal", "Ottawa", "Calgary", "Edmonton", "Waterloo", "Ontario", "Quebec", "Québec", "British Columbia", "Alberta"]],
  ["Mexico", "Latin America", ["México", "Mexico City", "Ciudad de México", "CDMX", "Guadalajara", "Monterrey"]],
  ["Brazil", "Latin America", ["Brasil", "São Paulo", "Sao Paulo", "Rio de Janeiro", "Belo Horizonte", "Florianópolis", "Curitiba"]],
  ["Argentina", "Latin America", ["Buenos Aires", "Córdoba"]],
  ["Chile", "Latin America", ["Santiago"]],
  ["Colombia", "Latin America", ["Bogotá", "Bogota", "Medellín", "Medellin"]],
  ["Peru", "Latin America", ["Perú", "Lima"]],
  ["Costa Rica", "Latin America", []],
  ["Uruguay", "Latin America", ["Montevideo"]],
  ["Ecuador", "Latin America", ["Quito"]],
  ["Guatemala", "Latin America", []],
  ["Panama", "Latin America", []],
  ["Dominican Republic", "Latin America", ["Santo Domingo"]],
  ["United Kingdom", "Europe", ["UK", "U.K.", "England", "Scotland", "Wales", "Northern Ireland", "Great Britain", "London", "Manchester", "Edinburgh", "Glasgow", "Bristol", "Oxford", "Belfast", "Leeds", "Reading"]],
  ["Ireland", "Europe", ["Dublin", "Cork", "Galway", "Limerick"]],
  ["Germany", "Europe", ["Deutschland", "Berlin", "Munich", "München", "Hamburg", "Frankfurt", "Cologne", "Köln", "Stuttgart", "Düsseldorf", "Dusseldorf"]],
  ["France", "Europe", ["Paris", "Lyon", "Toulouse", "Marseille", "Nantes"]],
  ["Netherlands", "Europe", ["Holland", "Amsterdam", "Rotterdam", "The Hague", "Utrecht", "Eindhoven"]],
  ["Belgium", "Europe", ["Brussels", "Antwerp", "Ghent"]],
  ["Luxembourg", "Europe", []],
  ["Switzerland", "Europe", ["Zurich", "Zürich", "Geneva", "Basel", "Lausanne", "Bern"]],
  ["Austria", "Europe", ["Vienna", "Wien", "Graz"]],
  ["Spain", "Europe", ["España", "Madrid", "Barcelona", "Valencia", "Seville", "Málaga", "Malaga"]],
  ["Portugal", "Europe", ["Lisbon", "Lisboa", "Porto"]],
  ["Italy", "Europe", ["Italia", "Milan", "Milano", "Rome", "Roma", "Turin", "Torino"]],
  ["Poland", "Europe", ["Polska", "Warsaw", "Kraków", "Krakow", "Wrocław", "Wroclaw", "Gdańsk", "Gdansk", "Poznań", "Poznan"]],
  ["Czechia", "Europe", ["Czech Republic", "Prague", "Brno"]],
  ["Hungary", "Europe", ["Budapest"]],
  ["Romania", "Europe", ["Bucharest", "Cluj"]],
  ["Bulgaria", "Europe", ["Sofia"]],
  ["Greece", "Europe", ["Athens"]],
  ["Croatia", "Europe", ["Zagreb"]],
  ["Serbia", "Europe", ["Belgrade"]],
  ["Ukraine", "Europe", ["Kyiv", "Kiev", "Lviv"]],
  ["Lithuania", "Europe", ["Vilnius"]],
  ["Latvia", "Europe", ["Riga"]],
  ["Estonia", "Europe", ["Tallinn"]],
  ["Sweden", "Europe", ["Stockholm", "Gothenburg", "Malmö", "Malmo"]],
  ["Norway", "Europe", ["Oslo"]],
  ["Denmark", "Europe", ["Copenhagen"]],
  ["Finland", "Europe", ["Helsinki"]],
  ["Iceland", "Europe", ["Reykjavik"]],
  ["Slovakia", "Europe", ["Bratislava"]],
  ["Slovenia", "Europe", ["Ljubljana"]],
  ["Cyprus", "Europe", ["Limassol", "Nicosia"]],
  ["Malta", "Europe", []],
  ["Turkey", "Europe", ["Türkiye", "Turkiye", "Istanbul", "Ankara"]],
  ["Israel", "Middle East & Africa", ["Tel Aviv", "Jerusalem", "Haifa", "Herzliya"]],
  ["United Arab Emirates", "Middle East & Africa", ["UAE", "Dubai", "Abu Dhabi"]],
  ["Saudi Arabia", "Middle East & Africa", ["KSA", "Riyadh", "Jeddah"]],
  ["Qatar", "Middle East & Africa", ["Doha"]],
  ["Bahrain", "Middle East & Africa", []],
  ["Kuwait", "Middle East & Africa", []],
  ["Jordan", "Middle East & Africa", ["Amman"]],
  ["Egypt", "Middle East & Africa", ["Cairo"]],
  ["Morocco", "Middle East & Africa", ["Casablanca"]],
  ["South Africa", "Middle East & Africa", ["Cape Town", "Johannesburg"]],
  ["Nigeria", "Middle East & Africa", ["Lagos"]],
  ["Kenya", "Middle East & Africa", ["Nairobi"]],
  ["Ghana", "Middle East & Africa", ["Accra"]],
  ["India", "Asia-Pacific", ["Bangalore", "Bengaluru", "Hyderabad", "Pune", "Mumbai", "Delhi", "New Delhi", "Gurgaon", "Gurugram", "Noida", "Chennai", "Kolkata", "Ahmedabad"]],
  ["Pakistan", "Asia-Pacific", ["Karachi", "Lahore", "Islamabad"]],
  ["Bangladesh", "Asia-Pacific", ["Dhaka"]],
  ["Sri Lanka", "Asia-Pacific", ["Colombo"]],
  ["Singapore", "Asia-Pacific", []],
  ["Japan", "Asia-Pacific", ["Tokyo", "Osaka"]],
  ["South Korea", "Asia-Pacific", ["Korea", "Seoul"]],
  ["China", "Asia-Pacific", ["Shanghai", "Beijing", "Shenzhen", "Hangzhou", "Guangzhou"]],
  ["Hong Kong", "Asia-Pacific", []],
  ["Taiwan", "Asia-Pacific", ["Taipei"]],
  ["Australia", "Asia-Pacific", ["Sydney", "Melbourne", "Brisbane", "Canberra", "Adelaide"]],
  ["New Zealand", "Asia-Pacific", ["Auckland", "Wellington"]],
  ["Philippines", "Asia-Pacific", ["Manila", "Cebu"]],
  ["Vietnam", "Asia-Pacific", ["Ho Chi Minh", "Hanoi"]],
  ["Thailand", "Asia-Pacific", ["Bangkok"]],
  ["Malaysia", "Asia-Pacific", ["Kuala Lumpur"]],
  ["Indonesia", "Asia-Pacific", ["Jakarta"]],
];

/** Every country, then every region: what the filter lets people pick from. */
export const PLACES: { name: string; region?: Region }[] = [
  ...COUNTRIES.map(([name, region]) => ({ name, region })),
  ...REGIONS.map((name) => ({ name })),
];

// Region words used in locations themselves ("Remote, EMEA").
const REGION_WORDS: [RegExp, Region[]][] = [
  [/\bEMEA\b/, ["Europe", "Middle East & Africa"]],
  [/\b(APAC|APJ|Asia[- ]Pacific|Asia)\b/i, ["Asia-Pacific"]],
  [/\b(Europe|European Union|EU)\b/, ["Europe"]],
  [/\b(LATAM|Latin America|South America)\b/i, ["Latin America"]],
  [/\b(North America|NAMER)\b/i, ["North America"]],
  [/\b(MENA|Middle East|Africa)\b/i, ["Middle East & Africa"]],
];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const byName = new Map<string, string>();
const cityOf = new Set<string>();
const codes = new Set<string>(); // UK, UAE, KSA: only count in capitals
for (const [name, , others] of COUNTRIES) {
  if (name === "United States") continue; // decided by enrich's own US rules
  byName.set(name.toLowerCase(), name);
  for (const o of others) {
    byName.set(o.toLowerCase(), name);
    if (/^[A-Z.]+$/.test(o)) codes.add(o.toLowerCase());
    else cityOf.add(o.toLowerCase());
  }
}
const names = [...byName.keys()].sort((a, b) => b.length - a.length).map(esc);
// Letters on either side mean it's part of another word ("Indiana" is not India).
const RE_PLACE = new RegExp(`(?<![\\p{L}])(${names.join("|")})(?![\\p{L}])`, "giu");
const RE_US_PART = /,\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b|\b(United States|USA)\b/;
const REGION_OF = new Map(COUNTRIES.map(([n, r]) => [n, r]));

/** Countries and regions for one job. `inUs` is enrich's verdict, which already knows US locations well. */
export function placesOf(location: string, inUs: boolean): string[] {
  const out = new Set<string>();
  if (inUs) out.add("United States");
  // "Dublin, OH" or "Paris, TX" is a US city, so city names in a US part don't count; country names still do.
  for (const part of location.replace(/New Mexico/gi, "").split(/;|\n|\s\|\s/)) {
    const usPart = RE_US_PART.test(part);
    for (const m of part.matchAll(RE_PLACE)) {
      const key = m[1].toLowerCase();
      if (codes.has(key) && m[1] !== m[1].toUpperCase()) continue;
      if (usPart && cityOf.has(key)) continue;
      out.add(byName.get(key)!);
    }
  }
  for (const c of [...out]) out.add(REGION_OF.get(c)!);
  for (const [re, regions] of REGION_WORDS) if (re.test(location)) for (const r of regions) out.add(r);
  return [...out];
}
