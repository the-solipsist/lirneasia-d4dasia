/**
 * LINT AND FIX HEADINGS
 * =====================
 *
 * Usage:
 *   quarto run _scripts/lint_and_fix_headings.ts
 *   quarto run _scripts/lint_and_fix_headings.ts reports/id/file.qmd --fix
 *
 * Description:
 *   Standardizes Markdown headings by removing manual formatting that conflicts 
 *   with the auto-generated styles.
 *
 * Features:
 *   1. Remove Bold Markers: `## **Title**` -> `## Title`
 *   2. Remove Hardcoded Numbers: `## 1.1. Title` -> `## Title`
 *   3. Remove Malformed List-Headings: `1. #### Title` -> `#### Title`
 *   4. Remove Empty Headings: `###   ` -> (Removed)
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
const specificFiles = args._.map(String);

// --- REGEX PATTERNS ---

/**
 * Pattern: Heading Line (Generic)
 * Matches: Lines starting with optional whitespace, optional list marker (1.), 
 * then hashes (#) and space.
 */
const REGEX_HEADING_START = /^\s*(?:\d+\.?\s+)?(#+\s+)(.*)$/;

/**
 * Pattern: Empty Headings
 * Matches: Lines with just hashes and optional whitespace, allowing for indentation.
 */
const REGEX_EMPTY_HEADING = /^\s*(#+)\s*$/;

/**
 * Pattern: Hardcoded Numbers
 * Matches: Headings starting with numbers like "1.", "1.1.", "1\.1", "10.2", etc.
 * Handles escaped dots (e.g. "1\") which are common in Markdown.
 */
const REGEX_INTERNAL_NUMBER = /^(\d+(?:\\?\\.\\d+)*(?:\\?\\.)?)\s+(.*)$/;

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
  emptyRemoved: 0,
  malformedFixed: 0,
  filesChanged: 0
};

if (specificFiles.length > 0) {
  for (const filePath of specificFiles) {
    try {
        await processFile(filePath);
    } catch (error) {
        console.error(`❌ Error processing ${filePath}: ${error.message}`);
    }
  }
} else {
  for await (const entry of walk(reportsDir)) {
    if (entry.isFile && entry.name.endsWith(".qmd")) {
      await processFile(entry.path);
    }
  }
}

printSummary();


// --- CORE LOGIC ---

/**
 * Scans a file line-by-line to correct heading formatting.
 */
async function processFile(filePath: string) {
  const content = await Deno.readTextFile(filePath);
  const lines = content.split("\n");
  const newLines: string[] = [];
  
  let fileHasChanges = false;
  let fileLogPrinted = false;
  
  let relPath = filePath;
  try {
      relPath = relative(Deno.cwd(), filePath);
  } catch {}

  const logMatch = (type: string, oldLine: string, newLine: string | null, lineNum: number) => {
    if (!fileLogPrinted) {
      console.log(`\x1b[1m📄 ${relPath}\x1b[0m`);
      fileLogPrinted = true;
    }
    console.log(`   Line ${lineNum}: \x1b[36m[${type}]\x1b[0m`);
    console.log(`     Was: ${oldLine}`);
    if (newLine !== null) {
        console.log(`     Now: ${newLine}`);
    } else {
        console.log(`     Action: Removed line`);
    }
  };

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    let modified = false;

    // 1. Check for Empty Headings
    if (REGEX_EMPTY_HEADING.test(line)) {
        stats.emptyRemoved++;
        fileHasChanges = true;
        logMatch("Remove Empty", line, null, i + 1);
        continue;
    }

    // 2. Detect Heading Structure
    const headingMatch = line.match(REGEX_HEADING_START);
    if (headingMatch) {
        const originalLine = line;
        let [full, hashes, text] = headingMatch;

        // Check if it was malformed (had a leading list marker like '1. ####')
        if (line.trim().match(/^\d/)) {
            stats.malformedFixed++;
            modified = true;
            // We already have 'hashes' and 'text' extracted correctly by the groups
            line = `${hashes}${text}`;
        }

        // 3. Remove Bold Markers
        if (text.includes("**")) {
            text = text.replaceAll("**", "");
            stats.boldRemoved++;
            modified = true;
            line = `${hashes}${text}`;
        }

        // 4. Remove Internal Numbers (e.g. '#### 1.1 Title')
        const numMatch = text.match(REGEX_INTERNAL_NUMBER);
        if (numMatch) {
            const [_, numberPart, textPart] = numMatch;
            if (!REGEX_YEAR.test(numberPart)) {
                stats.numbersRemoved++;
                modified = true;
                line = `${hashes}${textPart}`;
            }
        }

        if (modified) {
            fileHasChanges = true;
            logMatch("Fix Heading", originalLine, line, i + 1);
        }
    }

    newLines.push(line);
  }

  if (fileHasChanges) {
    if (isFixMode) {
      await Deno.writeTextFile(filePath, newLines.join("\n"));
      stats.filesChanged++;
    } else {
      console.log(""); 
    }
  }
}

function printSummary() {
  console.log("-".repeat(60));
  console.log("Summary:");
  console.log(`   Bold Markers Removed:  ${stats.boldRemoved}`);
  console.log(`   Numbers Removed:       ${stats.numbersRemoved}`);
  console.log(`   Malformed Fixed:       ${stats.malformedFixed}`);
  console.log(`   Empty Headings Removed:${stats.emptyRemoved}`);
  
  if (isFixMode) {
    console.log(`   Files Modified:        ${stats.filesChanged}`);
  } else if (stats.boldRemoved > 0 || stats.numbersRemoved > 0 || stats.emptyRemoved > 0 || stats.malformedFixed > 0) {
    console.log("\n   Run with \x1b[1m--fix\x1b[0m to apply changes.");
  }
}