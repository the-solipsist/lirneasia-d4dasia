# Automation Scripts Guide

This folder contains tools to help automate the formatting and checking of the D4D Asia reports. These scripts help ensure that the final PDF outputs are professional, consistent, and accessible.

## How to Run a Script
All scripts are run using the terminal command:
```bash
quarto run _scripts/<script_name>.ts
```
Most scripts have a **"Fix Mode"** that applies changes automatically. To use it, add `--fix` to the command:
```bash
quarto run _scripts/<script_name>.ts --fix
```

---

## 🛠️ The Scripts

### 📚 Citation & Bibliography Management

#### 1. Fix Citations & Footnotes (`lint_and_fix_citations.ts`)
**Purpose:** Cleans up citation grammar to follow the correct [Pandoc Citation Syntax](https://pandoc.org/MANUAL.html#citation-syntax).
*   **Merges Citations:** Converts adjacent brackets like `[@Author1][@Author2]` into a single citation group `[@Author1; @Author2]`. This is required for Pandoc to render them as a single note.
*   **Restores Links:** Automatically finds "naked" keys like `[Smith2020]` and adds the required `@` symbol (`[@Smith2020]`) so they become active links.
*   **Syntax Cleanup:** Removes backslashes (like `\[@cite\]`) that often appear after importing text from other formats and break the reference system.
*   **Usage:** Run with `--fix` to automatically repair these issues.

#### 2. Check Citation & Footnote Usage (`audit_citation_usage.ts`)
**Purpose:** A diagnostic tool to find "hidden" errors and review content without opening every file.
*   **Check for Hidden Citations (`--footnotes`):** Lists citations buried *inside* footnotes. Since our style renders citations as footnotes, putting a citation inside a footnote creates a "footnote inside a footnote," which breaks formatting. These must be moved to the main text.
*   **Review All Footnote Text (`--all-footnotes`):** Extracts the text of every footnote in the project. Use this to check for consistent punctuation and length across all reports without switching between files.

#### 3. Resolve Typos & Structural Errors (`resolve_citations.ts`)
**Purpose:** Fixes broken links caused by typos or changes in the Zotero database using both fuzzy logic and structural matching.
*   **Structural Matching:** The script understands the structure of our citation keys and can resolve complex mismatches, such as:
    *   **Enrichment:** `[DigitalGovernmentStrategy]` → `[@smithDigitalGovernment2021]` (identifies the correct key by matching title words and adding missing author/year).
    *   **Normalization:** `[InformationTechnologyPolicy]` → `[@InformationTechnology2000]` (maps verbose names to canonical keys).
    *   **Draft to Final:** `[OnlineSafetyBillDraft]` → `[@OnlineSafetyAct2024]` (updates working titles to the final enacted law).
*   **Interactive Fix:** It shows you the specific sentence where the error occurs and asks you to confirm the suggestion.
*   **Usage:** Run with `--fix` for an interactive step-by-step walkthrough.

#### 4. Bibliography Maintenance
*   **`warn_citekey_collisions.ts`**: Identifies references that look like duplicates (e.g., `Author2023` vs `Author2023a`). This helps you find Zotero entries that need to be merged.
*   **`update_citation_lists.ts`**: Run this whenever you update the master Zotero file (`d4dasia-bib.json`). It refreshes the internal "dictionary" of valid keys used by the other scripts.

---

### 🧹 Formatting & Cleanup

#### 5. Standardize Headings (`lint_and_fix_headings.ts`)
**Purpose:** Clean up artifacts left over from the conversion from Microsoft Word to Markdown.
*   **Strips Bold:** Removes `**` markers from headings. In our typesetting system (Typst), heading styles (weight, size) are controlled globally by the template. Manual bolding overrides this and breaks internal document linking.
*   **Removes Manual Numbers:** Deletes hardcoded numbers like `1.1 Introduction`. These are artifacts from Word conversion. Our system numbers headings automatically, so keeping them leads to double-numbering (e.g., "1. 1.1 Introduction").
*   **Usage:** Run with `--fix` to standardize formatting.

#### 6. Check & Clean Attributes (`manage_element_attributes.ts`)
**Purpose:** Ensures accessibility and removes technical clutter.
*   **Check Mode (Default):** Scans the reports for problems, specifically:
    *   **Missing Alt Text:** Warns you if an image is missing a description for screen readers (critical for accessibility).
    *   **Broken Attributes:** Flags text that looks like broken code (e.g., `{.mark}`) that failed to render correctly.
*   **Fix Mode (`--fix`):** Actively deletes unwanted technical codes (like `{.underline}`, `{.mark}`, or `width="100%"`) that don't belong in the final report.
*   **Usage:** Run with `--fix` to strip away the technical clutter.

---

### 📂 Utilities

#### 7. Organize Report PDFs (`collect_report_pdfs.ts`)
**Purpose:** A utility to organize the output.
*   **Harvesting:** Scans all the country folders and creates a hard-link to every generated PDF in a single central folder: `report_pdfs/`. This makes it easy to review and distribute the full set of reports in one place.
