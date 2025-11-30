#!/bin/bash

# Get the absolute path of the project root (one level up from this script)
# This ensures the script works even if called from different locations
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

PDF_DIR="$PROJECT_ROOT/reports"
COUNTRY_DIR="$PROJECT_ROOT/country"

echo "🔗 Linking PDFs from reports/ to country directories..."

# Check if reports directory exists
if [ ! -d "$PDF_DIR" ]; then
    echo "❌ Error: Directory 'reports' not found. Run 'quarto render' first."
    exit 1
fi

# Loop through all PDFs
for pdf_path in "$PDF_DIR"/*.pdf; do
    filename=$(basename "$pdf_path")
    # Extract 'sl' from '..._sl.pdf'
    country_code=$(echo "$filename" | sed -n 's/.*_\([a-z]\{2\}\)\.pdf$/\1/p')

    if [ -n "$country_code" ]; then
        target_dir="$COUNTRY_DIR/$country_code"
        
        if [ -d "$target_dir" ]; then
            # The relative path from inside country/xx/ back to reports/
            # This path is static and does not change based on where the script is
            relative_link="../../reports/$filename"
            
            # Go to target dir to create the link
            pushd "$target_dir" > /dev/null
            rm -f "$filename"
            ln -s "$relative_link" "$filename"
            echo "✅ Linked $filename inside country/$country_code/"
            popd > /dev/null
        else
            echo "⚠️  Skipping $filename: $target_dir not found."
        fi
    fi
done

