// --- IMPORTS (Quarto 1.6+ Native) ---
import { walk } from "stdlib/fs";
import { join, dirname, fromFileUrl } from "stdlib/path";

// --- CONFIGURATION ---
// 1. In-script fallback (used if no CLI flag is present)
const APPLY_CHANGES_DEFAULT = false; 

// The directory containing the Quarto files.
const TARGET_DIR_REL = "../reports";

// --- SETUP & CONTEXT ---

// Check for CLI arguments: --apply-changes or --no-dry-run
const args = Deno.args;
const cliApply = args.includes("--apply-changes") || args.includes("--no-dry-run");

// Final decision on the mode: CLI input overrides the default constant.
const APPLY_CHANGES = cliApply || APPLY_CHANGES_DEFAULT;

const scriptDir = dirname(fromFileUrl(import.meta.url));
const targetDir = join(scriptDir, TARGET_DIR_REL);

// The Regex Pattern: Finds \[@...\] and captures the content.
const pattern = /\\\[(@[^\]]+)\\\]/g;

console.log(`--- STARTING BULK CITATION CLEANUP ---`);
console.log(`Target Directory: ${targetDir}`);
console.log(`Mode:             ${APPLY_CHANGES ? "LIVE SAVE (Changes will be written)" : "DRY RUN (Preview only, use CLI flag to apply)"}\n`);

// --- MAIN ASYNCHRONOUS FILE WALKER ---
for await (const entry of walk(targetDir, { ext: ["qmd"] })) {
  
  if (entry.isFile) {
    const filepath = entry.path;
    const content = await Deno.readTextFile(filepath);
    
    const changes: string[] = [];

    // 2. TRANSFORM (IN MEMORY)
    // We use String.prototype.replace() with a custom function.
    // The 'offset' parameter tells us the exact position of the match.
    const newContent = content.replace(pattern, (match, capture, offset) => {
      
      const replacement = `[${capture}]`;
      
      // --- LINE NUMBER CALCULATION (Non-blocking) ---
      // We calculate the number of newlines from the start of the file to the match offset.
      const contentFromStart = content.substring(0, offset);
      // Line number = (count of newlines) + 1
      const lineNumber = (contentFromStart.match(/\n/g) || []).length + 1;
      // --- END LINE NUMBER CALCULATION ---
      
      // Buffer the log message with the line number prepended
      changes.push(`   Line ${lineNumber.toString().padEnd(4)} | ${match}  -->  ${replacement}`);
      
      return replacement;
    });

    // 3. REPORT & SAVE
    if (changes.length > 0) {
      // Print the File Header
      console.log(`📄 Checking: ${filepath}`);
      
      // Print the buffered changes
      changes.forEach(log => console.log(log));

      // 4. WRITE (CONDITIONAL)
      if (APPLY_CHANGES) {
        await Deno.writeTextFile(filepath, newContent);
        console.log("   ✅ Saved.");
      }
      
      console.log(""); 
    }
  }
}

console.log(`--- DONE ---`);
if (!APPLY_CHANGES) {
  console.log("Tip: Run with 'quarto run fix_citations.ts -- --apply-changes' to write files.");
}
