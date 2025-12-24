/**
 * UPDATE CITATION LISTS
 * =====================
 * 
 * Usage:
 *   quarto run _scripts/update_citation_lists.ts
 * 
 * Purpose:
 *   1. Reads 'bibliography/d4dasia-bib.json' -> 'bibliography/citekeys-valid.txt'
 *   2. Scans all .qmd files using `quarto pandoc` to find missing citations.
 *   3. Writes missing keys -> 'bibliography/citekeys-failing.txt'
 * 
 *   This prepares the data for `resolve_citations.ts`.
 */

import { walk } from "stdlib/fs";
import { join, dirname, fromFileUrl } from "stdlib/path";

// --- CONFIGURATION ---
const scriptDir = dirname(fromFileUrl(import.meta.url));
const projectRoot = join(scriptDir, "..");
const reportsDir = join(projectRoot, "reports");
const bibDir = join(projectRoot, "bibliography");

const BIB_FILE = join(bibDir, "d4dasia-bib.json");
const OUTPUT_VALID = join(bibDir, "citekeys-valid.txt");
const OUTPUT_FAILING = join(bibDir, "citekeys-failing.txt");

// --- MAIN ---
console.log("-".repeat(60));
console.log("🔄 UPDATING CITATION LISTS");
console.log("-".repeat(60));

// 1. EXTRACT VALID KEYS
try {
  console.log(`Reading bibliography: ${BIB_FILE}`);
  const bibContent = await Deno.readTextFile(BIB_FILE);
  const bibData = JSON.parse(bibContent);
  
  if (Array.isArray(bibData)) {
    const validKeys = bibData.map((item: any) => item.id).filter((k: any) => typeof k === 'string');
    await Deno.writeTextFile(OUTPUT_VALID, validKeys.join("\n"));
    console.log(`✅ Extracted ${validKeys.length} valid keys -> ${OUTPUT_VALID}`);
  } else {
    console.error("❌ Error: Bibliography JSON is not an array.");
  }
} catch (err) {
  console.error(`❌ Failed to read bibliography: ${err.message}`);
}

// 2. FIND FAILING KEYS
console.log("\nScanning reports for missing citations...");

const missingKeys = new Set<string>();
let filesProcessed = 0;

for await (const entry of walk(reportsDir, { exts: [".qmd"] })) {
  if (entry.isFile) {
    // Skip hidden files
    if (entry.name.startsWith("_")) continue;

    // Progress indicator
    console.log(`\n📄 Checking: ${entry.name}`);
    const t0 = performance.now();

    try {
      // Use absolute path for bibliography to avoid ambiguity
      const cmd = new Deno.Command("quarto", {
        args: [
          "pandoc",
          entry.path,
          "--citeproc",
          "--to", "native", // Fastest output format for this purpose
          // Write to /dev/null (or platform equivalent handled by Deno stdout: null)
          // We don't pass "--output" "-" because Deno's null handles the pipe
          "--bibliography", BIB_FILE 
        ],
        stdout: "null", // Discard standard output
        stderr: "piped", // Capture warnings
      });

      const { stderr } = await cmd.output();
      const errorOutput = new TextDecoder().decode(stderr);
      
      const t1 = performance.now();
      // console.log(`   (took ${(t1 - t0).toFixed(0)}ms)`);

      // Parse warnings: "[WARNING] Citeproc: citation <KEY> not found"
      const regex = /\[WARNING\] Citeproc: citation (.+?) not found/g;
      let match;
      let foundInFile = 0;
      
      while ((match = regex.exec(errorOutput)) !== null) {
        missingKeys.add(match[1]);
        foundInFile++;
      }
      
      if (foundInFile > 0) {
        console.log(`   ⚠️  Found ${foundInFile} missing citations`);
      } else {
        console.log(`   ✅ OK`);
      }
      
      filesProcessed++;

    } catch (err) {
      console.error(`   ❌ Error running pandoc: ${err.message}`);
    }
  }
}

// Write failing keys
const sortedMissing = [...missingKeys].sort();
await Deno.writeTextFile(OUTPUT_FAILING, sortedMissing.join("\n"));

console.log("-".repeat(60));
console.log(`Processed ${filesProcessed} files.`);
console.log(`Found ${sortedMissing.length} unique failing keys -> ${OUTPUT_FAILING}`);
console.log("-".repeat(60));