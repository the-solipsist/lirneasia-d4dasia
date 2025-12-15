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

// --- REGEX ---
// Detects a line starting with one or more hashes followed by a space
const headingRegex = /^(#+\s+)(.*)$/;

// --- MAIN LOGIC ---
console.log(
  isExecutionMode
    ? "⚠️  EXECUTION MODE: Removing bold markers from headings..."
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
    const match = line.match(headingRegex);

    // If it's a heading AND contains bold markers
    if (match && line.includes("**")) {
      matchCount++;
      
      // Remove all instances of '**' from the line
      // Note: We use replaceAll to handle multiple bold sections in one header
      const cleanLine = line.replaceAll("**", "");

      if (isExecutionMode) {
        newLines.push(cleanLine);
        fileModified = true;
        console.log(`[FIXED] ${relPath}:${i + 1}`);
        console.log(`   Was: ${line}`);
        console.log(`   Now: ${cleanLine}`);
      } else {
        newLines.push(line); // Keep original in dry run
        console.log(`[MATCH] ${relPath}:${i + 1}`);
        console.log(`   Found: "${line}"`);
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
