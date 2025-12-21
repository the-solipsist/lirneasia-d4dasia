/**
 * LINT AND FIX CITATIONS
 * ======================
 * 
 * Usage:
 *   quarto run _scripts/lint_and_fix_citations.ts
 *   quarto run _scripts/lint_and_fix_citations.ts -- --fix
 * 
 * Description:
 *   This script provides a comprehensive suite of tools for managing citations 
 *   within Quarto Markdown (.qmd) files. It unifies functionality that was 
 *   previously split across multiple scripts. 
 * 
 * Features:
 *   1. Fixes Escaped Brackets: Converts `\[@cite]` to `[@cite]`.
 *   2. Merges Consecutive Citations: Converts `[@A][@B]` to `[@A; @B]`.
 *   3. Flags Manual Issues: Detects citations placed immediately before footnotes.
 * 
 * Modes:
 *   - Dry Run (Default): Scans files and reports what *would* happen.
 *   - Fix Mode (--fix): Applies changes directly to the files.
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
 * Pattern: Escaped Citations
 * Finds: \[@citation] (where both brackets are escaped by Pandoc)
 * Goal: Remove the backslash.
 * Logic: Match literal `\[`, then capture non-backslashes (content), then literal `\]`.
 */
const REGEX_ESCAPED = new RegExp("\\\\\\\[(@[^\\\\]+)\\\\\\]", "g");

/**
 * Pattern: Consecutive Citations
 * Finds: [@A] followed by optional whitespace followed by [@B]
 * Goal: Merge into [@A; @B]
 */
const REGEX_CONSECUTIVE = /\\\[(@[^\\]+)\\\](\s*)\\\s*\\\[(@[^\\]+)\\\]/g;

/**
 * Pattern: Citation next to Footnote
 * Finds: [@cite][^1] or [@cite].[^1]
 * Goal: Flag for manual review (style guide usually prefers one over the other).
 */
const REGEX_CITE_FOOTNOTE = /\\\[@[^\\]+\\\]([.,;]?)\s*\\\[\^[^\\]+\\\]/g;


// --- MAIN EXECUTION ---

console.log("-".repeat(60));
console.log(
  isFixMode
    ? "⚠️  FIX MODE: Modifying files..."
    : "🔍 DRY RUN: Previewing changes (Use --fix to apply)..."
);
console.log("-".repeat(60));

let stats = {
  fixedEscapes: 0,
  mergedCitations: 0,
  manualFlags: 0,
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
 * Processes a single file to identify and optionally fix citation issues.
 * @param filePath Absolute path to the .qmd file
 */
async function processFile(filePath: string) {
  const originalContent = await Deno.readTextFile(filePath);
  let content = originalContent;
  const relPath = relative(join(scriptDir, ".."), filePath);
  
  // --- REGEX PATTERNS (Defined locally to avoid state issues) ---
  const REGEX_ESCAPED = new RegExp("\\\\\\[(@[^\\\\]+)\\\\\\]", "g");
  const REGEX_CONSECUTIVE = /\[(@[^\]]+)\](\s*)\[(@[^\]]+)\]/g;
  const REGEX_CITE_FOOTNOTE = /\[@[^\]]+\]([.,;]?)\s*\[\^[^\]]+\]/g;

  const logs: string[] = [];
  let fileHasChanges = false;

  // ---------------------------------------------------------
  // PASS 1: Fix Escaped Brackets (e.g. \[@id])
  // ---------------------------------------------------------
  content = content.replace(REGEX_ESCAPED, (match, capture) => {
    const replacement = `[${capture}]`;
    logs.push(`   \x1b[32m[Fix Escape]\x1b[0m   ${match} -> ${replacement}`);
    stats.fixedEscapes++;
    fileHasChanges = true;
    return replacement;
  });

  // ---------------------------------------------------------
  // PASS 2: Merge Consecutive Citations (e.g. [@A][@B])
  // ---------------------------------------------------------
  // We loop until no more mergeable pairs are found to handle chains of 3+
  let hasMatches = true;
  while (hasMatches) {
    hasMatches = false;
    content = content.replace(REGEX_CONSECUTIVE, (match, c1, _space, c2) => {
      
      // Safety: Avoid merging if semicolon already exists (complex case)
      if (c1.includes(";") || c2.includes(";")) {
        return match;
      }

      hasMatches = true;
      const replacement = `[${c1}; ${c2}]`;
      
      // Log unique merges
      logs.push(`   \x1b[36m[Merge]\x1b[0m        [${c1}] + [${c2}]`);
      stats.mergedCitations++;
      fileHasChanges = true;
      
      return replacement;
    });
  }

  // ---------------------------------------------------------
  // PASS 3: Audit (Citation + Footnote)
  // ---------------------------------------------------------
  // This is read-only; we don't fix it automatically.
  let match;
  while ((match = REGEX_CITE_FOOTNOTE.exec(content)) !== null) {
    const display = match[0].length > 60 ? match[0].substring(0, 57) + "..." : match[0];
    logs.push(`   \x1b[33m[Manual]\x1b[0m       ${display}`);
    stats.manualFlags++;
  }

  // ---------------------------------------------------------
  // REPORT & SAVE
  // ---------------------------------------------------------
  if (logs.length > 0) {
    console.log(`\x1b[1m📄 ${relPath}\x1b[0m`);
    logs.forEach(l => console.log(l));
    console.log("");

    if (isFixMode && fileHasChanges) {
      await Deno.writeTextFile(filePath, content);
      stats.filesChanged++;
    }
  }
}

/**
 * Prints the final execution summary.
 */
function printSummary() {
  console.log("-".repeat(60));
  console.log("Summary:");
  console.log(`   Escapes Fixed:     ${stats.fixedEscapes}`);
  console.log(`   Merges Proposed:   ${stats.mergedCitations}`);
  console.log(`   Manual Flags:      ${stats.manualFlags}`);
  
  if (isFixMode) {
    console.log(`   Files Modified:    ${stats.filesChanged}`);
  } else if (stats.fixedEscapes > 0 || stats.mergedCitations > 0) {
    console.log("\n   Run with \x1b[1m--fix\x1b[0m to apply changes.");
  }
}