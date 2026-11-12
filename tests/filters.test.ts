import { test } from "node:test";
import assert from "node:assert/strict";
import { placesOf } from "../src/lib/places";
import { skillsIn } from "../src/lib/skills";

test("a location maps to its countries and regions", () => {
  assert.deepEqual(placesOf("Bengaluru, India", false), ["India", "Asia-Pacific"]);
  assert.deepEqual(placesOf("London, UK; New York, NY", true).sort(), ["Europe", "North America", "United Kingdom", "United States"]);
  assert.deepEqual(placesOf("Remote, EMEA", false), ["Europe", "Middle East & Africa"]);
});

test("US cities that share a foreign name stay in the US", () => {
  assert.deepEqual(placesOf("Dublin, OH", true), ["United States", "North America"]);
  assert.deepEqual(placesOf("Atlanta, Georgia", true), ["United States", "North America"]);
  assert.deepEqual(placesOf("Indianapolis, Indiana", true), ["United States", "North America"]);
});

test("skills are read from the posting, not from plain English", () => {
  assert.deepEqual(skillsIn("Strong SQL and Python; BigQuery or Snowflake. R a plus."), ["SQL", "Python", "R", "BigQuery", "Snowflake"]);
  assert.deepEqual(skillsIn("We invest in R&D and you excel at writing. Go above and beyond."), []);
  assert.deepEqual(skillsIn("Java services and a JavaScript SDK"), ["Java", "JavaScript"]);
});
