This issue tracks the comprehensive cleanup and resolution of citations across the D4DAsia reports.

**Primary Goal:** Achieve zero failing citations. Every `@citekey` in the `.qmd` files must resolve to a valid entry in the master bibliography (`d4dasia-bib.json`).
**Secondary Goal:** Ensure bibliography metadata in Zotero complies with CMoS 18th Ed.

---

## 📂 Configuration Files (in `_references/`)

These files control the automated resolution process.

*   **`citekeys-reports-failing.txt`**: A generated list of citation keys currently in the reports that *do not* exist in the bibliography.
*   **`citekeys-bib-valid.txt`**: A generated list of all valid citation keys currently in the bibliography.
*   **`citation-match-scores.txt`**: The output report from the resolution script, showing proposed matches and their confidence scores.
*   **`citekeys-manual-true-positives.txt`**: A manual overrides file. Use this to **force** a specific match that the script might miss or score too low.
    *   *Format:* `failing_key | correct_key`
*   **`citekeys-manual-false-positives.txt`**: A manual overrides file. Use this to **block** a specific wrong match that the script keeps suggesting.
    *   *Format:* `failing_key | wrong_key`

---

## 🚀 Workflow 1: The Resolution Loop (Priority)

Use this workflow to fix failing citations efficiently.

1.  **Analyze:** Run the resolution script to generate a report.
    ```bash
    quarto run _scripts/resolve_citations.ts --output _references/citation-match-scores.txt
    ```
2.  **Review:** Check `_references/citation-match-scores.txt`.
    *   Identify correct matches ("True Positives") and incorrect matches ("False Positives").
3.  **Configure:**
    *   Add incorrect matches to `citekeys-manual-false-positives.txt` to silence them.
    *   Add correct but low-scoring matches to `citekeys-manual-true-positives.txt` to force them.
4.  **Fix:** Run the script in fix mode to update the `.qmd` files automatically.
    ```bash
    quarto run _scripts/resolve_citations.ts -- --fix
    ```
5.  **Ghost Citations:** For keys that still have "No match found":
    *   **Action:** Locate the item in **Zotero** and change its citation key to match the one used in the text. This is often faster than editing the text manually.

---

## 🛠️ Workflow 2: The Quality Loop

Once citations are resolving, improve their quality in Zotero.

1.  **Update Zotero:** Edit titles, dates, and authors in Zotero to be accurate and CMoS-compliant (Sentence case, correct item types).
2.  **Sync:** Allow Zotero to update the citation key (BetterBibTeX) and export the new `d4dasia-bib.json`.
3.  **Re-Resolve:** Because the Zotero keys changed, the keys in the text are now "failing."
    *   Run **Workflow 1** immediately.
    *   The resolution script will detect the new keys (e.g., `OldKey2023` -> `NewKey2023`) and update the `.qmd` files automatically.

---

## 📋 Sub-Issues & Tasks

- [ ] **Resolve Broken Keys** (See #27)
    *   Investigate "variant" keys (e.g., `DeptCensus` vs `DeptCensusStatistics`). Merge duplicates in Zotero where appropriate.
- [ ] **Verify Semantic Correctness** (See #21)
    *   Ensure Zotero metadata follows the project style guide (CMoS 18).
- [ ] **Text & Formatting Cleanup**
    *   [ ] Convert footnotes to citations where appropriate (See #12).
    *   [ ] Convert bracketed text to citations (See #16).
