# Harnessing Data for Democratic Development in South and Southeast Asia

This project is undertaken by [LIRNEasia](https://lirneasia.net) and funded by [IDRC](https://idrc-cdri.ca).

The repository contains the [reports in PDF format](https://github.com/the-solipsist/lirneasia-d4dasia/releases), along with all the files needed to produce the PDF reports.

## Report PDFs

We use GitHub Actions to automatically generate PDFs each time any content is changed.

* **Report PDFs:**: You can find the report PDFs under [Releases](https://github.com/the-solipsist/lirneasia-d4dasia/releases).

* **Test Repo Reports PDFs:** Usually, users won't need to access these, as these are for testing purposes only.  If you still need to access these, 
  go to the **Actions** tab on GitHub. Click on the latest "test" repo workflow run. Scroll down to the **Artifacts** section. Download the `d4dasia_report-pdfs` ZIP file.


## 📂 Project Structure

This project uses [Quarto](https://quarto.org) and [Typst](https://typst.app/). The files are organized to separate content, formatting, and build outputs (i.e., the PDFs).

### Directory Layout

* **`_quarto.yml`**: Project-level configuration.

* **`bibliography/`**:

  * `d4dasia-bib.json`: Master bibliography (CSL JSON format, generated using BetterBibTex and Zotero).

  * `*.csl`: Citation Style Language files, which are used to format citations in the appropriate style (such as the CMoS 18th edition).

* **`reports-pdfs/`**: The local output directory. **Note:** This folder is ignored by git (`.gitignore`). It is populated only when you run `quarto render` locally.

* **`_scripts/`**: Helper scripts for the build process (`link-pdfs.ts`).

* **`_extensions/lirneasia/`**:

  This directory contains files needed to generate any LIRNEasia report.

  * `_extension.yml`: YAML file that provides Quarto with information about the 'lirneasia' extension.

  * `_brand.yml`:  LIRNEasia house style, including colours and typography.

  * `assets/logos/`: LIRNEasia logos for background watermark and for the title page.

  * Typst templates partials, for use with Quarto (e.g., `typst-template.typ`, `typst-show.typ`, etc.)

* **`reports-source/`**: Source files for individual country reports, the synthesis report, and shared content.

  * Country reports in: `id/` (Indonesia), `in/` (India), `lk/` (Sri Lanka), `np/` (Nepal), `ph/` (Philippines), `pk/` (Pakistan), `th/` (Thailand), `kr/` (South Korea).

  * Synthesis report: `synthesis/`

  * Shared content: `common/`

### Country Directory Format

Each country folder (e.g., `country/sl/`) follows this standard structure:

* **Report Source:** `d4dasia_country-report_{xx}.qmd` (where `{xx}` is the country code).

* **Metadata:** `_metadata.yml` (Country-specific settings).

* **Assets:** `images/` folder containing local diagrams and photos. (Optional, if images are used.)

* **Local Bibliography:** `d4dasia-bib-{xx}.json` (Optional, for country-specific citations not included in the master bibliography file).

## 🛠️ Prerequisites & Setup

To replicate this project locally, ensure you have the following installed:

* [**Git**](https://git-scm.com/) (and, optionally [Jujutsu](https://www.jj-vcs.dev/latest/), if you prefer to use `jj` as the front-end for Git).
 
* [**Quarto**](https://quarto.org/docs/get-started/). Note: Quarto bundles [`pandoc`](https://pandoc.org/) and [`typst`](https://typst.app/), so there's no need to install them separately unless you're debugging).
 
To edit the Quarto Markdown (`.qmd`) files locally, it is recommended to use a suitable text editor, which can handle bibliography files, etc., like one of the following:

* [**VS Code**](https://code.visualstudio.com/). The [Quarto Extension](https://quarto.org/docs/tools/vscode/index.html) is recommended if using VS Code.

* [**Zettlr**](https://zettlr.com).

To handle the bibliography, it is advisable to use:

* [**Zotero**](https://www.zotero.org/).

* [**BetterBibTex**]](https://retorque.re/zotero-better-bibtex/).  This is an add-on for Zotero.  
  The citation key pattern used is `auth.lower + shorttitle(2,2) + year`.  (Note: default is `auth.lower + shorttitle(3,3) + year`.

### 1. Clone the Repository

```bash
git clone git@github.com:the-solipsist/lirneasia-d4dasia.git d4dasia
cd d4dasia
```

### 2. Render the Reports

To generate the PDFs locally, run the appropriate `render` command. 

**To render the entire project:**

```bash
quarto render
```

**To render a specific country report (e.g., Sri Lanka):**

```bash
quarto render report/sl/d4dasia_country-report_sl.qmd
```

The PDFs will be placed next to each `.qmd` file. After the PDFs are generated, the PDFs are automatically hard-linked to the `report-pdfs/` folder through a Quarto `post-render` script from `_scripts/`, defined in `_quarto.yml`.


## 📚 Bibliography management

1. Master bibliography (bibliography/d4dasia-bib.json)

The main citation data is stored in the `bibliography/` directory. This file is automatically generated by Zotero (using BetterBibTex CSL JSON export).

> **Warning:** Do not edit the master JSON file manually. If you need to make changes, make the changes in Zotero and export the file to ensure Zotero & d4dasia-bib.json are in sync.

2. Country-specific bibliographies

Some reports currently (and hopefully not for long) require specialized citations not found in the master list. These are stored within the country directory (e.g., country/sl/d4dasia-bib-sl.json) and merged via the country's `_metadata.yml` file.

3. Citation styles

Some citation styles (`*.csl` files) have been placed in this directory.  The appropriate CSL file can be referenced in `_quarto.yml` to automatically generate appropriate citations and a bibliography for each report.

## 🤖 CI/CD (GitHub Actions)

The CI/CD workflow is the following:

  1. Check out main code into `main-repo`.

  2. Install Quarto.

  3. Render PDFs by using Quarto with Typst + Pandoc + Citeproc + bibliography file(s).

  4. If test repo: Collects generated PDFs and uploads them as artifacts to the Action run page as a zip file.

  5. If main repo: Collects generated PDFs as well as a zip file, and creates a tagged release.

## 📄 License

All report contents in this repository are licensed under the [Creative Commons Attribution 4.0 International License (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/). You are free to share and adapt the material, provided you give appropriate credit to LIRNEasia and the respective authors.

All code contained in this repository are licensed under the [Zero Clause BSD licence (0BSD)](https://opensource.org/license/0bsd).
