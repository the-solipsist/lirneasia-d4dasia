// --- IMPORTS ---
import { walk } from "stdlib/fs";
import { join, dirname, fromFileUrl, relative } from "stdlib/path";
import { parse } from "stdlib/flags";

// --- CONFIGURATION ---
const scriptDir = dirname(fromFileUrl(import.meta.url));
const reportsDir = join(scriptDir, "../reports");

// --- CLI ARGUMENTS ---
// Check for --execute or -e flag
const args = parse(Deno.args, {
  boolean: ["execute"],
  alias: { execute: "e" },
});

const isExecutionMode = args.execute;

// --- REGEX EXPLANATION ---
// ^            : Start of line
// (#+\s+)      : Group 1: The hashes and the immediate space (e.g. "## ")
// (            : Group 2: The number part (start)
//   \d+        :   Starts with a digit
//   (?:\.\d+)* :   Optional repeating groups of dot+digits (e.g. .1.1)
//   \.?        :   Optional trailing dot (matches "1." and "1")
// )            : Group 2 (end)
// \s+          : Separator space (will be removed to clean up double spaces)
// (.*)$        : Group 3: The rest of the heading text
const sectionRegex = /^(#+\s+)(\d+(?:\.\d+)*\.?)\s+(.*)$/;

// --- MAIN LOGIC ---
console.log(
  isExecutionMode
    ? "⚠️  EXECUTION MODE: Modifying files..."
    : "🔍 DRY RUN: Listing matches only (use --execute to apply changes)..."
);
console.log("-".repeat(60));

let matchCount = 0;

try {
  // Recursively walk the directory
  for await (const entry of walk(reportsDir)) {
    if (entry.isFile && entry.name.endsWith(".qmd")) {
      await processFile(entry.path);
    }
  }
} catch (err) {
  console.error(`Error accessing ${reportsDir}:`, err);
}

console.log("-".repeat(60));
console.log(`\nDone. Found ${matchCount} instances.`);
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
      matchCount++;
      const [original, prefix, numberPart, textPart] = match;
      
      // Construct the clean line (Prefix + Text)
      // Example: "## " + "Introduction"
      const cleanLine = `${prefix}${textPart}`;

      if (isExecutionMode) {
        newLines.push(cleanLine);
        fileModified = true;
        console.log(`[FIXED] ${relPath}:${i + 1}`);
        console.log(`   Was: ${original}`);
        console.log(`   Now: ${cleanLine}`);
      } else {
        // Dry Run Output
        newLines.push(line); // Keep original
        console.log(`[MATCH] ${relPath}:${i + 1}`);
        console.log(`   Found: "${original}"`);
        console.log(`   Clean: "${cleanLine}"`); 
        console.log("");
      }
    } else {
      newLines.push(line);
    }
  }

  // Write changes back to disk only if modifications happened and we are in execute mode
  if (isExecutionMode && fileModified) {
    await Deno.writeTextFile(filePath, newLines.join("\n"));
  }
}
