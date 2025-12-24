/**
 * CITATION RESOLVER (Refactored)
 * ==============================
 *
 * Usage:
  *   quarto run _scripts/resolve_citations.ts                    # List matches (Dry Run)
  *   quarto run _scripts/resolve_citations.ts -- --fix           # Interactive Fix Mode
  *   quarto run _scripts/resolve_citations.ts -- --output report.txt  # Save clean report to file
  *   quarto run _scripts/resolve_citations.ts -- --auto-fix-high # Auto-fix high confidence
  * 
  * Purpose: *   1. Updates citation lists via `_scripts/update_citation_lists.ts`.
 *   2. Analyzes missing keys against valid keys using structural & fuzzy matching.
 *   3. Scans content files for context.
 *   4. Interactively or automatically applies fixes.
 */

// --- IMPORTS ---
import { walk } from "stdlib/fs";
import { join, dirname, fromFileUrl } from "stdlib/path";
import { parse } from "stdlib/flags";

// --- CONFIGURATION ---
const PATHS = {
  FAILING: "bibliography/citekeys-failing.txt",
  VALID:   "bibliography/citekeys-valid.txt",
  REPORTS: "reports",
  LOG:     "citation_fix_log.txt",
  UPDATE_SCRIPT: "_scripts/update_citation_lists.ts"
};

const SCORING = {
  HIGH_THRESHOLD: 0.95,
  MED_THRESHOLD:  0.50,
  BONUS: {
    EXACT_YEAR:    0.4,
    EXACT_AUTHOR:  0.4,
    SUBSTR_AUTHOR: 0.2,
    EXACT_TITLE:   0.3,
    SUBSTR_TITLE:  0.35, // High reward for "BigDataReport" -> "BigData"
    SUBSTR_KEY:    0.3,
    PREFIX:        0.1
  }
};

// --- ARGS ---
const args = parse(Deno.args, {
  boolean: ["fix", "auto-fix-high", "verbose", "no-update-citations"],
  string: ["output"],
  alias: { v: "verbose", o: "output" }
});
const MODE = {
  INTERACTIVE: args.fix,
  AUTO_HIGH:   args["auto-fix-high"],
  VERBOSE:     args.verbose,
  OUTPUT_FILE: args.output,
  DRY_RUN:     !args.fix && !args["auto-fix-high"],
  SKIP_UPDATE: args["no-update-citations"]
};

// --- TYPES ---
interface KeyParts {
  original: string;
  author: string | null;
  titleWords: string[];
  year: string | null;
  suffix: string | null;
}

interface MatchResult {
  fail: string;
  bestMatch: string;
  bestScore: number;
  contexts: string[]; // Snippets of text where the key appears
  method: "Structure" | "Fuzzy";
}

// =============================================================================
// LOGIC HELPERS
// =============================================================================

function escapeRegExp(s: string): string {
  // Safe character-by-character escape
  const chars = [".", "*", "+", "?", "^", "$", "{", "}", "(", ")", "|", "[", "]", "\\"];
  let res = s;
  for (const c of chars) {
    res = res.replaceAll(c, "\\" + c);
  }
  return res;
}

/** 
 * Creates the standard regex used to find citations in text.
 * Note: Intentionally avoids `\b` at the end to catch edge cases like [@key]. 
 */
function createCitationRegex(key: string): RegExp {
  // Atomic citekey match: stop before suffix or delimiter
  return new RegExp(`@${escapeRegExp(key)}(?=[^a-zA-Z0-9_]|$)`, "g");
}

function parseKey(key: string): KeyParts | null {
  // Robust parsing: peel off Year/Suffix first, then split Author/Title
  let temp = key;
  let year: string | null = null;
  let suffix: string | null = null;

  // 1. Extract Year + Optional Suffix (e.g. 2020, 2020a)
  // Must be at the end of the string
  const yearMatch = temp.match(/(\d{4})([a-z])?$/);
  if (yearMatch) {
    year = yearMatch[1];
    suffix = yearMatch[2] || null;
    temp = temp.substring(0, temp.length - yearMatch[0].length);
  }

  // 2. Extract Author (leading lowercase)
  // Stops at first Uppercase letter (start of Title) or end of string
  let author: string | null = null;
  let rawTitle = "";

  const authorMatch = temp.match(/^([a-z]+)(?=[A-Z]|$)/);
  if (authorMatch) {
    author = authorMatch[1];
    rawTitle = temp.substring(author.length);
  } else {
    // No leading lowercase -> Entirely Title (CamelCase) or Empty
    rawTitle = temp;
  }

  // Guard: Must have at least some structural component
  if (!author && !rawTitle && !year) return null;

  // 3. Split Title Words (CamelCase)
  const titleWords = rawTitle.split(/(?=[A-Z])/).filter(s => s.length > 0);

  return {
    original: key,
    author: author || null,
    titleWords: titleWords,
    year: year || null,
    suffix: suffix || null
  };
}

function compareStructured(fail: KeyParts, valid: KeyParts): number {
  let score = 0;

  // 1. Year (Crucial Filter)
  if (fail.year && valid.year) {
    if (fail.year === valid.year) score += SCORING.BONUS.EXACT_YEAR;
    else return 0; // Penalize year mismatch heavily
  } else if (!fail.year && valid.year) {
    score += 0.2; // Enrichment (Valid key adds missing year)
  }

  // 2. Title Words (Calculate first to condition Author Enrichment)
  const failT = fail.titleWords.map(w => w.toLowerCase()).join("");
  const validT = valid.titleWords.map(w => w.toLowerCase()).join("");
  let titleMatch: "Exact" | "Substr" | "None" = "None";

  if (failT && validT) {
    if (failT === validT) {
      score += SCORING.BONUS.EXACT_TITLE;
      titleMatch = "Exact";
    }
    else if (failT.includes(validT)) {
      score += SCORING.BONUS.SUBSTR_TITLE;
      titleMatch = "Substr";
      // Canonical Normalization Bonus: Long descriptive key -> Short canonical key
      if (!fail.year && valid.year) score += 0.15;
    }
    else if (validT.includes(failT) && valid.titleWords.length <= fail.titleWords.length) {
      score += 0.2;
      titleMatch = "Substr";
    }
  }

  // 3. Author
  if (fail.author && valid.author) {
    if (fail.author === valid.author) score += SCORING.BONUS.EXACT_AUTHOR;
    else if (valid.author.startsWith(fail.author)) score += SCORING.BONUS.SUBSTR_AUTHOR;
    else return 0; // Penalize author mismatch
  } else if (!fail.author && valid.author) {
    // Enrichment: Only reward missing author if Title is EXACT.
    // Prevents "PersonalDataProtection" -> "abadiDataProtection" false positives.
    if (titleMatch === "Exact") {
      score += 0.2;
    }
  }

  return score;
}

function levenshtein(a: string, b: string): number {
  if (!a) return b.length;
  if (!b) return a.length;
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

  for (let i = 0; i <= b.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = (b.charAt(i - 1) === a.charAt(j - 1)) ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,       // deletion
        matrix[i][j - 1] + 1,       // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return matrix[b.length][a.length];
}

// =============================================================================
// I/O HELPERS
// =============================================================================

// NOTE:
// This is the ONLY output that is written to --output.
// Everything else is console-only by design.
async function reportMatch(lines: string[]) {
  // Always print to console
  for (const line of lines) {
    console.log(line);
  }

  // Optionally write to file (ANSI-stripped)
  if (MODE.OUTPUT_FILE) {
    const clean = lines
      .map(l => l.replace(/\x1b\[[0-9;]*m/g, ""))
      .join("\n");
    await Deno.writeTextFile(MODE.OUTPUT_FILE, clean + "\n", { append: true });
  }
}

async function loadKeys(path: string): Promise<string[]> {
  try {
    const text = await Deno.readTextFile(path);
    return [...new Set(text.split("\n").map(s => s.trim()).filter(s => s !== ""))];
  } catch (e) {
    console.error(`Failed to load keys from ${path}`);
    return [];
  }
}

async function runUpdateScript() {
  console.log("Updating citation lists...");
  const cmd = new Deno.Command("quarto", {
    args: ["run", PATHS.UPDATE_SCRIPT],
    stdout: "inherit", stderr: "inherit"
  });
  const status = await cmd.output();
  if (!status.success) {
    console.error("❌ Aborting: Citation list update failed.");
    Deno.exit(1);
  }
}

async function saveSession(fileContents: Map<string, string>, changeLog: string[]) {
  if (changeLog.length === 0) return;

  console.log(`\nWriting changes to ${changeLog.length} keys across files...`);
  let savedCount = 0;

  for (const [path, newContent] of fileContents.entries()) {
    try {
      const currentDisk = await Deno.readTextFile(path);
      // Safety: Only write if file logically changed
      if (currentDisk !== newContent) {
        await Deno.writeTextFile(path, newContent);
        console.log(`   Saved: ${path}`);
        savedCount++;
      }
    } catch (e) {
      console.error(`   ❌ Failed to save ${path}:`, e);
    }
  }

  try {
    const logPath = PATHS.LOG;
    let oldLog = "";
    try { oldLog = await Deno.readTextFile(logPath) + "\n"; } catch { /* ignore new file */ }
    await Deno.writeTextFile(logPath, oldLog + changeLog.join("\n"));
    console.log(`\n✅ Saved ${savedCount} files.`);
    console.log(`📝 Log appended to: ${logPath}`);
  } catch (e) {
    console.error("Failed to write log file:", e);
  }
}

function promptUser(q: string, options: string): string {
  // Basic guard for CI/Non-TTY environments
  if (!Deno.isatty(Deno.stdin.rid)) {
    console.warn("Non-interactive terminal detected. Skipping prompt.");
    return "";
  }
  const res = prompt(`${q} \x1b[1m[${options}]\x1b[0m:`);
  return res ? res.trim().toLowerCase() : "";
}

// --- MAIN EXECUTION ---

async function main() {
  try {
    if (MODE.OUTPUT_FILE) {
      await Deno.writeTextFile(MODE.OUTPUT_FILE, ""); // Clear file
    }

    // 1. Setup
    if (!MODE.SKIP_UPDATE) {
      await runUpdateScript();
    }
    const failingKeys = await loadKeys(PATHS.FAILING);
    const validKeys = await loadKeys(PATHS.VALID);
    console.log(`Loaded ${failingKeys.length} failing keys and ${validKeys.length} valid keys.`);

    // 2. Load Content
    const fileContents = new Map<string, string>();
    try {
      for await (const entry of walk(PATHS.REPORTS, { exts: [".qmd"] })) {
        if (entry.isFile) fileContents.set(entry.path, await Deno.readTextFile(entry.path));
      }
    } catch (e) {
      console.error(`❌ Failed to scan ${PATHS.REPORTS}:`, e);
      Deno.exit(1);
    }
    console.log(`Scanned ${fileContents.size} content files.`);

    // 3. Analysis Phase
    console.log("\nAnalyzing matches...");
    const actionableMatches: MatchResult[] = [];

    for (const fail of failingKeys) {
      let bestMatch = "";
      let bestScore = -1;
      let method: MatchResult["method"] = "Fuzzy";

      const failParsed = parseKey(fail);

      for (const valid of validKeys) {
        let score = 0;
        let currMethod: MatchResult["method"] = "Fuzzy";

        const validParsed = parseKey(valid);
        
        if (failParsed && validParsed) {
          const sScore = compareStructured(failParsed, validParsed);
          if (sScore > 0) {
            score = sScore;
            currMethod = "Structure";
          }
        }

        // Fuzzy Fallback
        if (score === 0) {
          const dist = levenshtein(fail, valid);
          let fuzzy = 1 - (dist / Math.max(fail.length, valid.length));
          
          // Penalty for very short keys to avoid false positive noise
          if (fail.length < 6) fuzzy -= 0.1;

          // Bonus for simple substring
          if (valid.includes(fail) || fail.includes(valid)) {
            score = fuzzy + SCORING.BONUS.SUBSTR_KEY;
          } else {
            score = fuzzy;
          }
        }

        if (score > bestScore) {
          bestScore = score;
          bestMatch = valid;
          method = currMethod;
        }
      }

      if (bestScore < 0.01) continue;

      // Find Contexts
      const contexts: string[] = [];
      const regex = createCitationRegex(fail);
      
      for (const [path, content] of fileContents.entries()) {
        let m;
        // Fix: Reset lastIndex manually if reusing global regex, 
        // though here we create a fresh regex per key, so it's safe.
        while ((m = regex.exec(content)) !== null) {
          const start = Math.max(0, m.index - 60);
          const end = Math.min(content.length, m.index + m[0].length + 60);
          let snippet = content.substring(start, end).replace(/\n/g, " ");
          snippet = snippet.replace(m[0], `\x1b[1m\x1b[31m${m[0]}\x1b[0m`);
          contexts.push(`   \x1b[36m${path}\x1b[0m:\n     "...${snippet.trim()}..."
`);
        }
      }

      if (contexts.length > 0) {
        actionableMatches.push({ fail, bestMatch, bestScore, contexts, method });
      } else {
        if (MODE.VERBOSE) console.log(`Skipping ${fail}: Not found in text.`);
      }
    }

    // Sort: Highest confidence first
    actionableMatches.sort((a, b) => b.bestScore - a.bestScore);

    if (actionableMatches.length === 0) {
      console.log("No actionable citation matches found.");
      return;
    }

    // 4. Reporting / Interactive Phase
    
    if (MODE.DRY_RUN) {
      console.log(`\n\x1b[1mCITATION MATCH REPORT\x1b[0m (${actionableMatches.length} suggestions)`);
      console.log("Run with \x1b[1m--fix\x1b[0m to interactively apply changes.");
      console.log("Run with \x1b[1m--auto-fix-high\x1b[0m to automatically apply high confidence matches.\n");
    } else {
      console.log("\n" + "=".repeat(60));
      console.log("INTERACTIVE CITATION RESOLVER");
      console.log("=".repeat(60));
      console.log("Instructions:");
      console.log("  Suggestions are shown by probability: \x1b[32mHigh\x1b[0m -> \x1b[33mMedium\x1b[0m -> \x1b[31mLow\x1b[0m");
      if (MODE.INTERACTIVE) {
          console.log("Controls:");
          console.log("  [y] Queue fix");
          console.log("  [n] Skip");
          console.log("  [q] Quit menu");
      }
      console.log("=".repeat(60) + "\n");
    }

    const changeLog: string[] = [];

    for (let i = 0; i < actionableMatches.length; i++) {
      const { fail, bestMatch, bestScore, contexts, method } = actionableMatches[i];

      let label = "\x1b[31mLow \x1b[0m";
      let isHigh = false;
      if (bestScore >= SCORING.HIGH_THRESHOLD) { label = "\x1b[32mHigh\x1b[0m"; isHigh = true; }
      else if (bestScore >= SCORING.MED_THRESHOLD) { label = "\x1b[33mMed \x1b[0m"; }

      await reportMatch([
        "-".repeat(60),
        `${label} Match:  \x1b[31m@${fail}\x1b[0m  ->  \x1b[32m@${bestMatch}\x1b[0m  (Score: ${bestScore.toFixed(2)}) [${method}]`,
        ...contexts
      ]);

      let shouldQueue = false;

      if (MODE.AUTO_HIGH && isHigh) {
        console.log("   -> \x1b[32mAuto-queuing fix\x1b[0m (High Confidence)");
        shouldQueue = true;
      } 
      else if (MODE.INTERACTIVE) {
        const input = promptUser("   Queue fix?", "y/N/q");
        
        if (input === "y") {
          shouldQueue = true;
        } else if (input === "q") {
          console.log(`\n\x1b[1mQUIT CONFIRMATION\x1b[0m`);
          console.log(`You have ${changeLog.length} fixes queued.`);
          console.log("  [s] Save queued changes and quit");
          console.log("  [q] Quit without saving (Discard)");
          console.log("  [c] Cancel (Resume resolving)");
          
          const qInput = promptUser("Selection", "s/q/C");
          if (qInput === "s") {
            await saveSession(fileContents, changeLog);
            Deno.exit(0);
          } else if (qInput === "q") {
            console.log("❌ Changes discarded.");
            Deno.exit(0);
          } else {
            i--; // Retry this item
            continue;
          }
        }
      }

      // Apply Logic (Memory Only)
      if (shouldQueue) {
        // Fix: Use simple string replacement for safety, or regex without 'g' flag if we want just one?
        // Actually, we want to replace ALL instances in the file.
        // We recreate the regex here to be safe and clean.
        const regex = createCitationRegex(fail);
        
        for (const path of fileContents.keys()) {
          let content = fileContents.get(path)!;
          // Robust check: Does the file actually contain it?
          // Using split/join is often faster/safer than regex for simple replacements, 
          // but we need to match @key boundary.
          if (regex.test(content)) {
            content = content.replace(regex, `@${bestMatch}`);
            fileContents.set(path, content);
          }
        }
        changeLog.push(`${fail} -> ${bestMatch}`);
      }
    }

    // 5. Final Save
    if (changeLog.length > 0) {
      console.log("\n" + "=".repeat(60));
      console.log(`Processing complete. ${changeLog.length} fixes queued.`);
      
      if (MODE.AUTO_HIGH) {
        await saveSession(fileContents, changeLog);
      } else if (MODE.INTERACTIVE) {
        const confirm = promptUser("Write all changes to disk?", "y/N");
        if (confirm === "y") {
          await saveSession(fileContents, changeLog);
        } else {
          console.log("❌ Changes discarded.");
        }
      }
    } else if (!MODE.DRY_RUN) {
      console.log("\nNo changes queued.");
    }

  } catch (err) {
    console.error("Critical Error:", err);
    Deno.exit(1);
  }
}

// Start
if (import.meta.main) main();
