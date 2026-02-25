/**
 * MANAGE CITATIONS
 * ================
 * 
 * Usage:
 *   quarto run _scripts/manage_citations.ts [options]
 * 
 * Options:
 *   --list-failing      Generate list of failing citekeys (Used but not in Bib).
 *   --list-used         Generate list of all citekeys used in .qmd files.
 *   --list-available    Generate list of valid citekeys from d4dasia-bib.json.
 *   --list-collisions   Check for potential duplicate/variant keys.
 *   --list-citations-in-footnotes  Audit citations inside footnotes.
 *   --list-all-footnotes           Dump text of all footnotes.
 *   (No arguments)      Runs --list-available, --list-used, --list-failing, and --list-collisions.
 * 
 * Outputs (in _references/):
 *   citekeys-reports-used.txt
 *   citekeys-reports-failing.txt
 *   citekeys-reports-potential-collisions.txt
 *   citekeys-bib-valid.txt
 */

import { walk } from "stdlib/fs";
import { join, dirname, fromFileUrl, relative } from "stdlib/path";
import { parse } from "stdlib/flags";

// --- CONFIGURATION ---
const scriptDir = dirname(fromFileUrl(import.meta.url));
const projectRoot = join(scriptDir, "..");
const reportsDir = join(projectRoot, "reports");
const bibDir = join(projectRoot, "_references");

const PATHS = {
  BIB_JSON: join(bibDir, "d4dasia-bib.json"),
  OUT_VALID: join(bibDir, "citekeys-bib-valid.txt"),
  OUT_USED: join(bibDir, "citekeys-reports-used.txt"),
  OUT_FAILING: join(bibDir, "citekeys-reports-failing.txt"),
  OUT_COLLISIONS: join(bibDir, "citekeys-reports-potential-collisions.txt"),
  LUA: {
    KEYS: join(scriptDir, "manage_citations.keys.lua"),
    FOOTNOTES: join(scriptDir, "manage_citations.footnotes.lua"),
    ALL_FOOTNOTES: join(scriptDir, "manage_citations.all_footnotes.lua"),
  }
};

// --- ARGS ---
const args = parse(Deno.args, {
  boolean: [
    "list-failing", 
    "list-used", 
    "list-available", 
    "list-collisions",
    "list-citations-in-footnotes",
    "list-all-footnotes",
    "sync-manual"
  ],
});

// Default mode: Run the full list generation pipeline if no specific list flags are set
const isDefaultMode = !args["list-failing"] && 
                      !args["list-used"] && 
                      !args["list-available"] && 
                      !args["list-collisions"] && 
                      !args["list-citations-in-footnotes"] && 
                      !args["list-all-footnotes"] &&
                      !args["sync-manual"];

// --- MAIN ---

if (import.meta.main) {
  console.log("=".repeat(60));
  console.log("📚 CITATION MANAGER");
  console.log("=".repeat(60));

  if (isDefaultMode) {
    console.log("ℹ️  Running full list generation pipeline (default mode)...");
    console.log("   To fix citation syntax errors, use: quarto run _scripts/lint_and_fix_citations.ts --fix");
  }

  // 1. Sync Manual Overrides from TSV
  if (args["sync-manual"]) {
    await syncManualOverrides();
  }

  // 2. List Available (Bibliography)
  if (isDefaultMode || args["list-available"]) {
    await generateValidList();
  }

  // 2. List Used (Reports)
  if (isDefaultMode || args["list-used"] || args["list-failing"]) {
    // Note: 'failing' depends on 'used' being fresh, so we run it if failing is requested
    await generateUsedList();
  }

  // 3. List Failing (Diff)
  if (isDefaultMode || args["list-failing"]) {
    await generateFailingList();
  }

  // 4. List Collisions
  if (isDefaultMode || args["list-collisions"]) {
    await checkCollisions();
  }

  // 5. Footnote Audits (Optional, not part of default pipeline)
  if (args["list-citations-in-footnotes"]) {
    await auditFootnotes("citations");
  }
  if (args["list-all-footnotes"]) {
    await auditFootnotes("all");
  }
}

// --- CORE FUNCTIONS ---

/**
 * Synchronizes manual overrides from true-positives.tsv to citekeys-manual-true-positives.txt
 * Automatically cleans illegal quoting.
 */
async function syncManualOverrides() {
  console.log("\n🔄 Synchronizing Manual Overrides from TSV...");
  const tsvPath = join(bibDir, "true-positives.tsv");
  const outPath = join(bibDir, "citekeys-manual-true-positives.txt");

  try {
    let tsvContent = await Deno.readTextFile(tsvPath);
    
    // 1. Clean illegal quoting (replace " with ')
    if (tsvContent.includes('"')) {
      console.log("   🧹 Cleaning illegal quoting in TSV...");
      tsvContent = tsvContent.replace(/"/g, "'");
      await Deno.writeTextFile(tsvPath, tsvContent);
    }

    // 2. Extract verified pairs (no comment)
    const lines = tsvContent.split("\n");
    const verifiedPairs: string[] = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith("#")) continue;

        const parts = line.split("\t");
        if (parts.length >= 2 && parts[0] !== "" && parts[1] !== "") {
            const comment = parts[2] ? parts[2].trim() : "";
            if (comment === "") {
                verifiedPairs.push(`${parts[0].trim()}|${parts[1].trim()}`);
            }
        }
    }

    const header = `# MANUAL TRUE POSITIVE CITATION MATCHES
# Format: failing_key|correct_valid_key
# These pairs will be explicitly ACCEPTED by the resolution script.
# Use this to force a specific match even if the score is low or ambiguous.
\n`;

    await Deno.writeTextFile(outPath, header + verifiedPairs.sort().join("\n") + "\n");
    console.log(`   ✅ Synced ${verifiedPairs.length} verified pairs to manual overrides.`);
    console.log(`   📝 Wrote to: ${relativePath(outPath)}`);
  } catch (e) {
    console.error(`   ❌ Failed to sync: ${e.message}`);
  }
}

/**
 * Reads d4dasia-bib.json and writes citekeys-bib-valid.txt
 */
async function generateValidList() {
  console.log("\n🔍 Listing Available Keys (Bibliography)...");
  try {
    const content = await Deno.readTextFile(PATHS.BIB_JSON);
    const data = JSON.parse(content);
    if (!Array.isArray(data)) throw new Error("Bibliography JSON is not an array");

    const keys = data
      .map((item: any) => item.id)
      .filter((k: any) => typeof k === 'string')
      .sort();

    await Deno.writeTextFile(PATHS.OUT_VALID, keys.join("\n"));
    console.log(`   ✅ Found ${keys.length} valid keys.`);
    console.log(`   📝 Wrote to: ${relativePath(PATHS.OUT_VALID)}`);
  } catch (e) {
    console.error(`   ❌ Failed: ${e.message}`);
  }
}

/**
 * Scans .qmd files using Lua filter and writes citekeys-reports-used.txt
 * Sorted by the report file in which each key is first found.
 */
async function generateUsedList() {
  console.log("\n🔍 Listing Used Keys (Reports)...");
  const seenKeys = new Set<string>();
  const outputLines: string[] = [];
  let fileCount = 0;

  // Collect and sort files alphabetically to ensure stable report order
  const files: string[] = [];
  for await (const entry of walk(reportsDir, { exts: [".qmd"] })) {
    // Skip files or directories starting with "_"
    if (entry.path.includes("/_")) {
      continue;
    }
    if (entry.isFile) {
      files.push(entry.path);
    }
  }
  files.sort();

  for (const filePath of files) {
    fileCount++;
    const keys = await runLuaFilter(filePath, PATHS.LUA.KEYS);
    const newKeysInFile: string[] = [];
    
    keys.forEach(k => {
      // Filter output format "[CITE] filename: @key" -> "key"
      if (k.startsWith("[CITE]")) {
        const parts = k.split("@");
        if (parts.length > 1) {
          const key = parts[1].trim();
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            newKeysInFile.push(key);
          }
        }
      }
    });

    if (newKeysInFile.length > 0) {
      outputLines.push(`# ${relativePath(filePath)}`);
      newKeysInFile.forEach(k => outputLines.push(k));
      outputLines.push(""); // Add empty line between reports
    }
  }

  await Deno.writeTextFile(PATHS.OUT_USED, outputLines.join("\n").trim() + "\n");
  console.log(`   ✅ Scanned ${fileCount} files.`);
  console.log(`   ✅ Found ${seenKeys.size} unique used keys.`);
  console.log(`   📝 Wrote to: ${relativePath(PATHS.OUT_USED)}`);
}

/**
 * Compares Used vs Valid lists and writes citekeys-reports-failing.txt
 * Preserves the report-based grouping and order.
 */
async function generateFailingList() {
  console.log("\n🔍 Listing Failing Keys...");
  try {
    const validRaw = await Deno.readTextFile(PATHS.OUT_VALID);
    const usedRaw = await Deno.readTextFile(PATHS.OUT_USED);

    const valid = new Set(validRaw.split("\n").map(k => k.trim()).filter(k => k !== "" && !k.startsWith("#")));
    const usedLines = usedRaw.split("\n").map(k => k.trim()).filter(Boolean);

    const failingLines: string[] = [];
    let currentHeader: string | null = null;
    let headerAdded = false;
    let failingCount = 0;

    for (const line of usedLines) {
      if (line.startsWith("#")) {
        currentHeader = line;
        headerAdded = false;
        continue;
      }
      // Skip common Quarto cross-references (fig-, tbl-, eq-)
      if (line.startsWith("fig-") || line.startsWith("tbl-") || line.startsWith("eq-")) {
        continue;
      }
      if (!valid.has(line)) {
        if (currentHeader && !headerAdded) {
          if (failingLines.length > 0) failingLines.push(""); // Spacer between reports
          failingLines.push(currentHeader);
          headerAdded = true;
        }
        failingLines.push(line);
        failingCount++;
      }
    }

    await Deno.writeTextFile(PATHS.OUT_FAILING, failingLines.join("\n").trim() + "\n");
    
    if (failingCount > 0) {
      console.log(`   ⚠️  Found ${failingCount} failing keys.`);
    } else {
      console.log(`   ✅ No failing keys found.`);
    }
    console.log(`   📝 Wrote to: ${relativePath(PATHS.OUT_FAILING)}`);

  } catch (e) {
    console.error(`   ❌ Error: Could not read generated lists. Run --list-available and --list-used first.`);
  }
}

/**
 * Checks for potential collisions (e.g. Author2023 vs Author2023a)
 * Checks the FAILING list to help debug typos.
 */
async function checkCollisions() {
  console.log("\n🔍 Listing Potential Collisions (in Failing Keys)...");
  try {
    const content = await Deno.readTextFile(PATHS.OUT_FAILING);
    const keys = content.split("\n").map(k => k.trim()).filter(k => k !== "" && !k.startsWith("#"));
    const keySet = new Set(keys);
    const groups = new Map<string, string[]>();

    for (const key of keys) {
      const m = key.match(/^(.+?)([a-z])$/);
      if (!m) continue;
      const base = m[1];
      const suffix = m[2];
      if (keySet.has(base)) {
        if (!groups.has(base)) groups.set(base, []);
        groups.get(base)!.push(suffix);
      }
    }

    const collisionReport: string[] = [];
    if (groups.size === 0) {
      console.log("   ✅ No collisions found among failing keys.");
    } else {
      console.log("   ⚠️  Potential collisions detected:");
      for (const [base, suffixes] of groups.entries()) {
        const variants = [base, ...suffixes.map(s => base + s)];
        const msg = `• Base key: ${base}\n  Variants: ${variants.join(", ")}`;
        console.log(msg.replace(/\n/g, "\n      "));
        collisionReport.push(msg);
      }
    }
    await Deno.writeTextFile(PATHS.OUT_COLLISIONS, collisionReport.join("\n\n"));
    console.log(`   📝 Wrote to: ${relativePath(PATHS.OUT_COLLISIONS)}`);

  } catch (e) {
    // Ignore if file missing
  }
}

/**
 * Audits footnotes using specific Lua filters
 */
async function auditFootnotes(mode: "citations" | "all") {
  const filter = mode === "citations" ? PATHS.LUA.FOOTNOTES : PATHS.LUA.ALL_FOOTNOTES;
  console.log(`\n🔍 Footnote Audit: ${mode === "citations" ? "Citations in Footnotes" : "All Footnote Content"}...`);
  
  for await (const entry of walk(reportsDir, { exts: [".qmd"] })) {
    if (entry.isFile && !entry.name.startsWith("_")) {
      const lines = await runLuaFilter(entry.path, filter);
      if (lines.length > 0) {
        lines.forEach(l => console.log(l));
      }
    }
  }
}

// --- HELPERS ---

async function runLuaFilter(file: string, filterPath: string): Promise<string[]> {
  try {
    const cmd = new Deno.Command("quarto", {
      args: ["pandoc", file, "--from", "markdown", "--lua-filter", filterPath, "--to", "native"],
      stdout: "null",
      stderr: "piped",
    });
    const { stderr } = await cmd.output();
    const output = new TextDecoder().decode(stderr).trim();
    return output ? output.split("\n") : [];
  } catch (e) {
    console.error(`Error running filter on ${file}: ${e.message}`);
    return [];
  }
}

function relativePath(path: string) {
  return relative(projectRoot, path);
}
