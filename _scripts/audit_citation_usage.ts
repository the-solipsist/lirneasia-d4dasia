/**
 * AUDIT CITATION & CONTENT USAGE
 * ==============================
 * 
 * Usage:
 *   quarto run _scripts/audit_citation_usage.ts
 *   quarto run _scripts/audit_citation_usage.ts -- --footnotes
 *   quarto run _scripts/audit_citation_usage.ts -- --all-footnotes
 * 
 * Description:
 *   Reports on citation and footnote usage across the project using Pandoc Lua filters.
 * 
 * Modes:
 *   - List (Default): Lists all citation keys found in the documents.
 *     Uses: `audit_citation_usage.keys.lua`
 * 
 *   - Citations in Footnotes (--footnotes): Audits citations that appear *inside* footnotes.
 *     Uses: `audit_citation_usage.footnotes.lua`
 * 
 *   - All Footnotes (--all-footnotes): Lists content of all footnotes.
 *     Uses: `audit_citation_usage.all_footnotes.lua`
 */

// --- IMPORTS ---
import { walk } from "stdlib/fs";
import { join, dirname, fromFileUrl, relative } from "stdlib/path";
import { parse } from "stdlib/flags";

// --- CONFIGURATION ---
const scriptDir = dirname(fromFileUrl(import.meta.url));
const reportsDir = join(scriptDir, "../reports");

// Lua Filters
const LUA_KEYS = join(scriptDir, "audit_citation_usage.keys.lua");
const LUA_CITE_IN_FOOTNOTES = join(scriptDir, "audit_citation_usage.footnotes.lua");
const LUA_ALL_FOOTNOTES = join(scriptDir, "audit_citation_usage.all_footnotes.lua");

// --- ARGUMENT PARSING ---
const args = parse(Deno.args, {
  boolean: ["footnotes", "all-footnotes"],
});

let mode = "LIST"; // Default
let filterToUse = LUA_KEYS;

if (args.footnotes) {
  mode = "CITE_IN_FOOTNOTES";
  filterToUse = LUA_CITE_IN_FOOTNOTES;
} else if (args["all-footnotes"]) {
  mode = "ALL_FOOTNOTES";
  filterToUse = LUA_ALL_FOOTNOTES;
}

// --- MAIN EXECUTION ---

console.log("-".repeat(60));
if (mode === "CITE_IN_FOOTNOTES") {
  console.log("🔍 AUDIT: Searching for citations inside footnotes...");
} else if (mode === "ALL_FOOTNOTES") {
  console.log("🔍 AUDIT: Listing all footnote content...");
} else {
  console.log("🔍 AUDIT: Listing all citation keys...");
}
console.log("-".repeat(60));

// Verify Filter
try { await Deno.stat(filterToUse); } 
catch { console.error(`❌ Missing Lua filter: ${filterToUse}`); Deno.exit(1); }

// Walk Files
for await (const entry of walk(reportsDir)) {
  if (entry.isFile && entry.name.endsWith(".qmd")) {
    const relPath = relative(join(scriptDir, ".."), entry.path);

    const cmd = new Deno.Command("quarto", {
      args: ["pandoc", entry.path, "--from", "markdown", "--lua-filter", filterToUse, "--to", "native"],
      stdout: "null",    // Discard native AST output
      stderr: "piped",   // Capture Lua output
    });

    const { stderr } = await cmd.output();
    const output = new TextDecoder().decode(stderr).trim();

    // The Lua scripts are designed to print structured logs to stderr.
    if (output) {
      if (mode === "LIST") {
        // Output format: "[CITE] filename: @key"
        const citations = output.split("\n").filter(l => l.startsWith("[CITE]"));
        if (citations.length > 0) {
           console.log(`\x1b[1m📄 ${relPath}\x1b[0m`);
           citations.forEach(c => {
             const key = c.split("@")[1];
             console.log(`   @${key}`);
           });
           console.log("");
        }
      } else {
        // Footnote modes print their own structured output (with filenames usually included by the Lua script)
        // But the Lua script might print the absolute path or just "Unknown". 
        // Let's print the filename header if the output doesn't seem to have it clearly, 
        // or just rely on the output.
        // The Lua scripts generally print the filename they see.
        
        // Simple pass-through for now, as the Lua scripts in this project 
        // tend to handle their own formatting.
        console.log(output);
      }
    }
  }
}

console.log("-".repeat(60));
console.log("Done.");