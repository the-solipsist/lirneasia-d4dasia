import { FIXTURES } from "./fixtures/citation_fixtures.ts";
import { parseKey, compareStructured } from "./resolve_citations.ts";

function score(fail: string, valid: string): number {
  const f = parseKey(fail);
  const v = parseKey(valid);

  if (f && v) {
    const s = compareStructured(f, v);
    if (s > 0) return s;
  }

  // Fallback fuzzy (same logic as resolver)
  const dist = levenshtein(fail, valid);
  let fuzzy = 1 - dist / Math.max(fail.length, valid.length);
  if (fail.length < 6) fuzzy -= 0.1;
  if (valid.includes(fail) || fail.includes(valid)) {
    fuzzy += 0.3;
  }
  return fuzzy;
}

function levenshtein(a: string, b: string): number {
  const dp = Array(b.length + 1)
    .fill(null)
    .map(() => Array(a.length + 1).fill(0));

  for (let i = 0; i <= b.length; i++) dp[i][0] = i;
  for (let j = 0; j <= a.length; j++) dp[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[b.length][a.length];
}

// ---------------------------

let failures = 0;

for (const fx of FIXTURES) {
  const ranked = fx.candidates
    .map(c => ({ key: c, score: score(fx.fail, c) }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0].key;

  if (best !== fx.expectedBest) {
    failures++;
    console.error("❌ Fixture failed");
    console.error(`   fail: ${fx.fail}`);
    console.error(`   expected: ${fx.expectedBest}`);
    console.error(`   got: ${best}`);
    console.error(`   reason: ${fx.reason}`);
    console.error(
      "   scores:",
      ranked.map(r => `${r.key}=${r.score.toFixed(2)}`).join(", ")
    );
    console.error();
  } else {
    console.log(`✅ ${fx.fail} → ${best}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} fixture(s) failed.`);
  Deno.exit(1);
} else {
  console.log("\nAll fixtures passed.");
}
