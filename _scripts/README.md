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

### 1. Fix Citations & Footnotes (`lint_and_fix_citations.ts`)
**Purpose:** Cleans up the "grammar" of your citations to ensure they render correctly in the bibliography.
*   **Merges Citations:** Combines adjacent brackets like `[@A][@B]` into a single `[@A; @B]` to avoid cluttered footnote numbers.
*   **Restores Links:** Automatically finds "naked" keys like `[Smith2020]` and adds the required `@` symbol so they become active links.
*   **Syntax Cleanup:** Removes backslashes (like `\[@cite]`) that often appear after importing text from other formats and break the reference system.
*   **Usage:** Run with `--fix` to automatically repair these issues across all reports.

### 2. Deep Audit: Citations & Footnotes (`audit_citation_usage.ts`)
**Purpose:** A diagnostic tool to find "hidden" errors that the automated fixer can't safely touch.
*   **Footnote Audit:** Lists every citation that is buried *inside* a footnote. Since citations are rendered as footnotes in this project, putting a citation inside a footnote creates a "footnote inside a footnote," which the system cannot handle.
*   **Review Text:** Displays the full text of all footnotes in one view so you can check for consistent punctuation and paragraph breaks without switching between PDF and Markdown.
*   **Usage:** Use `--footnotes` to find citations that need to be moved to the main text, or `--all-footnotes` for a general content review.

### 3. Resolve Typos in Citations (`resolve_citations.ts`)
**Purpose:** Fixes broken links caused by typos or changes in the Zotero database.
*   **Fuzzy Matching:** If you have a citation like `@Smith202` but the correct key is `@Smith2020`, this script identifies the error and suggests the most likely correction.
*   **Interactive Fix:** It shows you the specific sentence where the error occurs and asks you to confirm the fix before making any changes.
*   **Usage:** Run with `--fix` for an interactive step-by-step walkthrough of all broken references.

### 4. Standardize Headings (`lint_and_fix_headings.ts`)
**Purpose:** Ensures the Table of Contents and report structure are perfectly clean.
*   **Strips Bold:** Removes `**` markers from headings. Headings are styled automatically by the template; adding manual bolding breaks the internal linking.
*   **Removes Manual Numbers:** Deletes hardcoded numbers like `1.1 Introduction`. The report system handles numbering automatically, so manual numbers lead to double-numbering (e.g., "1. 1.1 Introduction").
*   **Usage:** Run with `--fix` to ensure all headings across all reports follow the project's layout rules.

### 5. Cleanup Formatting Attributes (`manage_element_attributes.ts`)
**Purpose:** Strips out "computer junk" and ensures the reports are accessible to everyone.
*   **Remove Clutter:** Deletes technical codes like `{.mark}` or `{.underline}` that are often left over from Microsoft Word imports but don't belong in the final report.
*   **Accessibility Check:** Scans for images that are missing "Alt Text" (descriptions for screen readers). This is a requirement for making our reports accessible to visually impaired readers.
*   **Usage:** Run with `--fix` to strip away the technical clutter.

### 6. Collect Finished Reports (`collect_report_pdfs.ts`)
**Purpose:** A simple utility to organize your results.
*   **Harvesting:** Scans all the different country folders and creates a copy of every finished PDF in a single central folder: `report_pdfs/`. This makes it easy to review the entire set of reports in one place.

### 7. Bibliography Maintenance
*   **`warn_citekey_collisions.ts`**: Identifies references that look like duplicates (e.g., `Author2023` vs `Author2023a`). This helps you find Zotero entries that need to be merged.
*   **`update_citation_lists.ts`**: Run this helper script whenever you update the master Zotero file (`d4dasia-bib.json`). It refreshes the "internal brain" the other scripts use to know which citations are valid.

---
**Note:** Many scripts will output "Manual Flags" or "Audit" items. These are cases where the computer isn't sure what to do and needs a human editor to make a decision.