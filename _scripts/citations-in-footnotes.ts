// --- IMPORTS ---
import { walk } from "stdlib/fs";
import { join, dirname, fromFileUrl, relative } from "stdlib/path";

// --- CONFIGURATION ---
const scriptDir = dirname(fromFileUrl(import.meta.url));
// Assuming script is in _scripts/, reports is in project root
const reportsDir = join(scriptDir, "../reports"); 
const luaFilter = join(scriptDir, "citations-in-footnotes.lua");

// --- MAIN EXECUTION ---
console.log(`Scanning for .qmd files in: ${reportsDir}\n`);

// Verify reports directory exists
try {
  await Deno.stat(reportsDir);
} catch {
  console.error(`Error: Reports directory not found at ${reportsDir}`);
  Deno.exit(1);
}

// Walk through the directory recursively
for await (const entry of walk(reportsDir)) {
  
  // Filter: Must be a file and end with .qmd
  if (entry.isFile && entry.name.endsWith(".qmd")) {
    
    // Calculate relative path just for cleaner logging
    const relPath = relative(join(scriptDir, ".."), entry.path);

    // Run Quarto Pandoc
    const command = new Deno.Command("quarto", {
      args: [
        "pandoc",
        entry.path,
        "--from", "markdown",
        "--lua-filter", luaFilter,
        "--to", "native" 
      ],
      stdout: "null",    // Discard document output
      stderr: "inherit", // Show Lua logs
    });

    const output = await command.output();

    if (!output.success) {
      console.error(`\x1b[31mError processing: ${relPath}\x1b[0m`);
    }
  }
}

console.log("\nCheck complete.");
