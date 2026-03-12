/**
 * COLLECT REPORT OUTPUTS
 * ======================
 * 
 * Usage:
 *   quarto run _scripts/collect_outputs.ts
 *   quarto run _scripts/collect_outputs.ts -- --dry-run
 * 
 * Description:
 *   This script scans the project's 'reports/' directory for generated files 
 *   (PDFs and GitHub-format Markdown) and creates hard-links to them in a 
 *   central 'outputs/' folder.
 */

import { join, basename, dirname, resolve } from "https://deno.land/std/path/mod.ts";

// --- CLI OPTIONS ---
const args = Deno.args;
const dryRun = args.includes("--dry-run");

if (dryRun) {
  console.log("🔍 Dry-run mode: no files will be linked.\n");
}

// --- PATH DEFINITIONS ---
const PROJECT_ROOT = Deno.cwd();
const OUTPUTS_DIR = resolve(PROJECT_ROOT, "outputs");
const REPORTS_DIR = resolve(PROJECT_ROOT, "reports");

// Ensure the destination directory exists
try {
  await Deno.mkdir(OUTPUTS_DIR, { recursive: true });
} catch (err) {
  if (!(err instanceof Deno.errors.AlreadyExists)) {
    console.error(`   ❌ Failed to create outputs directory: ${err.message}`);
    Deno.exit(1);
  }
}

// --- DIRECTORY WALKER ---
async function walkDir(dir: string): Promise<string[]> {
  const files: string[] = [];
  try {
    for await (const entry of Deno.readDir(dir)) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory) {
        files.push(...(await walkDir(fullPath)));
      } else if (entry.isFile) {
        files.push(fullPath);
      }
    }
  } catch (err) {
    console.error(`   ⚠️  Error reading directory ${dir}: ${err.message}`);
  }
  return files;
}

// --- MAIN EXECUTION ---
console.log("🔍 Harvesting PDFs and GitHub-format Markdown from country folders...\n");

const allFiles = await walkDir(REPORTS_DIR);

for (const filePath of allFiles) {
  const lowerPath = filePath.toLowerCase();
  if (!lowerPath.endsWith(".pdf") && !lowerPath.endsWith(".github.md")) continue;
  
  // Safety: Avoid harvesting files already inside the output directory.
  if (filePath.includes("/outputs/")) continue;

  // HARDENING: Extract and validate the filename
  const filename = basename(filePath);
  const dest = join(OUTPUTS_DIR, filename);

  // SECURITY: Path Traversal Validation
  // Ensure the destination is actually inside the outputs directory
  const resolvedDest = resolve(dest);
  if (!resolvedDest.startsWith(OUTPUTS_DIR)) {
    console.error(`   ❌ Security: Potential path traversal attempt blocked: ${filename}`);
    continue;
  }

  if (dryRun) {
    console.log(`   ⚠️  Dry-run: Would hard-link "${filename}"`);
    continue;
  }

  // To ensure the link is fresh, we remove any existing file at the destination.
  try {
    await Deno.remove(dest);
  } catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) {
      console.warn(`   ⚠️  Could not remove existing file ${filename}: ${err.message}`);
    }
  }

  // Create a hard-link.
  try {
    await Deno.link(filePath, dest);
    console.log(`   ✅ Hard-linked "${filename}"`);
  } catch (err) {
    console.error(`   ❌ Failed to link "${filename}": ${err.message}`);
  }
}

console.log("\n✨ Done. Files in outputs/ are ready for Git.");
if (dryRun) {
  console.log("✨ (Dry-run completed; nothing was changed.)");
}
