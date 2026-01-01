import { parse } from "stdlib/flags";
import { join, relative } from "stdlib/path";

const args = parse(Deno.args, {
  string: ["input", "bib"],
});

if (import.meta.main) {
  if (!args.input || !args.bib) {
    console.log("Usage: quarto run _scripts/check_citations.ts --input <path> --bib <path>");
    Deno.exit(1);
  }

  const inputPath = join(Deno.cwd(), args.input);
  const bibPath = join(Deno.cwd(), args.bib);

  await run(inputPath, bibPath);
}

async function run(inputPath: string, bibPath: string) {
  // 1. Read Bibliography
  console.log(`Reading Bibliography: ${relative(Deno.cwd(), bibPath)}`);
  let bibContent = "";
  try {
    bibContent = await Deno.readTextFile(bibPath);
  } catch (e) {
    console.error(`Error reading Bib file: ${e.message}`);
    Deno.exit(1);
  }

  let bibData: any[];
  try {
    bibData = JSON.parse(bibContent);
  } catch (e) {
    console.error(`Error parsing Bib JSON: ${e.message}`);
    Deno.exit(1);
  }

  const validKeys = new Set(bibData.map((item: any) => item.id));
  console.log(`Loaded ${validKeys.size} citation keys from bibliography.`);

  // 2. Read Input File (CSV or TSV)
  console.log(`Reading Input: ${relative(Deno.cwd(), inputPath)}`);
  let inputContent = "";
  try {
    inputContent = await Deno.readTextFile(inputPath);
  } catch (e) {
    console.error(`Error reading input file: ${e.message}`);
    Deno.exit(1);
  }

  const lines = inputContent.split("\n");
  const missingKeys = new Set<string>();
  const foundKeys = new Set<string>();
  const isTsv = inputPath.toLowerCase().endsWith(".tsv");

  // Skip header if it looks like one
  let startIndex = 0;
  if (lines[0].toLowerCase().includes("footnote") || lines[0].toLowerCase().includes("citation key")) {
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
        // and consisting of valid key characters.
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
  console.log("\nAnalysis Result:");
  if (missingKeys.size === 0) {
    console.log("All citation keys found in bibliography.");
  } else {
    console.log(`Found ${missingKeys.size} missing citation keys:\n`);
    const sortedMissing = Array.from(missingKeys).sort();
    
    for (const key of sortedMissing) {
      const suggestion = findBestMatch(key, validKeys);
      if (suggestion) {
        console.log(`- ${key}  --> Did you mean: ${suggestion}?`);
      } else {
        console.log(`- ${key}`);
      }
    }
    console.log(`\n(Found ${foundKeys.size} valid keys)`);
  }
}

/**
 * Finds the best matching key from the valid set.
 */
function findBestMatch(missing: string, validKeys: Set<string>): string | null {
  let bestMatch: string | null = null;
  let bestScore = Infinity; // Lower is better for Levenshtein

  for (const valid of validKeys) {
    // 1. Substring checks (High confidence)
    if (valid.includes(missing) || missing.includes(valid)) {
      // Prefer the one that is closer in length
      const lenDiff = Math.abs(valid.length - missing.length);
      if (lenDiff < bestScore) {
        bestScore = lenDiff; // Treat length diff as a "score" for substrings
        bestMatch = valid;
      }
      continue;
    }

    // 2. Common Prefix (Medium confidence)
    // Keys often start with author name.
    if (missing.length > 5 && valid.length > 5) {
        let commonPrefix = 0;
        while (commonPrefix < missing.length && commonPrefix < valid.length && missing[commonPrefix] === valid[commonPrefix]) {
            commonPrefix++;
        }
        if (commonPrefix >= 8) { // 8 chars is a decent overlap for author + partial title
             // Only pick if we haven't found a substring match
             if (bestMatch === null) bestMatch = valid;
             continue;
        }
    }

    // 3. Levenshtein (Low confidence / Typo fix)
    // Only run on keys that look somewhat similar in length to avoid costly n^2 on all keys
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
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  // increment along the first column of each row
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  // increment each column in the first row
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) == a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
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