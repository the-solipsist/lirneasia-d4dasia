/**
 * COMPARE FOOTNOTES
 * =================
 *
 * Usage:
 *   quarto run _scripts/compare_footnotes.ts
 *
 * Description:
 *   Compares footnotes in 'reports/id/footnotes.txt' against 'reports/id/indonesia-mapping-footnotes-to-citekeys.csv'.
 *   Reports which footnotes from the text file are missing in the CSV.
 */

import { parse } from "stdlib/flags";

async function main() {
  const footnotesTxtPath = "reports/id/footnotes.txt";
  const csvPath = "reports/id/indonesia-mapping-footnotes-to-citekeys.csv";

  let footnotesTxt = "";
  let csvContent = "";

  try {
    footnotesTxt = await Deno.readTextFile(footnotesTxtPath);
    csvContent = await Deno.readTextFile(csvPath);
  } catch (e) {
    console.error("Error reading files:", e);
    Deno.exit(1);
  }

  // Debug: Check content starts
  console.log(`Read ${footnotesTxt.length} chars from ${footnotesTxtPath}`);
  
  // Parse footnotes.txt
  const txtFootnotes = parseMarkdownFootnotes(footnotesTxt);
  console.log(`Parsed ${txtFootnotes.length} footnotes from ${footnotesTxtPath}`);

  // Parse CSV
  const csvFootnotes = parseCsvFootnotes(csvContent);
  console.log(`Parsed ${csvFootnotes.length} footnotes from ${csvPath}`);

  // Normalize and create set for CSV
  const csvSet = new Set(csvFootnotes.map(f => normalize(f.content)));

  const missing = [];
  for (const f of txtFootnotes) {
    if (!csvSet.has(normalize(f.content))) {
      missing.push(f);
    }
  }

  console.log(`\nFound ${missing.length} footnotes in ${footnotesTxtPath} that are missing from CSV:`);
  
  let csvOutput = "Footnote,Citation Key 1,Citation Key 2,Citation Key 3,Citation Key 4,Citation Key 5\n";
  
  missing.forEach((m, i) => {
    const snippet = m.content.length > 100 ? m.content.substring(0, 97) + "..." : m.content;
    console.log(`[${m.marker}] ${snippet}`);
    
    // Prepare CSV line
    // Escape double quotes by doubling them
    const escapedContent = m.content.replace(/"/g, '""');
    csvOutput += `"[${m.marker}]: ${escapedContent}",,,,\n`;
  });
  
  const outputPath = "reports/id/missing_footnotes.csv";
  await Deno.writeTextFile(outputPath, csvOutput);
  console.log(`\n✅ Wrote missing footnotes to ${outputPath}`);
}

/**
 * Normalizes text for comparison.
 */
function normalize(text: string): string {
  // Remove all whitespace and non-alphanumeric, lowercase
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

interface Footnote {
  marker: string;
  content: string;
}

function parseMarkdownFootnotes(text: string): Footnote[] {
  const footnotes: Footnote[] = [];
  const lines = text.split(/\r?\n/); // Handle CRLF
  let currentMarker = "";
  let currentContent = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match [^N]: Content
    // Allow leading whitespace
    const match = line.match(/^\s*(\[\^?\d+\]):(.*)/);
    
    if (match) {
      if (currentMarker) {
        footnotes.push({ marker: currentMarker, content: currentContent.trim() });
      }
      currentMarker = match[1];
      currentContent = match[2];
    } else {
      if (currentMarker) {
        // If line is empty, it might be paragraph break, but we append it anyway to capture multi-paragraph footnotes
        // or just append as space
        currentContent += " " + line.trim();
      }
    }
  }
  if (currentMarker) {
    footnotes.push({ marker: currentMarker, content: currentContent.trim() });
  }
  return footnotes;
}

function parseCsvFootnotes(text: string): Footnote[] {
  const footnotes: Footnote[] = [];
  const lines = text.split(/\r?\n/);
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    let content = "";
    
    if (line.startsWith('"')) {
      const match = line.match(/^"((?:[^"]|"")*)"/);
      if (match) {
        content = match[1].replace(/""/g, '"');
      }
    } else {
        content = line.split(",")[0];
    }

    if (!content || content.toLowerCase() === "footnote") continue;

    const markerMatch = content.match(/^(\[\^?\d+\]):(.*)/);
    if (markerMatch) {
       footnotes.push({ marker: markerMatch[1], content: markerMatch[2].trim() });
    } else {
       // Even if no marker match, treat the whole content as the footnote content (minus marker if it was formatted differently)
       // This ensures we have the content for comparison.
       footnotes.push({ marker: "?", content: content.trim() });
    }
  }
  return footnotes;
}

if (import.meta.main) {
    await main();
}