/**
 * Tools and languages a posting asks for, read from its title and description, so people can filter by
 * what they know (SQL, BigQuery, Python…). One pass over the text per job.
 */

/** [name shown in the filter, pattern, case-sensitive?]. Case-sensitive where the word is also plain English. */
const SKILLS: [string, string, boolean?][] = [
  // Data & analytics
  ["SQL", String.raw`SQL`, true],
  ["Python", String.raw`Python`],
  ["R", String.raw`(?<=^|[\s,(/])R(?=[\s,)/.]|$)(?!&)`, true],
  ["Excel", String.raw`(?:MS |Microsoft )?Excel(?! (?:at|in)\b)`, true],
  ["Tableau", String.raw`Tableau`],
  ["Power BI", String.raw`Power ?BI`],
  ["Looker", String.raw`Looker`, true],
  ["BigQuery", String.raw`Big ?Query`],
  ["Snowflake", String.raw`Snowflake`, true],
  ["Redshift", String.raw`Redshift`],
  ["Databricks", String.raw`Databricks`],
  ["dbt", String.raw`dbt`, true],
  ["Airflow", String.raw`Airflow`],
  ["Spark", String.raw`(?:Apache )?Spark|PySpark`, true],
  ["Hadoop", String.raw`Hadoop`],
  ["Kafka", String.raw`Kafka`],
  ["Pandas", String.raw`pandas`],
  ["NumPy", String.raw`NumPy`],
  ["scikit-learn", String.raw`scikit[- ]learn|sklearn`],
  ["TensorFlow", String.raw`TensorFlow`],
  ["PyTorch", String.raw`PyTorch`],
  ["SAS", String.raw`SAS`, true],
  ["SPSS", String.raw`SPSS`],
  ["Stata", String.raw`Stata`, true],
  ["MATLAB", String.raw`MATLAB`],
  ["Alteryx", String.raw`Alteryx`],
  ["Google Analytics", String.raw`Google Analytics|GA4`],
  ["A/B testing", String.raw`A/B test(?:s|ing)?|experimentation platform`],
  ["ETL", String.raw`ETL|ELT`, true],
  ["LLMs", String.raw`LLMs?|large language models?`],
  // Engineering
  ["Java", String.raw`Java`, true],
  ["JavaScript", String.raw`JavaScript|JS`, true],
  ["TypeScript", String.raw`TypeScript`],
  ["Go", String.raw`Golang|Go(?=,|\s*/|\s+(?:and|or)\s)`, true],
  ["Rust", String.raw`Rust`, true],
  ["C++", String.raw`C\+\+(?!\w)`],
  ["C#", String.raw`C#(?!\w)`],
  ["Ruby", String.raw`Ruby`, true],
  ["Rails", String.raw`Rails`, true],
  ["PHP", String.raw`PHP`],
  ["Kotlin", String.raw`Kotlin`],
  ["Swift", String.raw`Swift(?:UI)?`, true],
  ["Scala", String.raw`Scala`, true],
  ["React", String.raw`React(?:\.js| Native)?`, true],
  ["Angular", String.raw`Angular`, true],
  ["Vue", String.raw`Vue(?:\.js)?`, true],
  ["Next.js", String.raw`Next\.js`],
  ["Node.js", String.raw`Node(?:\.js|JS)`],
  ["Django", String.raw`Django`],
  ["Flask", String.raw`Flask`, true],
  ["Spring", String.raw`Spring Boot|Spring Framework`],
  [".NET", String.raw`\.NET`],
  ["GraphQL", String.raw`GraphQL`],
  ["AWS", String.raw`AWS|Amazon Web Services`],
  ["GCP", String.raw`GCP|Google Cloud`],
  ["Azure", String.raw`Azure`],
  ["Kubernetes", String.raw`Kubernetes|K8s`],
  ["Docker", String.raw`Docker`],
  ["Terraform", String.raw`Terraform`],
  ["Linux", String.raw`Linux`],
  ["PostgreSQL", String.raw`Postgres(?:QL)?`],
  ["MySQL", String.raw`MySQL`],
  ["MongoDB", String.raw`MongoDB|Mongo`],
  ["Redis", String.raw`Redis`],
  ["Elasticsearch", String.raw`Elasticsearch|Elastic ?Search`],
  // Design & business tools
  ["Figma", String.raw`Figma`],
  ["Photoshop", String.raw`Photoshop`],
  ["Salesforce", String.raw`Salesforce|SFDC`],
  ["HubSpot", String.raw`HubSpot`],
  ["SAP", String.raw`SAP`, true],
  ["NetSuite", String.raw`NetSuite`],
  ["Jira", String.raw`Jira`],
];

/** Names in the order the filter offers them. */
export const SKILL_NAMES = SKILLS.map(([n]) => n);
export const POPULAR_SKILLS = ["SQL", "Python", "Excel", "Tableau", "Power BI", "BigQuery", "Snowflake", "AWS", "React", "Java", "Figma", "Salesforce"];

const build = (sensitive: boolean) => {
  const list = SKILLS.filter(([, , cs]) => !!cs === sensitive);
  // Each skill is its own capture group, so a match tells us which one it was.
  const re = new RegExp(list.map(([, p]) => `(?<![\\w.#+-])(${p})(?![\\w+#])`).join("|"), sensitive ? "g" : "gi");
  return { re, names: list.map(([n]) => n) };
};
const GROUPS = [build(true), build(false)];

export function skillsIn(text: string): string[] {
  const found = new Set<string>();
  for (const { re, names } of GROUPS) {
    for (const m of text.matchAll(re)) {
      const i = m.slice(1).findIndex((g) => g !== undefined);
      if (i >= 0) found.add(names[i]);
    }
  }
  return SKILL_NAMES.filter((n) => found.has(n));
}

/** The canonical skill for a search word ("bigquery" → "BigQuery"), so searching a skill also finds postings that ask for it. */
const LOWER = new Map(SKILL_NAMES.map((n) => [n.toLowerCase(), n]));
export const skillFor = (word: string) => LOWER.get(word.toLowerCase()) ?? null;
