import { FIXTURES } from "./fixtures/citation_fixtures.ts";
import { parseKey, compareStructured, jaroWinkler, type CSLItem } from "./resolve_citations.ts";

/**
 * Test Helper: Replicates the cascading logic from resolve_citations.ts
 */
function findMatchScore(fail: string, valid: string, validCSL?: CSLItem | null): number {
  const f = parseKey(fail);
  const v = parseKey(valid);

  let score = 0;

  // 1. Structural
  if (f && v) {
    const struct = compareStructured(f, v, validCSL);
    if (struct.score > 0) {
      score = struct.score;
    }
  }

  // 2. Fuzzy (Cascading Fallback)
  const isLegalWithYear = (f?.isLegalDocument && f?.year) || 
                          (v?.isLegalDocument && v?.year) ||
                          (validCSL?.type === "legislation" && validCSL.issued);

  if (score === 0 && !isLegalWithYear) {
    const fuzzy = jaroWinkler(fail.toLowerCase(), valid.toLowerCase());
    const boosted = (fail.includes(valid) || valid.includes(fail))
      ? Math.min(1.0, fuzzy + 0.15)
      : fuzzy;
    
    if (boosted > 0.5) {
      score = boosted;
    }
  }

  return score;
}

// --------------------------- 

let failures = 0;

console.log("Running Resolver Fixtures Test (Asymmetric CSL)...");
console.log("=".repeat(50));

for (const fx of FIXTURES) {
  const ranked = fx.candidates
    .map(c => {
      const csl = fx.candidateCSL ? fx.candidateCSL[c] : null;
      return { key: c, score: findMatchScore(fx.fail, c, csl) };
    })
    .sort((a, b) => b.score - a.score);

  const best = (ranked[0]?.score > 0) ? ranked[0].key : null;

  if (best !== fx.expectedBest) {
    failures++;
    console.error(`❌ FAILED: ${fx.fail}`);
    console.error(`   Expected: ${fx.expectedBest}`);
    console.error(`   Got:      ${best || "NO MATCH"}`);
    console.error(`   Reason:   ${fx.reason}`);
    console.error(
      "   Scores:  ",
      ranked.map(r => `${r.key}=${r.score.toFixed(2)}`).join(", ")
    );
    console.error();
  } else {
    console.log(`✅ PASSED: ${fx.fail} → ${best} (Score: ${ranked[0]?.score.toFixed(2)})`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} fixture(s) failed.`);
  Deno.exit(1);
} else {
  console.log("\nAll fixtures passed! 🎉");
}