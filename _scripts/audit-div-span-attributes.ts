// _scripts/audit-div-span-attributes.ts

// --- IMPORTS ---
import { walk } from "stdlib/fs";
import { join, dirname, fromFileUrl, relative } from "stdlib/path";

// --- CONFIGURATION ---
const scriptDir = dirname(fromFileUrl(import.meta.url));
const reportsDir = join(scriptDir, "../reports"); 
const luaFilter = join(scriptDir, "audit-div-span-attributes.lua");

// --- CATEGORIES ---
type Category = "MARK" | "ALT_FAIL" | "STYLE" | "REF" | "OTHER";

function classify(attrs: string, type: string, id: string): Category {
  const a = attrs.toLowerCase();

  // 1. Missing Alt Text (From Lua)
  if (type === "Image (No Alt)") return "ALT_FAIL";

  // 2. Highlights & Broken Text (Highest Priority)
  if (a.includes(".mark") || type === "Text (Raw)") return "MARK";
  
  // 3. Comments (Strict check to avoid matching "background" in text)
  if (a.includes("comment") || a.includes("annotation") || a.includes("background-color")) return "MARK";

  // 4. Styles (Underline, width, color, etc.)
  if (a.includes(".underline") || a.includes("style=") || a.includes("width=") || a.includes("color")) return "STYLE";

  // 5. References (Figures and Tables)
  if (id.startsWith("tbl-") || id.startsWith("fig-")) return "REF";

  return "OTHER";
}

// --- MAIN EXECUTION ---
console.log(`Auditing Attributes in: ${reportsDir}`);
console.log("Legend:\n 🚨 \x1b[31mHighlights/Broken/No-Alt\x1b[0m\n 🟠 \x1b[33mStyling\x1b[0m\n 📘 \x1b[34mReferences\x1b[0m\n ⚪ Structure\n");

// Ensure Lua filter exists
try { await Deno.stat(luaFilter); } catch { console.error(`Error: Lua filter not found at ${luaFilter}`); Deno.exit(1); }

const fileResults = new Map<string, Record<Category, string[]>>();

for await (const entry of walk(reportsDir)) {
  if (entry.isFile && entry.name.endsWith(".qmd")) {
    
    const cmd = new Deno.Command("quarto", {
      args: ["pandoc", entry.path, "--from", "markdown", "--lua-filter", luaFilter, "--to", "native"],
      stdout: "null", stderr: "piped",
    });

    const { stderr } = await cmd.output();
    const rawOutput = new TextDecoder().decode(stderr).trim();

    if (rawOutput) {
      const relPath = relative(join(scriptDir, ".."), entry.path);
      
      const buckets: Record<Category, string[]> = { MARK: [], ALT_FAIL: [], STYLE: [], REF: [], OTHER: [] };
      let hasContent = false;

      rawOutput.split("\n").forEach(line => {
        const parts = line.split("|");
        if (parts.length >= 4) {
          const [_, type, attrs, content] = parts;
          
          // Extract ID from attrs string "{#my-id .class}" -> "my-id"
          const idMatch = attrs.match(/#([\w-]+)/);
          const id = idMatch ? idMatch[1] : "";

          const cat = classify(attrs, type, id);
          
          let icon = "⚪";
          if (cat === "MARK" || cat === "ALT_FAIL") icon = "\x1b[31m🚨\x1b[0m"; // Red
          if (cat === "STYLE") icon = "\x1b[33m🟠\x1b[0m"; // Yellow
          if (cat === "REF")   icon = "\x1b[34m📘\x1b[0m"; // Blue
          
          const display = `   ${icon} [${type}] ${attrs} \x1b[2m"${content}"\x1b[0m`;
          buckets[cat].push(display);
          hasContent = true;
        }
      });

      if (hasContent) fileResults.set(relPath, buckets);
    }
  }
}

// --- DISPLAY RESULTS ---
if (fileResults.size === 0) console.log("No attributes found.");
else {
  const sortedFiles = Array.from(fileResults.keys()).sort();
  for (const file of sortedFiles) {
    const buckets = fileResults.get(file)!;
    
    // Check if we have anything worth showing
    const total = Object.values(buckets).reduce((acc, arr) => acc + arr.length, 0);
    if (total > 0) {
      console.log(`\x1b[1m📄 ${file}\x1b[0m`);
      
      // ORDER MATTERS HERE:
      printBucket("Highlights, Comments & Missing Alt", [...buckets.ALT_FAIL, ...buckets.MARK]);
      printBucket("Styling (Underlines, Widths)", buckets.STYLE);
      printBucket("Figures & Tables", buckets.REF);
      printBucket("Structure & Other", buckets.OTHER);
      console.log(""); 
    }
  }
}

function printBucket(title: string, items: string[]) {
  if (items.length > 0) {
    console.log(`   \x1b[4m${title}\x1b[0m`);
    items.forEach(i => console.log(i));
  }
}
