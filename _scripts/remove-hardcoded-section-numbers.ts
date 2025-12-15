// --- IMPORTS ---
import { walk } from "stdlib/fs";
import { join, dirname, fromFileUrl, relative } from "stdlib/path";
import { parse } from "stdlib/flags";

// --- CONFIGURATION ---
const scriptDir = dirname(fromFileUrl(import.meta.url));
const reportsDir = join(scriptDir, "../reports");

// --- CLI ARGUMENTS ---
const args = parse(Deno.args, {
  boolean: ["execute"],
  alias: { execute: "e" },
});

const isExecutionMode = args.execute;

// --- REGEX EXPLANATION ---
// Matches: "## 1. Title" or "## 2024 Title" or "## 1.1. Title"
const sectionRegex = /^(#+\s+)(\d+(?:\.\d+)*\.?)\s+(.*)$/;

// --- MAIN LOGIC ---
console.log(
  isExecutionMode
    ? "⚠️  EXECUTION MODE: Modifying files..."
    : "🔍 DRY RUN: Listing matches only (use --execute to apply)..."
);
console.log("-".repeat(60));

let matchCount = 0;

try {
  for await (const entry of walk(reportsDir)) {
    if (entry.isFile && entry.name.endsWith(".qmd")) {
      await processFile(entry.path);
    }
  }
} catch (err) {
  console.error(`Error accessing ${reportsDir}:`, err);
}

console.log("-".repeat(60));
console.log(`\nDone. Found ${matchCount} instances to remove (Years were skipped).`);
if (!isExecutionMode && matchCount > 0) {
  console.log("Run with --execute (or -e) to apply these changes.");
}

async function processFile(filePath: string) {
  const content = await Deno.readTextFile(filePath);
  const lines = content.split("\n");
  const newLines: string[] = [];
  let fileModified = false;
  const relPath = relative(join(scriptDir, ".."), filePath);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(sectionRegex);

    if (match) {
      const [original, prefix, numberPart, textPart] = match;

      // --- EXCEPTION: CHECK FOR YEARS ---
      // Pattern: Starts with 19 or 20, followed by 2 digits, optional trailing dot.
      // Matches: "1999", "2024", "2025."
      // Does NOT match: "1.1", "1", "20", "19"
      const isYear = /^(19|20)\d{2}\.?$/.test(numberPart);

      if (isYear) {
        // It's a year, preserve the original line and skip modification
        newLines.push(line);
        continue; 
      }

      // If we get here, it's a regular section number. Proceed to remove it.
      matchCount++;
      const cleanLine = `${prefix}${textPart}`;

      if (isExecutionMode) {
        newLines.push(cleanLine);
        fileModified = true;
        console.log(`[FIXED] ${relPath}:${i + 1}`);
        console.log(`   Was: ${original}`);
        console.log(`   Now: ${cleanLine}`);
      } else {
        newLines.push(line); // Keep original in dry run
        console.log(`[MATCH] ${relPath}:${i + 1}`);
        console.log(`   Found: "${original}"`);
        console.log(`   Clean: "${cleanLine}"`); 
        console.log("");
      }
    } else {
      newLines.push(line);
    }
  }

  if (isExecutionMode && fileModified) {
    await Deno.writeTextFile(filePath, newLines.join("\n"));
  }
}
