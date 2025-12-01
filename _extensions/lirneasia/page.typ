// Helper function to find the introduction page
#let footer-color = rgb("#808080")

#let find-intro-page() = {
  let intro-labels = query(heading)
    .map(h => h.at("label", default: none))
    .filter(lbl => lbl != none and str(lbl).match(regex("^introduction")) != none)
  
  if intro-labels.len() > 0 {
    locate(intro-labels.first()).page()
  } else {
    none
  }
}

#set page(
  paper: $if(papersize)$"$papersize$"$else$"a4"$endif$,
  margin: $if(margin)$($for(margin/pairs)$$margin.key$: $margin.value$,$endfor$)$else$(x: 1in, y: 1in)$endif$,
  
  // Custom numbering function that switches styles at Introduction
  numbering: (n) => {
    let intro-page = find-intro-page()
    let current-page = here().page()
    
    if intro-page != none and current-page < intro-page { 
      numbering("i", n)
    } else { 
      numbering("1", n)
    }
  },
  
  footer: context {
    let current-page = here().page()
    let intro-page = find-intro-page()

    // Reset page counter to 0 on the page before Introduction
    if intro-page != none and current-page == intro-page -1 { 
      block(counter(page).update(0)) 
    }
    
    // Hide footer on title page
    if current-page == 1 { return none }
    
    // Display footer: report title (left) and page number (right)
    set text(10pt, fill: footer-color)
    align(left)[ $short-title$ #h(1fr) #counter(page).display() ]
  },
)

$if(logo)$
#set page(background: align($logo.location$, box(inset: $logo.inset$, image("$logo.path$", width: $logo.width$$if(logo.alt)$, alt: "$logo.alt$"$endif$))))
$endif$

// ============================================================================
// How this works:
// 
// 1. find-intro-page() searches for headings with labels matching "^introduction"
// 2. Returns the page number of the first match, or none if not found
// 3. Pages before Introduction get roman numerals (i, ii, iii...)
// 4. Introduction and subsequent pages get arabic numerals (1, 2, 3...)
// 5. Counter resets to 0 before introduction so it becomes page 1
//
// Requirements:
// - Introduction heading should have a label starting with "introduction"
//   Examples: <introduction>, <introduction-and-context>
// - The $short-title$ variable should contain your report's short title
// ============================================================================