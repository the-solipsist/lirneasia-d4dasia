import { parse } from "stdlib/flags";
import { join, relative } from "stdlib/path";

/**
 * Interface representing a CSL JSON bibliography item.
 * We primarily care about the 'id' field for validation.
 */
interface BibItem {
  id: string;
  type?: string;
  title?: string;
  author?: Array<{ family?: string; given?: string; literal?: string }>;
  issued?: { "date-parts"?: Array<Array<number | string>> };
  [key: string]: unknown; // Allow other fields without losing type safety for 'id'
}

const args = parse(Deno.args, {
  string: ["input", "bib"],
});

if (import.meta.main) {
  if (!args.input || !args.bib) {
    console.error("❌ Usage: quarto run _scripts/check_citations.ts --input <path> --bib <path>");
    Deno.exit(1);
  }

  const inputPath = join(Deno.cwd(), args.input);
  const bibPath = join(Deno.cwd(), args.bib);

  await run(inputPath, bibPath);
}

async function run(inputPath: string, bibPath: string) {
  // 1. Read Bibliography
  console.log(`📖 Reading Bibliography: ${relative(Deno.cwd(), bibPath)}`);
  let bibContent = "";
  try {
    bibContent = await Deno.readTextFile(bibPath);
  } catch (e) {
    console.error(`❌ Error reading Bib file: ${e.message}`);
    Deno.exit(1);
  }

  let bibData: BibItem[];
  try {
    bibData = JSON.parse(bibContent);
  } catch (e) {
    console.error(`❌ Error parsing Bib JSON: ${e.message}`);
    Deno.exit(1);
  }

  const validKeys = new Set(bibData.map((item) => item.id));
  console.log(`✅ Loaded ${validKeys.size} citation keys from bibliography.`);

  // 2. Read Input File (CSV or TSV)
  console.log(`📖 Reading Input: ${relative(Deno.cwd(), inputPath)}`);
  let inputContent = "";
  try {
    inputContent = await Deno.readTextFile(inputPath);
  } catch (e) {
    console.error(`❌ Error reading input file: ${e.message}`);
    Deno.exit(1);
  }

  const lines = inputContent.split("\n");
  const missingKeys = new Set<string>();
  const foundKeys = new Set<string>();
  const isTsv = inputPath.toLowerCase().endsWith(".tsv");

  // Skip header if it looks like one
  let startIndex = 0;
  if (lines.length > 0 && (lines[0].toLowerCase().includes("footnote") || lines[0].toLowerCase().includes("citation key"))) {
    startIndex = 1;
  }

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const columns = isTsv ? line.split("\t") : parseCsvLine(line);
    
    // Check columns starting from index 1 (Citation Key 1, 2, etc.)
    for (let c = 1; c < columns.length; c++) {
        const cell = columns[c].trim();
        if (!cell) continue;

        // Pandoc citation keys start with @. We match all sequences starting with @
        const matches = cell.matchAll(/@([a-zA-Z0-9_\-:]+)/g);
        for (const match of matches) {
            const rawKey = match[1];
            
            if (validKeys.has(rawKey)) {
                foundKeys.add(rawKey);
            } else {
                missingKeys.add(rawKey);
            }
        }
    }
  }

  // 3. Report
  console.log("\n📊 Analysis Result:");
  if (missingKeys.size === 0) {
    console.log("✅ All citation keys found in bibliography.");
  } else {
    console.log(`⚠️  Found ${missingKeys.size} missing citation keys:\n`);
    const sortedMissing = Array.from(missingKeys).sort();
    
    for (const key of sortedMissing) {
      const suggestion = findBestMatch(key, validKeys);
      if (suggestion) {
        console.log(`   - ${key.padEnd(30)} --> Did you mean: ${suggestion}?`);
      } else {
        console.log(`   - ${key}`);
      }
    }
    console.log(`\n(Found ${foundKeys.size} valid keys in use)`);
  }
}

/**
 * Finds the best matching key from the valid set.
 */
function findBestMatch(missing: string, validKeys: Set<string>): string | null {
  let bestMatch: string | null = null;
  let bestScore = Infinity;

  for (const valid of validKeys) {
    // 1. Substring checks (High confidence)
    if (valid.includes(missing) || missing.includes(valid)) {
      const lenDiff = Math.abs(valid.length - missing.length);
      if (lenDiff < bestScore) {
        bestScore = lenDiff;
        bestMatch = valid;
      }
      continue;
    }

    // 2. Common Prefix (Medium confidence)
    if (missing.length > 5 && valid.length > 5) {
        let commonPrefix = 0;
        while (commonPrefix < missing.length && commonPrefix < valid.length && missing[commonPrefix] === valid[commonPrefix]) {
            commonPrefix++;
        }
        if (commonPrefix >= 8) {
             if (bestMatch === null) bestMatch = valid;
             continue;
        }
    }

    // 3. Levenshtein (Low confidence / Typo fix)
    if (Math.abs(valid.length - missing.length) <= 3) {
        const dist = levenshtein(missing, valid);
        if (dist <= 3 && dist < bestScore) {
            bestScore = dist;
            bestMatch = valid;
        }
    }
  }
  
  return bestMatch;
}

/**
 * Calculates Levenshtein distance between two strings.
 */
function levenshtein(a: string, b: string): number {
  const n = a.length;
  const m = b.length;
  if (n === 0) return m;
  if (m === 0) return n;

  const d = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));

  for (let i = 0; i <= n; i++) d[i][0] = i;
  for (let j = 0; j <= m; j++) d[0][j] = j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,      // deletion
        d[i][j - 1] + 1,      // insertion
        d[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return d[n][m];
}

/**
 * Parses a single CSV line dealing with quotes
 */
function parseCsvLine(line: string): string[] {
    const result = [];
    let current = "";
    let inQuote = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (inQuote) {
            if (char === '"') {
                if (i + 1 < line.length && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuote = false;
                }
            } else {
                current += char;
            }
        } else {
            if (char === '"') {
                inQuote = true;
            } else if (char === ',') {
                result.push(current.trim());
                current = "";
            } else {
                current += char;
            }
        }
    }
    result.push(current.trim());
    return result;
}
