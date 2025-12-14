#!/bin/bash

# Find all .qmd files in 'reports' and loop through them
find reports -type f -name "*.qmd" | while read -r f; do
  
  # Optional: Print what file we are checking
  echo "Checking: $f"
  
  quarto pandoc "$f" \
    --from markdown \
    --lua-filter _scripts/citations-in-footnotes.lua \
    --to native \
    --output /dev/null

done
