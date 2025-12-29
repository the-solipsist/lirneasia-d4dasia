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

#### 1. Manage Citations (`manage_citations.ts`)
**Purpose:** The central tool for auditing citation usage, checking the bibliography, and finding errors. It replaces several older scripts.
*   **List Available:** Lists all valid keys in your Zotero export (`d4dasia-bib.json`).
*   **List Used:** Lists every citation key actually used in your reports.
*   **List Failing:** Compares the above two lists to find keys you used that don't exist in the bibliography (broken links).
*   **List Collisions:** Checks for potential duplicates like `Author2023` vs `Author2023a`.
*   **Footnote Audit:** Checks for citations buried inside footnotes (which breaks formatting).
*   **Usage:**
    *   `quarto run _scripts/manage_citations.ts` (Runs all standard audits)
    *   `quarto run _scripts/manage_citations.ts --list-failing` (Find broken keys)
    *   `quarto run _scripts/manage_citations.ts --list-citations-in-footnotes` (Find hidden citations)

#### 2. Fix Citations & Footnotes (`lint_and_fix_citations.ts`)
**Purpose:** Cleans up citation grammar to follow the correct [Pandoc Citation Syntax](https://pandoc.org/MANUAL.html#citation-syntax).
*   **Merges Citations:** Converts adjacent brackets like `[@Author1][@Author2]` into a single citation group `[@Author1; @Author2]`.
*   **Restores Links:** Automatically finds "naked" keys like `[Smith2020]` and adds the required `@` symbol (`[@Smith2020]`).
*   **Syntax Cleanup:** Removes backslashes (like `\[@cite\]`) that often appear after importing text.
*   **Usage:** Run with `--fix` to automatically repair these issues.

#### 3. Resolve Typos & Structural Errors (`resolve_citations.ts`)
**Purpose:** Fixes broken links caused by typos or changes in the Zotero database using both fuzzy logic and structural matching.
*   **Structural Matching:** Resolves complex mismatches like:
    *   **Enrichment:** `[DigitalGovernmentStrategy]` → `[@smithDigitalGovernment2021]`
    *   **Normalization:** `[InformationTechnologyPolicy]` → `[@InformationTechnology2000]`
    *   **Draft to Final:** `[OnlineSafetyBillDraft]` → `[@OnlineSafetyAct2024]`
*   **Interactive Fix:** Shows you the error in context and asks to confirm the fix.
*   **Usage:** Run with `--fix` for an interactive step-by-step walkthrough.

---

### 🧹 Formatting & Cleanup

#### 4. Standardize Headings (`lint_and_fix_headings.ts`)
**Purpose:** Clean up artifacts left over from the conversion from Microsoft Word to Markdown.
*   **Strips Bold:** Removes `**` markers from headings (handled by Typst template).
*   **Removes Manual Numbers:** Deletes hardcoded numbers like `1.1 Introduction` (handled by Quarto).
*   **Usage:** Run with `--fix` to standardize formatting.

#### 5. Check & Clean Attributes (`manage_element_attributes.ts`)
**Purpose:** Ensures accessibility and removes technical clutter.
*   **Check Mode (Default):** Scans for problems like missing **Alt Text** on images or broken code markers (`{.mark}`).
*   **Fix Mode (`--fix`):** Deletes unwanted technical codes (like `{.underline}`, `width="100%"`) that don't belong in the final report.
*   **Usage:** Run with `--fix` to strip away the technical clutter.

---

### 📂 Utilities

#### 6. Organize Report PDFs (`collect_report_pdfs.ts`)
**Purpose:** A utility to organize the output.
*   **Harvesting:** Scans all the country folders and creates a hard-link to every generated PDF in a single central folder: `pdfs/`.
*   **Usage:** `quarto run _scripts/collect_report_pdfs.ts`
