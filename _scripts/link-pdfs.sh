#!/bin/bash

# Define paths
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPORTS_DIR="$PROJECT_ROOT/reports"
COUNTRY_DIR="$PROJECT_ROOT/country"

# 1. Prepare reports directory
mkdir -p "$REPORTS_DIR"

echo "🔍 Harvesting PDFs from country folders..."

# 2. Find PDFs in country subdirectories and Hard Link them to reports/
# We use 'ln -f' (force) to update the link if the file changed.
# Hard links make the file appear in reports/ as a real file, not a shortcut.
find "$COUNTRY_DIR" -name "*.pdf" | while read source_pdf; do
    filename=$(basename "$source_pdf")
    
    # Check if we are accidentally finding a file already in reports (just in case)
    if [[ "$source_pdf" != *"/reports/"* ]]; then
        ln -f "$source_pdf" "$REPORTS_DIR/$filename"
        echo "   ✅ Hard-linked $filename to reports/"
    fi
done

echo "✨ Done. PDFs in reports/ are ready for Git."