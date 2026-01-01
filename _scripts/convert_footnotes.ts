/**
 * CONVERT FOOTNOTES TO CITATIONS
 * ==============================
 *
 * Usage:
 *   quarto run _scripts/convert_footnotes.ts --csv <path/to/map.csv> --target <path/to/file.md>
 *   quarto run _scripts/convert_footnotes.ts --csv <path/to/map.csv> --target <path/to/file.md> --fix
 *
 * Description:
 *   1. Matches footnotes in the document to citekeys in the CSV/TSV by their marker (e.g. [^1]).
 *   2. Replaces markers in the body with inline Pandoc citations (e.g. [@key1; @key2]).
 *   3. Removes the footnote definitions from the bottom of the document.
 */

import { parse } from "stdlib/flags";
import { join, relative } from "stdlib/path";

// --- ARGUMENT PARSING ---
const args = parse(Deno.args, {
  boolean: ["fix"],
  string: ["target", "csv"],
  alias: { fix: ["execute", "e"] },
});

const isFixMode = args.fix;

if (import.meta.main) {
  if (!args.csv || !args.target) {
    printHelp();
    Deno.exit(1);
  }

  const csvPath = join(Deno.cwd(), args.csv);
  const targetFile = join(Deno.cwd(), args.target);

  console.log("- ".repeat(60));
  console.log("🔄 CONVERT FOOTNOTES TO CITATIONS");
  console.log("- ".repeat(60));
  console.log(`   Map File: ${relative(Deno.cwd(), csvPath)}`);
  console.log(`   Target:   ${relative(Deno.cwd(), targetFile)}`);
  console.log(`   Mode:     ${isFixMode ? "⚠️  FIX (Writing changes)" : "🔍 DRY RUN"}`);
  console.log("- ".repeat(60));

  await run(csvPath, targetFile);
}

function printHelp() {
  console.log(`
Usage:
  quarto run _scripts/convert_footnotes.ts --csv <path> --target <path> [--fix]
`);
}

async function run(csvPath: string, targetFile: string) {
  // 1. Read and Parse Mapping
  let csvContent = "";
  try {
    csvContent = await Deno.readTextFile(csvPath);
  } catch (e) {
    console.error(`❌ Error reading mapping file: ${e.message}`);
    Deno.exit(1);
  }

  const isTsv = csvPath.toLowerCase().endsWith(".tsv");
  const mapping = parseMapping(csvContent, isTsv);
  console.log(`   ✅ Loaded ${mapping.size} mappings from ${isTsv ? "TSV" : "CSV"}.`);

  // 2. Read Target File
  let fileContent = "";
  try {
    fileContent = await Deno.readTextFile(targetFile);
  } catch (e) {
    console.error(`❌ Error reading target file: ${e.message}`);
    Deno.exit(1);
  }

  // 3. Match and Replace in Body
  // We sort markers by length descending to avoid partial matches (e.g. [^1] inside [^11])
  const sortedMarkers = Array.from(mapping.keys()).sort((a, b) => b.length - a.length);
  
  let newContent = fileContent;
  const changes = [];

  for (const marker of sortedMarkers) {
    const keys = mapping.get(marker)!;
    const citationString = `[${keys.join("; ")}]`;
    
    // Escape marker for regex
    const escapedMarker = marker.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    
    // Look for marker not followed by : (which would be the definition)
    const bodyRegex = new RegExp(`${escapedMarker}(?!:)`, "g");
    
    if (bodyRegex.test(newContent)) {
      const count = (newContent.match(bodyRegex) || []).length;
      newContent = newContent.replace(bodyRegex, citationString);
      changes.push(`   Replaced body marker ${marker} -> ${citationString} (${count}x)`);
    }
  }

  // 4. Remove Footnote Definitions
  // Definitions look like [^1]: ...
  const lines = newContent.split("\n");
  const filteredLines = [];
  let skipping = false;

  for (const line of lines) {
    const defMatch = line.match(/^(\[\^?\d+\]):/);
    if (defMatch) {
      const marker = defMatch[1];
      if (mapping.has(marker)) {
        skipping = true;
        changes.push(`   Removing definition for ${marker}`);
        continue;
      } else {
        skipping = false;
      }
    } else if (skipping) {
      // If the line is indented or empty, it might still be part of the footnote definition
      if (line.startsWith(" ") || line.startsWith("\t") || line.trim() === "") {
        continue;
      } else {
        skipping = false;
      }
    }
    filteredLines.push(line);
  }

  const finalContent = filteredLines.join("\n");

  // 5. Report and Save
  if (changes.length > 0) {
    console.log(`
Found ${changes.length} actions:`);
    changes.slice(0, 15).forEach(c => console.log(c));
    if (changes.length > 15) console.log(`   ... and ${changes.length - 15} more.`);

    if (isFixMode) {
      await Deno.writeTextFile(targetFile, finalContent);
      console.log(`
✅ Saved changes to ${relative(Deno.cwd(), targetFile)}`);
    } else {
      console.log(`
🔍 Dry run finished. Run with --fix to apply.`);
    }
  } else {
    console.log("\n✅ No matches found.");
  }
}

/**
 * Parses the mapping file (CSV or TSV).
 */
function parseMapping(content: string, isTsv: boolean): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const lines = content.split("\n");
  
  // Skip header
  let startIndex = 0;
  if (lines[0].toLowerCase().includes("footnote")) startIndex = 1;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    let marker = "";
    let rest = "";

    if (isTsv) {
      const parts = line.split("\t");
      const m = parts[0].match(/(\[\^?\d+\])/);
      if (m) marker = m[1];
      rest = parts.slice(1).join("\t");
    } else {
      // CSV Logic
      if (line.startsWith('"')) {
        const endQuoteIndex = line.indexOf('",');
        if (endQuoteIndex !== -1) {
          const firstCol = line.substring(1, endQuoteIndex);
          const m = firstCol.match(/(\[\^?\d+\])/);
          if (m) marker = m[1];
          rest = line.substring(endQuoteIndex + 1);
        }
      } else {
        const parts = line.split(",");
        const m = parts[0].match(/(\[\^?\d+\])/);
        if (m) marker = m[1];
        rest = parts.slice(1).join(",");
      }
    }

    if (marker) {
      // Extract keys like @key1
      const keys = rest.match(/@([a-zA-Z0-9_\-:]+)/g) || [];
      if (keys.length > 0) {
        map.set(marker, keys);
      }
    }
  }
  return map;
}
