// harvest-pdfs.ts
//
// Fully self-contained, uses NO external imports.
// Works offline and uses only built-in Deno APIs.
//
// Run:
//   quarto run harvest-pdfs.ts
//   quarto run harvest-pdfs.ts -- --dry-run

// ------------------------------------------------------------
// Parse CLI options
// ------------------------------------------------------------
const args = Deno.args;
const dryRun = args.includes("--dry-run");

if (dryRun) {
  console.log("🔍 Dry-run mode: no files will be linked.\n");
}

// ------------------------------------------------------------
// Paths
// ------------------------------------------------------------
const PROJECT_ROOT = Deno.cwd();
const PDFS_DIR = `${PROJECT_ROOT}/report_pdfs`;
const REPORTS_DIR = `${PROJECT_ROOT}/reports`;

// Ensure the output directory exists
try {
  Deno.mkdirSync(PDFS_DIR, { recursive: true });
} catch (_) {}

// ------------------------------------------------------------
// Recursive directory walker (no stdlib needed)
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// Harvest PDFs
// ------------------------------------------------------------
console.log("🔍 Harvesting PDFs from country folders...\n");

const allFiles = walkDirSync(REPORTS_DIR);

for (const filePath of allFiles) {
  if (!filePath.toLowerCase().endsWith(".pdf")) continue;
  if (filePath.includes("/report_pdfs/")) continue;  // avoid harvesting own output

  const filename = filePath.substring(filePath.lastIndexOf("/") + 1);
  const dest = `${PDFS_DIR}/${filename}`;

  if (dryRun) {
    console.log(`   ⚠️  Dry-run: Would hard-link "${filename}"`);
    continue;
  }

  // Remove any existing target file/link
  try {
    Deno.removeSync(dest);
  } catch (_) {
    // it's okay if it doesn't exist
  }

  try {
    Deno.linkSync(filePath, dest);
    console.log(`   ✅ Hard-linked "${filename}"`);
  } catch (err) {
    console.error(`   ❌ Failed to link "${filename}":`, err);
  }
}

console.log("\n✨ Done. PDFs in report_pdfs/ are ready for Git.");
if (dryRun) {
  console.log("✨ (Dry-run completed; nothing was changed.)");
}
