/**
 * COLLECT REPORT PDFS
 * ===================
 * 
 * Usage:
 *   quarto run _scripts/collect_report_pdfs.ts
 *   quarto run _scripts/collect_report_pdfs.ts -- --dry-run
 * 
 * Description:
 *   This script scans the project's 'reports/' directory for generated PDF files 
 *   and creates hard-links to them in a central 'pdfs/' folder.
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
const PDFS_DIR = `${PROJECT_ROOT}/pdfs`;
const REPORTS_DIR = `${PROJECT_ROOT}/reports`;

// Ensure the destination directory exists before attempting to link files.
try {
  Deno.mkdirSync(PDFS_DIR, { recursive: true });
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
console.log("🔍 Harvesting PDFs from country folders...\n");

const allFiles = walkDirSync(REPORTS_DIR);

for (const filePath of allFiles) {
  // We only care about PDF files.
  if (!filePath.toLowerCase().endsWith(".pdf")) continue;
  
  // Safety: Avoid harvesting files already inside the output directory.
  if (filePath.includes("/pdfs/")) continue;

  // Extract the filename (e.g., "report-lk.pdf") from the full path.
  const filename = filePath.substring(filePath.lastIndexOf("/") + 1);
  const dest = `${PDFS_DIR}/${filename}`;

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

console.log("\n✨ Done. PDFs in pdfs/ are ready for Git.");
if (dryRun) {
  console.log("✨ (Dry-run completed; nothing was changed.)");
}
