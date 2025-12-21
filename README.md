# Harnessing Data for Democratic Development in South and Southeast Asia

This project is undertaken by [LIRNEasia](https://lirneasia.net) and funded by [IDRC](https://idrc-cdri.ca).

This repository contains the [reports in PDF format](https://github.com/the-solipsist/lirneasia-d4dasia/releases), along with all the files needed to produce the PDF reports.

---

## Table of Contents

  - [Project Structure](#project-structure)
    - [Report PDFs](#report-pdfs)
    - [Directory Layout](#directory-layout)
    - [Country Directory Format](#country-directory-format)
  - [Editing and Contributing](#editing-and-contributing)
    - [Prerequisites \& Setup](#prerequisites--setup)
    - [Get this repository](#get-this-repository)
    - [Making your changes](#making-your-changes)
    - [Testing your changes](#testing-your-changes)
    - [Committing your changes in logical units](#committing-your-changes-in-logical-units)
      - [Optional: committing only specific files](#optional-committing-only-specific-files)
      - [Alternative: Using Jujutsu (jj)](#alternative-using-jujutsu-jj)
    - [Pushing your changes to GitHub](#pushing-your-changes-to-github)
  - [How report PDFs are generated](#how-report-pdfs-are-generated)
    - [Quarto processing](#quarto-processing)
    - [Pandoc processing](#pandoc-processing)
    - [Citation processing](#citation-processing)
    - [PDF typesetting with Typst](#pdf-typesetting-with-typst)
    - [Post-render scripts](#post-render-scripts)
  - [How report PDFs are auto-generated on GitHub](#how-report-pdfs-are-auto-generated-on-github)
    - [Triggering a Github workflow](#triggering-a-github-workflow)
    - [What the GitHub workflow does](#what-the-github-workflow-does)
  - [Licence](#licence)

---

## Project Structure

This project uses [Quarto](https://quarto.org), with [Pandoc](https://pandoc.org) and [Typst](https://typst.app/) to generate PDFs conforming to a common style guide. Content, citations, formatting logic, and outputs are kept distinct. This ensures consistent typesetting, allows content and styling (including citation formatting) to be changed independently, and enables automated generation of consistent and fully-formatted reports.

### Report PDFs

- **Report PDFs:** You can find the latest report PDFs under [Releases](https://github.com/the-solipsist/lirneasia-d4dasia/releases).

### Directory Layout

- **`_quarto.yml`**: Project-level configuration.

- **`bibliography/`**:

  - `d4dasia-bib.json`: Master bibliography (CSL JSON format, generated using BetterBibTex and Zotero).
  - `*.csl`: Citation Style Language files, used to format citations in the appropriate style (such as the CMoS 18th edition).

- **`report_pdfs/`**: The local output directory.  
  **Note:** This folder is ignored by git (`.gitignore`). It is populated only when you run `quarto render` locally.

- **`_scripts/`**: Helper scripts for the build process and maintenance.
  - `link-pdfs.ts`: Post-render script to organize output.
  - `fix_citations.ts`: Utility to normalize citation syntax (replaces `\[@cite\]` with `[@cite]`).

- **`_extensions/lirneasia/`**:

  This directory contains files needed to generate any LIRNEasia report.

  - `_extension.yml`: YAML file that provides Quarto with information about the 'lirneasia' extension.
  - `_brand.yml`:  LIRNEasia house style, including colours and typography.
  - `assets/logos/`: LIRNEasia logos for background watermark and for the title page.
  - Typst template partials for use with Quarto (e.g., `typst-template.typ`, `typst-show.typ`, `page.typ`, etc.)

- **`reports/`**: Source files for individual country reports, the synthesis report, and shared content.

  - Country reports in:  
    `id/` (Indonesia), `in/` (India), `lk/` (Sri Lanka), `np/` (Nepal), `ph/` (Philippines), `pk/` (Pakistan), `th/` (Thailand), `kr/` (South Korea).
  - Synthesis report: `synthesis/`
  - Content common to multiple reports: `common/`

### Country Directory Format

Each country folder (e.g., `reports/lk/`) follows this standard structure:

- **Report Source:** `d4dasia_country-report_{xx}.qmd` (where `{xx}` is the ISO country code).
- **Metadata:** `_metadata.yml` (Country-specific settings).
- **Assets:** `images/` folder containing diagrams and photos (if used).
- **Local Bibliography:** `d4dasia-bib-{xx}.json` (Optional, for citations not included in the master bibliography file).

---


## Editing and Contributing

### Prerequisites & Setup

To replicate this project locally, ensure you have the following installed:

- **[Git](https://git-scm.com/)** (and, optionally [Jujutsu](https://www.jj-vcs.dev/latest/), if you prefer to use `jj` as the front-end for Git, as I do).
- [**Quarto**](https://quarto.org/docs/get-started/).  
  Note: Quarto bundles [`pandoc`](https://pandoc.org/) and [`typst`](https://typst.app/), so there's no need to install them separately unless you're debugging.
 
To edit the Quarto Markdown (`.qmd`) files locally, it is recommended to use a suitable text editor, which can handle bibliography files, etc., like:

- [**VS Code**](https://code.visualstudio.com/).  
  The [Quarto Extension](https://quarto.org/docs/tools/vscode/index.html) is highly recommended if using VS Code.
- [**Zettlr**](https://zettlr.com).  A very capable markdown editor, which some may prefer over VS Code.

To handle the bibliography, it is advisable to use:

- [**Zotero**](https://www.zotero.org/).  A free, easy-to-use tool to help collect, organize, annotate, cite, and share research.
- [**BetterBibTex**](https://retorque.re/zotero-better-bibtex/).  
  This is an add-on for Zotero.  
  Please ensure that the citation key pattern used with BetterBibTex is `auth.lower + shorttitle(2,2) + year`!
  (Note: default is `auth.lower + shorttitle(3,3) + year`.)
- [**D4DAsia Zotero Group Library**](https://www.zotero.org/groups/4962152/d4dasia).  
  You'll need to have a Zotero Web account, and be added to the D4DAsia group library to enable two-way syncing of items with the library.
  While the group library is public, it is read-only unless you're a group member.

### Get this repository

~~~bash
git clone git@github.com:the-solipsist/lirneasia-d4dasia.git d4dasia
cd d4dasia
~~~

After cloning the repository, all work happens directly on your local copy of the **main** branch. The general workflow is:

1. Make your changes  
2. Commit them in logical units  
3. Repeat as needed  
4. Optionally render the project  
5. Push to GitHub  

### Making your changes

Edit the relevant `.qmd` file(s) or the `d4dasia-bib.json` file. Save your work locally in your text editor.

### Testing your changes

You may wish to verify that the document renders correctly before committing your changes:

~~~bash
quarto render
~~~

Or render just the report you edited:

~~~bash
quarto render reports/lk/d4dasia_country-report_lk.qmd
~~~

This helps catch formatting or citation issues early.

### Committing your changes in logical units

A *commit* should represent one coherent set of changes. You may make several commits before pushing.

To commit **all modified files at once**, use:

~~~bash
git commit -a -m "content(lk,pk): Revise introductions for Sri Lanka and Pakistan reports"
~~~

This is the simplest workflow, and usually what you want.

#### Optional: committing only specific files

If you want to commit only some of your edits (not all modified files), you may stage just those files:

~~~bash
git add reports/lk/d4dasia_country-report_lk.qmd
git commit -m "content(lk): Improve introduction section"
~~~

Repeat the edit → commit cycle as many times as needed before you're ready to push the changes to GitHub.

#### Alternative: Using Jujutsu (jj)

If you are using `jj`, the workflow to commit all files is even simpler as there is no staging area:

~~~bash
jj describe -m "content(lk,pk): Revise introductions for Sri Lanka and Pakistan reports"
jj git push
~~~

### Pushing your changes to GitHub

When your commits are ready:

~~~bash
git push origin main
~~~

GitHub will automatically regenerate the PDFs using the workflow described in **[How report PDFs are auto-generated on GitHub](#how-report-pdfs-are-auto-generated-on-github)**.

If you are **not a collaborator**, you must fork the repository and submit your edits through a **pull request** instead of pushing.

---

## How report PDFs are generated

Quarto is the tool that ties everything in this repository together. When you run `quarto render`, Quarto performs a multi-step processing pipeline:

### Quarto processing

- the project configuration (`_quarto.yml`)
- the lirneasia extension (`_extensions/lirneasia/_extension.yml`), which includes all branding and typesetting rules.
- the `.qmd` source files
- report-level metadata (`_metadata.yml`) within each report's folder
- the master bibliography (`bibliography/d4dasia-bib.json`)
- any country-specific bibliography (`reports/xx/d4dasia-bib-xx.json`)
- the citation style file (`bibliography/*.csl`) specified in the project configuration
- downloads the fonts required for the document (as provided in `_extensions/lirneasia/_brand.yml`)

### Pandoc processing

Pandoc converts the `.qmd` files into an intermediate document format (`.typ`) while, e.g., applying:

- block and inline formatting
- cross-referencing
- citation placeholders
- figure/table numbering

### Citation processing

Pandoc's `citeproc` resolves all citations using:

- the master bibliography
- optional country bibliographies
- the selected CSL citation style

This step generates fully formatted footnotes / inline citations, and bibliography entries.

### PDF typesetting with Typst

Typst uses:

- typography rules defined in `_extensions/lirneasia/_brand.yml`
- layout and page structure from `typst-template.typ`, `page.typ`, and related files
- watermarks and logos from `_extensions/lirneasia/assets/`

Typst then produces the final professional-quality PDF.

### Post-render scripts

After each PDF is produced, `_scripts/link-pdfs.ts` hard-links the PDF into `report_pdfs/`

This pipeline ensures that local builds and GitHub builds always produce identical output.

---

## How report PDFs are auto-generated on GitHub

GitHub Actions automatically builds the PDFs whenever relevant files change.

### Triggering a Github workflow

A workflow is defined in `.github/workflows/publish-reports.yml`, which gets auto-triggered whenever content-related files are modified and committed to this repository.

### What the GitHub workflow does

1. Checks out the repository.
2. Installs Quarto in an Ubuntu instance.
3. Renders all PDFs using the same pipeline used locally.
4. Zips the generated PDFs for release.
5. Depending on the trigger, it publishes the results:
   - **Pull Requests:** Creates a "Preview" release and updates the PR with a download link.
   - **Push to `main`:** Creates a "Current Draft" snapshot release tagged with the date and commit hash.
   - **Version Tags (`v*`):** Creates an official stable release with auto-generated changelogs.
6. **Cleanup:** When a Pull Request is closed, its associated preview release and tag are automatically deleted.

This way the PDFs are always kept up-to-date.

---

## Licence

All report contents in this repository are licensed under the [Creative Commons Attribution 4.0 International licence (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/). You are free to share and adapt the material, provided you give appropriate credit to LIRNEasia and the respective authors.

All code contained in this repository is licensed under the [Zero Clause BSD licence (0BSD)](https://opensource.org/license/0bsd).
