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
 * 
 *   This is a post-render utility that organizes the output, making it easy 
 *   to find, review, and commit the final reports.
 */

// --- CLI OPTIONS ---
const args = Deno.args;
const dryRun = args.includes("--dry-run");

if (dryRun) {
  console.log("🔍 Dry-run mode: no files will be linked.\n");
}

// --- PATH DEFINITIONS ---
// We use hardcoded paths relative to the project root for simplicity.
const PROJECT_ROOT = Deno.cwd();
const OUTPUTS_DIR = `${PROJECT_ROOT}/outputs`;
const REPORTS_DIR = `${PROJECT_ROOT}/reports`;

// Ensure the destination directory exists before attempting to link files.
try {
  Deno.mkdirSync(OUTPUTS_DIR, { recursive: true });
} catch (_) {
  // Directory likely already exists, which is expected.
}

// --- DIRECTORY WALKER ---
/**
 * Synchronously walks a directory tree and returns a list of all files found.
 * This implementation is self-contained and avoids external dependencies.
 */
function walkDirSync(dir: string): string[] {
  const files: string[] = [];

  for (const entry of Deno.readDirSync(dir)) {
    const fullPath = `${dir}/${entry.name}`;

    if (entry.isDirectory) {
      files.push(...walkDirSync(fullPath));
    } else if (entry.isFile) {
      files.push(fullPath);
    }
  }

  return files;
}

// --- MAIN EXECUTION ---
console.log("🔍 Harvesting PDFs and GitHub-format Markdown from country folders...\n");

const allFiles = walkDirSync(REPORTS_DIR);

for (const filePath of allFiles) {
  const lowerPath = filePath.toLowerCase();
  // We care about PDF and GitHub-format Markdown files.
  if (!lowerPath.endsWith(".pdf") && !lowerPath.endsWith(".github.md")) continue;
  
  // Safety: Avoid harvesting files already inside the output directory.
  if (filePath.includes("/outputs/")) continue;

  // Extract the filename (e.g., "report-lk.pdf") from the full path.
  const filename = filePath.substring(filePath.lastIndexOf("/") + 1);
  const dest = `${OUTPUTS_DIR}/${filename}`;

  if (dryRun) {
    console.log(`   ⚠️  Dry-run: Would hard-link "${filename}"`);
    continue;
  }

  // To ensure the link is fresh, we remove any existing file at the destination.
  try {
    Deno.removeSync(dest);
  } catch (_) {
    // If the file doesn't exist, removeSync throws, which we safely ignore.
  }

  // Create a hard-link. This is efficient as it doesn't duplicate data on disk.
  try {
    Deno.linkSync(filePath, dest);
    console.log(`   ✅ Hard-linked "${filename}"`);
  } catch (err) {
    console.error(`   ❌ Failed to link "${filename}":`, err);
  }
}

console.log("\n✨ Done. Files in outputs/ are ready for Git.");
if (dryRun) {
  console.log("✨ (Dry-run completed; nothing was changed.)");
}
