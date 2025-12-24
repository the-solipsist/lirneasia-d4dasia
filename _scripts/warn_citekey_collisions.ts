/**
 * warn_citekey_collisions.ts
 *
 * Usage:
 *   deno run warn_citekey_collisions.ts
 *
 * Reads bibliography/citekeys-failing.txt and warns about
 * prefix / a-b-c style collisions between failing keys.
 */

const PATH = "bibliography/citekeys-failing.txt";

const text = await Deno.readTextFile(PATH);
const keys = text
  .split("\n")
  .map(k => k.trim())
  .filter(Boolean);

const keySet = new Set(keys);

// Map base -> suffixes
const groups = new Map<string, string[]>();

for (const key of keys) {
  const m = key.match(/^(.+?)([a-z])$/);
  if (!m) continue;

  const base = m[1];
  const suffix = m[2];

  if (keySet.has(base)) {
    if (!groups.has(base)) groups.set(base, []);
    groups.get(base)!.push(suffix);
  }
}

if (groups.size === 0) {
  console.log("✅ No prefix / suffix collisions found among failing keys.");
  Deno.exit(0);
}

console.log("⚠️  Potential citekey collisions detected:\n");

for (const [base, suffixes] of groups.entries()) {
  const variants = [base, ...suffixes.map(s => base + s)];
  console.log(`• Base key: ${base}`);
  console.log(`  Variants: ${variants.join(", ")}`);
  console.log("  Action: verify whether these are genuinely distinct records\n");
}
