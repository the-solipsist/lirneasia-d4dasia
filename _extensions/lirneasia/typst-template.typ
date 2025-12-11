// ─────────────────────────────────────────────────────────────────────────────
// LIRNEasia Report Template for Typst
// Cleaned & Documented Version
//
// This template enforces specific branding guidelines regarding:
// 1. Typography (Aptos for body, Montserrat for headers).
// 2. Visual Hierarchy (Specific spacing for headings).
// 3. Branding (First page vs. subsequent page backgrounds).
// ─────────────────────────────────────────────────────────────────────────────

#let article(
  // ── Meta Information ──
  title: none,
  subtitle: none,
  authors: none,
  date: none,
  abstract: none,
  abstract-title: none,
  
  // ── Layout & Language ──
  cols: 1,
  lang: "en",
  region: "US",
  
  // ── Fonts & Sizes ──
  font: "Aptos",
  fontsize: 12pt,
  title-size: 28pt,
  subtitle-size: 20pt,
  
  // ── Headings ──
  heading-family: "Montserrat",
  heading-weight: "bold",
  heading-style: "normal",
  heading-color: black,
  heading-line-height: 0.65em, 
  sectionnumbering: "1.1", // Default pattern
  number-depth: 3,
  
  // ── TOC / LOF / LOT ──
  toc: true,
  toc_title: "Table of contents",
  toc_depth: 3,
  toc_indent: 1.5em,
  lof_title: "List of figures",
  lot_title: "List of tables",

  // ── Component Styling ──
  footnote_color: black,
  
  doc,
) = {

  // ───────────────────────────────────────────────────────────────────────────
  // CONFIGURATION CONSTANTS
  // ───────────────────────────────────────────────────────────────────────────
  
  // [STYLE] Vertical Spacing & Sizing
  // The title page requires specific vertical whitespace to align with the
  // background SVG elements.
  let title-vspace    = 6.3cm
  let author-size     = 16pt
  let date-size       = 12pt

  // [STYLE] Heading Hierarchy & Spacing
  // Heading sizes are strictly defined to create a clear visual hierarchy.
  // Headings must have asymmetric spacing (more above, less below).
  let h1-size         = 20pt
  let h2-size         = 18pt
  let h3-size         = 14pt
  let h4-size         = 12pt
  let heading-sizes   = (h1-size, h2-size, h3-size, h4-size)

  let h1-spacing      = (above: 18pt, below: 10pt)
  let h2-spacing      = (above: 10pt, below: 6pt)
  let h3-spacing      = (above: 8pt, below: 4pt)
  let heading-spacing = (h1-spacing, h2-spacing, h3-spacing)

  // [STYLE] Component Measurements
  // Centralized values for fine-tuning visual density.
  let table-inset     = 6pt
  let footnote-gap    = 1em
  let leading-base    = 1.15em
  let leading-offset  = 0.60em
  let par-spacing     = 0.65em

  // [STYLE] Unnumbered Sections
  // Specific sections (TOC, references, annexes) must remain unnumbered 
  // to distinguish them from the core narrative flow.
  let unnumbered-labels = (
    <list-of-abbreviations>,
    <abbreviations>,
    <about-this-report>,
    <about-lirneasia>,
    <funding>,
    <references>,
    <annexure>
  )

  // ───────────────────────────────────────────────────────────────────────────
  // GLOBAL TYPOGRAPHY
  // ───────────────────────────────────────────────────────────────────────────

  // [STYLE] Core Font Settings
  // The document must use the brand font to ensure
  // consistency with other corporate documents.
  set text(
    lang: lang,
    region: region,
    font: font,
    size: fontsize,
    // fallback: false
  )

  // [STYLE] Line Spacing (Leading)
  // Standard single spacing is too tight for reports. 
  // We use a calculated leading value (approx 1.15 lines) to improve 
  // readability for dense blocks of text.
  let calculated-leading = leading-base - leading-offset
  set par(
    leading: calculated-leading,
    spacing: calculated-leading + par-spacing,
    justify: false // [STYLE] Left-aligned text is preferred over justified for accessibility
  )

  // ───────────────────────────────────────────────────────────────────────────
  // PAGE LAYOUT & BRANDING
  // ───────────────────────────────────────────────────────────────────────────

  // [STYLE] Background Branding
  // The first page features the full corporate branding and logo.
  // Subsequent pages use a subtle watermark corner element to maintain identity
  // without distracting from the content.
  set page(
    background: context {
      if here().page() == 1 {
        // Front Cover Logic
        place(dx: -1.82cm, dy: -0.93cm)[
          #image("logos/la-background-first.svg", width: 14.01cm, height: 11.35cm)
        ]
        place(dx: 12.93cm, dy: 1.64cm)[
          #image("logos/la-logo-full.png", width: 6.74cm, height: 2.03cm)
        ]
      } else {
        // Continuation Page Logic
        place(dx: -2.22cm, dy: -3.26cm)[
          #image("logos/la-background.svg", width: 9.55cm, height: 7.73cm)
        ]
      }
    }
  )

  // ───────────────────────────────────────────────────────────────────────────
  // HEADINGS & STRUCTURE
  // ───────────────────────────────────────────────────────────────────────────

  // [STYLE] Heading Numbering Logic
  // Sections are numbered (e.g. 1.1) but specific functional sections
  // (defined in unnumbered-labels) must be stripped of numbering.
  set heading(numbering: sectionnumbering)
  
  let unnumbered-headings = (
    unnumbered-labels
      .map(label => heading.where(label: label))
      .fold(none, (acc, sel) => if acc == none { sel } else { acc.or(sel) })
  )
  show unnumbered-headings: set heading(numbering: none)
  
  show heading.where(label: <list-of-abbreviations>): set heading(outlined: false)

  // [STYLE] Annexure Handling
  // Any header labeled with "annex-*" is considered an appendix and should 
  // not carry standard section numbering.
  show: doc => context {
    let annex-labels = query(heading)
      .map(elt => elt.at("label", default: none))
      .filter(lab => lab != none and str(lab).match(regex("(abbreviations|annex-.*)")) != none)
    
    // Selector placeholder ensures code doesn't break if no annexes exist
    show selector.or(<annex-placeholder>, ..annex-labels): set heading(numbering: none)
    doc
  }

  // [STYLE] Heading Appearance & Behavior
  show heading: it => {
    // 1. Page Breaks: Level 1 headings (Chapters) must start on a fresh page.
    if it.level == 1 and it.outlined == true {
      pagebreak(weak: true)
    }

    // 2. Font Size: Apply the strict size hierarchy defined in constants.
    let size-idx = calc.min(it.level - 1, heading-sizes.len() - 1)
    let size = heading-sizes.at(size-idx)
    set text(size)
    
    // 3. Spacing: Apply the asymmetric spacing (above/below).
    // Note: We currently rely on block() settings, but customized spacing variables
    // are prepared in 'heading-spacing' if manual v() calls are needed later.
    
    block(above: 1.5em, below: 1em, sticky: true, {
      // 4. Numbering Render: Manually render the counter to ensure formatting control.
      if it.numbering != none and it.level <= number-depth {
        counter(heading).display(it.numbering)
        h(0.5em)
      }
      it.body
    })
  }

  // ───────────────────────────────────────────────────────────────────────────
  // COMPONENT STYLING (Figures, Tables, Footnotes)
  // ───────────────────────────────────────────────────────────────────────────

  // [STYLE] Figure Captions
  // Captions must be Bold and Italic to distinguish them from body text.
  // They must be left-aligned to match the grid.
  show figure.caption: set text(weight: "bold", style: "italic")
  show figure.caption: set align(left)

  // [STYLE] Table Styling
  // Tables should be clean with minimal lines, but we enforce cell padding 
  // (inset) for readability.
  set table(
    inset: table-inset,
    stroke: none
  )

  // [STYLE] Footnotes
  // Footnotes must use a "hanging indent" format where the number is aligned left
  // and multi-line notes indent to align with the text start, not the number.
  show footnote.entry: it => context {
    let numbering = it.note.numbering
    let counter = counter(footnote)
    let loc = it.note.location()
    let num = std.numbering(numbering, ..counter.at(loc))
    let sup = super(num)
    let prefix = link(loc, text(fill: footnote_color, sup))
    let body = it.note.body
    
    let gap = footnote-gap
    let width = measure(prefix).width + gap
    par(hanging-indent: width, prefix + h(gap) + body)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // DOCUMENT BODY CONSTRUCTION
  // ───────────────────────────────────────────────────────────────────────────

  // 1. Title Page Construction
  {
    if title != none {
      v(title-vspace)

      // Styling based on parameters (allows overrides, but defaults to Montserrat/Bold)
      if (heading-family != none or heading-weight != "bold" or heading-style != "normal" or heading-color != black) {
        set text(font: heading-family, weight: heading-weight, style: heading-style, fill: heading-color)
        text(size: title-size)[#title]
        if subtitle != none {
          block(above: 0.4em, below: 2em)
          text(size: subtitle-size, fill: black)[#subtitle]
        }
      } else {
        text(weight: "bold", size: title-size)[#title]
        if subtitle != none {
          parbreak()
          text(weight: "bold", size: subtitle-size, fill: black)[#subtitle]
        }
      }
    }

    // Author Block
    if authors != none {
      v(1em)
      parbreak()
      let author-names = authors.map(author => author.name)
      let joined = if author-names.len() > 1 {
        author-names.slice(0, -1).join(", ") + " & " + author-names.last()
      } else {
        author-names.first()
      }
      text(size: author-size)[#joined]
    }

    // Date Block
    if date != none {
      set text(size: date-size)
      align(left)[#date]
    }
    
    // Force page break after title page
    pagebreak(weak: true)
  }

  // 2. Table of Contents
  if toc {
    pagebreak(weak: true)
    block(above: 0em, below: 2em)[
      #outline(
        title: toc_title,
        depth: toc_depth,
        indent: toc_indent
      )
    ]
    pagebreak(weak: true)
  }

  // 3. List of Figures & List of Tables
  // This logic auto-generates indices if Quarto float figures are detected.
  context {
    pagebreak(weak: true)
    let figure_targets = figure.where(kind: "quarto-float-fig")
        .or(figure.where(kind: image))
    let table_targets = figure.where(kind: "quarto-float-tbl")
        .or(figure.where(kind: table))
    if query(figure_targets).len() > 0 {
      outline(title: lof_title, target: figure_targets)
    }
    if query(table_targets).len() > 0 {
      outline(title: lot_title, target: table_targets)
    }
    pagebreak(weak: true)
  }

  // 4. Main Content
  doc
}

// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVE / DEFERRED FEATURES
// ─────────────────────────────────────────────────────────────────────────────

/* ARCHIVE ITEM: Bibliography Formatting (Broken)
   PURPOSE: A different way to handle bibliography indentation and titles.
   REASON FOR REMOVAL: Currently not working due to Typst limitations on 
   bibliography styling inheritance.
*/
// show bibliography: set par(first-line-indent: 0in, hanging-indent: 0.5in)
// show bibliography: it_bib => {
//   show block: it_block => {
//     if it_block.body.func() != [].func() {
//       it_block.body
//     } else {
//       par(
//         it_block.body.children.enumerate().map(((i, fragment)) => {
//           if i != 0 { fragment }
//         }).join("")
//       )
//     }
//   }
//   it_bib
// }


/* ARCHIVE ITEM: Alternative Heading Spacing
   PURPOSE: This logic manually applies vertical spacing (v) using the 'above' 
   and 'below' values defined in the extracted constants.
   REASON FOR REMOVAL: The active code uses the standard `block()` function 
   inside `show heading`, which is more robust for keeping headings attached 
   to their following paragraphs (sticky).
*/
// // --- 2. APPLY SPACING ---
// if it.level <= heading-spacings.len() {
//   let current-spacing = heading-spacings.at(it.level - 1)
//   let above = current-spacing.at(0)
//   let below = current-spacing.at(1)
//   v(above, weak: false)
//   it
//   v(below, weak: false)
// } 
// else {
//   it
// }


/* ARCHIVE ITEM: Multi-column Support
   PURPOSE: Checks if 'cols' param is > 1 and splits the doc body.
   REASON FOR REMOVAL: This template seems strictly designed for single-column
   reports. Enabling this blindly might break the layout of wide tables or images.
*/
// if cols == 1 {
//   doc
// } else {
//   columns(cols, doc)
// }


/* ARCHIVE ITEM: Conditional Heading Numbering Depth
   PURPOSE: To stop numbering headings if they go too deep (e.g., Level 4).
   REASON FOR REMOVAL: Replaced by the simpler `number-depth` parameter 
   passed into the `article` function.
*/
// set heading(
//   numbering: (..numbers) =>
//     if numbers.pos().len() <= numbering-depth {
//       return numbering(sectionnumbering, ..numbers)
//     }
//     else{
//       h(-0.5em)
//     }
// )

/* ARCHIVE ITEM: Conditional Outline Numbering
   PURPOSE: To apply section numbering only to headings that are outlined 
   and within a certain depth.
*/
// if it.depth <= 3 and it.outlined == true {
//    set heading(numbering: sectionnumbering)
// }
