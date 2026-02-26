/**
 * CONVERT FOOTNOTES TO CITATIONS (Enhanced)
 * ========================================
 *
 * Usage:
 *   quarto run _scripts/convert_footnotes.ts --csv <path/to/map.csv> --target <path/to/file.md> [--fix]
 *
 * Description:
 *   1. Matches footnotes in the document to citekeys/pinpoints in the CSV by their marker (e.g. [^1]).
 *   2. Replaces markers in the body with the provided replacement string.
 *   3. Removes the footnote definitions from the bottom of the document.
 */

import { parse } from "stdlib/flags";
import { join, relative } from "stdlib/path";

const args = parse(Deno.args, {
  boolean: ["fix"],
  string: ["target", "csv"],
  alias: { fix: ["execute", "e"] },
});

const isFixMode = args.fix;

if (import.meta.main) {
  if (!args.csv || !args.target) {
    console.log("Usage: quarto run _scripts/convert_footnotes.ts --csv <path> --target <path> [--fix]");
    Deno.exit(1);
  }

  const csvPath = join(Deno.cwd(), args.csv);
  const targetFile = join(Deno.cwd(), args.target);

  await run(csvPath, targetFile);
}

async function run(csvPath: string, targetFile: string) {
  let csvContent = "";
  try {
    csvContent = await Deno.readTextFile(csvPath);
  } catch (e) {
    console.error(`❌ Error reading mapping file: ${e.message}`);
    Deno.exit(1);
  }

  const mapping = parseMapping(csvContent);
  console.log(`   ✅ Loaded ${mapping.size} potential replacements.`);

  let fileContent = "";
  try {
    fileContent = await Deno.readTextFile(targetFile);
  } catch (e) {
    console.error(`❌ Error reading target file: ${e.message}`);
    Deno.exit(1);
  }

  const sortedMarkers = Array.from(mapping.keys()).sort((a, b) => b.length - a.length);
  
  let newContent = fileContent;
  const changes = [];

  for (const marker of sortedMarkers) {
    const replacement = mapping.get(marker)!;
    if (!replacement) continue;

    const escapedMarker = marker.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const bodyRegex = new RegExp(`${escapedMarker}(?!:)`, "g");
    
    if (bodyRegex.test(newContent)) {
      const count = (newContent.match(bodyRegex) || []).length;
      newContent = newContent.replace(bodyRegex, replacement);
      changes.push(`   Replaced ${marker} -> ${replacement} (${count}x)`);
    }
  }

  // Remove Footnote Definitions
  const lines = newContent.split("\n");
  const filteredLines = [];
  let skipping = false;

  for (const line of lines) {
    const defMatch = line.match(/^(\[\^?\d+\]):/);
    if (defMatch) {
      const marker = defMatch[1];
      if (mapping.has(marker) && mapping.get(marker) !== "") {
        skipping = true;
        changes.push(`   Removing definition for ${marker}`);
        continue;
      } else {
        skipping = false;
      }
    } else if (skipping) {
      if (line.startsWith(" ") || line.startsWith("\t") || line.trim() === "") {
        continue;
      } else {
        skipping = false;
      }
    }
    filteredLines.push(line);
  }

  if (changes.length > 0) {
    console.log(`\nFound ${changes.length} actions.`);
    if (isFixMode) {
      await Deno.writeTextFile(targetFile, filteredLines.join("\n"));
      console.log(`✅ Saved changes to ${targetFile}`);
    } else {
      console.log(`🔍 Dry run finished. Run with --fix to apply.`);
    }
  } else {
    console.log("\n✅ No matches found.");
  }
}

function parseMapping(content: string): Map<string, string> {
  const map = new Map<string, string>();
  const lines = content.split("\n");
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple CSV parser for quoted fields
    const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
    if (parts.length < 2) continue;

    const marker = parts[0].replace(/"/g, "");
    const key = parts[1].replace(/"/g, "");
    const pinpoint = parts[2] ? parts[2].replace(/"/g, "") : "";
    
    if (key.startsWith("@")) {
        const citation = pinpoint ? `[${key}, ${pinpoint}]` : `[${key}]`;
        map.set(marker, citation);
    }
  }
  return map;
}
