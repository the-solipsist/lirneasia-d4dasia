// _scripts/remove-div-span-attributes.ts

// --- IMPORTS ---
import { walk } from "stdlib/fs";
import { join, dirname, fromFileUrl, relative } from "stdlib/path";
import { parse } from "stdlib/flags";

// --- CONFIGURATION ---
const scriptDir = dirname(fromFileUrl(import.meta.url));
const reportsDir = join(scriptDir, "../reports"); 
// Updated filename as requested
const luaFilter = join(scriptDir, "remove-div-span-attributes.lua");

// --- ARGUMENTS ---
const args = parse(Deno.args, { boolean: ["execute"], alias: { execute: "e" } });
const isExecute = args.execute;

// --- MAIN ---
console.log(
  isExecute 
    ? "⚠️  EXECUTION MODE: Overwriting files with cleaned versions..." 
    : "🔍 DRY RUN: Previewing changes (Use --execute to apply)..."
);
console.log("-".repeat(60));

// Ensure filter exists
try { await Deno.stat(luaFilter); } catch { console.error(`Error: Filter not found at ${luaFilter}`); Deno.exit(1); }

let changeCount = 0;

for await (const entry of walk(reportsDir)) {
  if (entry.isFile && entry.name.endsWith(".qmd")) {
    
    const cmdArgs = [
      "pandoc", entry.path,
      "--from", "markdown", 
      "--lua-filter", luaFilter,
      "--wrap=none" // Prevent reflowing text
    ];

    if (isExecute) {
      cmdArgs.push("--to", "markdown", "--output", entry.path);
    } else {
      // Dry Run: Output to markdown but discard it (we only want stderr logs)
      cmdArgs.push("--to", "markdown");
    }

    const cmd = new Deno.Command("quarto", {
      args: cmdArgs,
      stdout: isExecute ? "inherit" : "null", 
      stderr: "piped", // Capture Lua logs AND errors
    });

    const { stderr, success } = await cmd.output();
    const output = new TextDecoder().decode(stderr).trim();
    
    if (!success) {
      // FIX: Print the actual error if Pandoc fails
      console.error(`\x1b[31mError processing ${entry.name}:\x1b[0m`);
      console.error(output); // Print the Lua error message
      continue;
    }

    // Parse Logs
    if (output) {
      const relPath = relative(join(scriptDir, ".."), entry.path);
      let fileHasChanges = false;

      output.split("\n").forEach(line => {
        if (line.startsWith("CHANGE|")) {
          if (!fileHasChanges) {
            console.log(`\x1b[1m📄 ${relPath}\x1b[0m`);
            fileHasChanges = true;
          }
          changeCount++;
          
          const parts = line.split("|");
          if (parts.length >= 5) {
             const type = parts[2];
             const before = parts[3];
             const after = parts[4];
             
             console.log(`   \x1b[36m[${type}]\x1b[0m`);
             console.log(`     Was: \x1b[31m${before}\x1b[0m`);
             console.log(`     Now: \x1b[32m${after}\x1b[0m`);
          }
        }
      });
      
      if (fileHasChanges) console.log("");
    }
  }
}

console.log("-".repeat(60));
console.log(`Done. ${changeCount} potential changes identified.`);
if (!isExecute && changeCount > 0) {
  console.log("Run with --execute to apply changes.");
}
