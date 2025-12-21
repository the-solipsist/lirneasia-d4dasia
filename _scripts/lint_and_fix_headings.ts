/**
 * LINT AND FIX HEADINGS
 * =====================
 *
 * Usage:
 *   quarto run _scripts/lint_and_fix_headings.ts
 *   quarto run _scripts/lint_and_fix_headings.ts -- --fix
 *
 * Description:
 *   Standardizes Markdown headings by removing manual formatting that conflicts 
 *   with the auto-generated styles.
 *
 * Features:
 *   1. Remove Bold Markers: `## **Title**` -> `## Title`
 *      (Bold in headings is redundant and breaks TOC linking).
 *   2. Remove Hardcoded Numbers: `## 1.1. Title` -> `## Title`
 *      (Quarto handles numbering automatically).
 *      *Exception:* Years (e.g., 1999, 2024) are preserved.
 *
 * Modes:
 *   - Dry Run (Default): Lists proposed changes.
 *   - Fix Mode (--fix): Applies changes.
 */

// --- IMPORTS ---
import { walk } from "stdlib/fs";
import { join, dirname, fromFileUrl, relative } from "stdlib/path";
import { parse } from "stdlib/flags";

// --- CONFIGURATION ---
const scriptDir = dirname(fromFileUrl(import.meta.url));
const reportsDir = join(scriptDir, "../reports");

// --- ARGUMENT PARSING ---
const args = parse(Deno.args, {
  boolean: ["fix"],
  alias: { fix: ["execute", "e"] },
});
const isFixMode = args.fix;

// --- REGEX PATTERNS ---

/**
 * Pattern: Bold Headings
 * Matches: Lines starting with hashes (#) that contain double asterisks (**).
 */
const REGEX_HEADING_LINE = /^(#+\s+)(.*)$/;

/**
 * Pattern: Hardcoded Numbers
 * Matches: Headings starting with numbers like "1.", "1.1.", "10.2", etc.
 * Captures:
 *  1. Hashes and space
 *  2. The number part
 *  3. The rest of the title
 */
const REGEX_NUMBERED_HEADING = /^(#+\s+)(\d+(?:\.\d+)*\.?)\s+(.*)$/;

/**
 * Pattern: Years
 * Used to exempt years (19xx, 20xx) from being removed as "numbers".
 */
const REGEX_YEAR = /^(19|20)\d{2}\.?$/;


// --- MAIN EXECUTION ---

console.log("-".repeat(60));
console.log(
  isFixMode
    ? "⚠️  FIX MODE: Modifying headings..."
    : "🔍 DRY RUN: Previewing changes (Use --fix to apply)..."
);
console.log("-".repeat(60));

let stats = {
  boldRemoved: 0,
  numbersRemoved: 0,
  filesChanged: 0
};

// Start the file walk
for await (const entry of walk(reportsDir)) {
  if (entry.isFile && entry.name.endsWith(".qmd")) {
    await processFile(entry.path);
  }
}

printSummary();


// --- CORE LOGIC ---

/**
 * Scans a file line-by-line to correct heading formatting.
 * @param filePath Absolute path to the .qmd file
 */
async function processFile(filePath: string) {
  const content = await Deno.readTextFile(filePath);
  const lines = content.split("\n");
  const newLines: string[] = [];
  
  let fileHasChanges = false;
  let fileLogPrinted = false;
  const relPath = relative(join(scriptDir, ".."), filePath);

  // Helper to log only once per file
  const logMatch = (type: string, oldLine: string, newLine: string, lineNum: number) => {
    if (!fileLogPrinted) {
      console.log(`\x1b[1m📄 ${relPath}\x1b[0m`);
      fileLogPrinted = true;
    }
    console.log(`   Line ${lineNum}: \x1b[36m[${type}]\x1b[0m`);
    console.log(`     Was: ${oldLine}`);
    console.log(`     Now: ${newLine}`);
  };

  // Process line by line
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    let modified = false;

    // 1. Remove Bold Markers
    if (REGEX_HEADING_LINE.test(line) && line.includes("**")) {
      const original = line;
      line = line.replaceAll("**", "");
      stats.boldRemoved++;
      modified = true;
      logMatch("Remove Bold", original, line, i + 1);
    }

    // 2. Remove Hardcoded Numbers
    const matchNum = line.match(REGEX_NUMBERED_HEADING);
    if (matchNum) {
      const [_, prefix, numberPart, textPart] = matchNum;

      // Check exception: Is it a year?
      if (!REGEX_YEAR.test(numberPart)) {
        const original = line;
        line = `${prefix}${textPart}`;
        stats.numbersRemoved++;
        modified = true;
        logMatch("Remove Number", original, line, i + 1);
      }
    }

    if (modified) fileHasChanges = true;
    newLines.push(line);
  }

  // Save if needed
  if (fileHasChanges) {
    if (isFixMode) {
      await Deno.writeTextFile(filePath, newLines.join("\n"));
      stats.filesChanged++;
    } else {
      console.log(""); // Spacing for dry run output
    }
  }
}

function printSummary() {
  console.log("-".repeat(60));
  console.log("Summary:");
  console.log(`   Bold Markers Removed:  ${stats.boldRemoved}`);
  console.log(`   Numbers Removed:       ${stats.numbersRemoved}`);
  
  if (isFixMode) {
    console.log(`   Files Modified:        ${stats.filesChanged}`);
  } else if (stats.boldRemoved > 0 || stats.numbersRemoved > 0) {
    console.log("\n   Run with \x1b[1m--fix\x1b[0m to apply changes.");
  }
}
