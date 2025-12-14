#!/bin/bash

# --- CONFIGURATION ---
TARGET_DIR="reports"

# --- ARGUMENT PARSING ---
EXECUTE_MODE=false
if [[ "$1" == "--execute" || "$1" == "-e" ]]; then
  EXECUTE_MODE=true
fi

# --- DETECT OS FOR SED COMPATIBILITY ---
# macOS requires an empty string argument for -i (e.g., -i ''), Linux does not.
if [[ "$OSTYPE" == "darwin"* ]]; then
  SED_INPLACE=(-i '')  # macOS
else
  SED_INPLACE=(-i)     # Linux/GNU
fi

# --- REGEX EXPLANATION (Extended Regex) ---
# ^(#+[[:space:]]+)       : Group 1: Start of line, hashes, and space (e.g., "## ")
# [0-9]+                  : A number
# (\.[0-9]+)* : Optional repeating groups of .number (e.g., .1.1)
# \.?                     : Optional trailing dot
# [[:space:]]+            : Space separator (to be removed)
# (.*)$                   : Group 2: The rest of the heading text
SED_PATTERN='s/^(#+[[:space:]]+)[0-9]+(\.[0-9]+)*\.?[[:space:]]+(.*)$/\1\3/'
GREP_PATTERN='^#+[[:space:]]+[0-9]+(\.[0-9]+)*\.?[[:space:]]+.*$'

# --- MAIN LOGIC ---

if [ "$EXECUTE_MODE" = true ]; then
  echo "⚠️  EXECUTION MODE: Modifying files..."
else
  echo "🔍 DRY RUN: Listing matches only (use --execute to apply changes)..."
fi
echo "------------------------------------------------------------"

MATCH_COUNT=0

# Use 'find' to get all .qmd files recursively
while IFS= read -r file; do
  
  # 1. Find matches in the current file using grep
  # -n: show line numbers
  # -E: use extended regex
  MATCHES=$(grep -nE "$GREP_PATTERN" "$file")

  if [ -n "$MATCHES" ]; then
    echo "File: $file"
    
    # 2. Loop through each match to display details
    while IFS= read -r line; do
      ((MATCH_COUNT++))
      
      # Extract line number and content
      LINE_NUM=$(echo "$line" | cut -d: -f1)
      CONTENT=$(echo "$line" | cut -d: -f2-)
      
      # Simulate the replacement to show the user what will happen
      CLEANED=$(echo "$CONTENT" | sed -E "$SED_PATTERN")
      
      if [ "$EXECUTE_MODE" = false ]; then
        echo "  [MATCH] Line $LINE_NUM"
        echo "     Was: $CONTENT"
        echo "     Now: $CLEANED"
      else
        echo "  [FIXED] Line $LINE_NUM: $CONTENT -> $CLEANED"
      fi
    done <<< "$MATCHES"

    # 3. If in execute mode, apply the sed command to the file
    if [ "$EXECUTE_MODE" = true ]; then
      sed -E "${SED_INPLACE[@]}" "$SED_PATTERN" "$file"
    fi
    echo ""
  fi

done < <(find "$TARGET_DIR" -type f -name "*.qmd")

echo "------------------------------------------------------------"
echo "Done. Found $MATCH_COUNT instances."

if [ "$EXECUTE_MODE" = false ] && [ "$MATCH_COUNT" -gt 0 ]; then
  echo "Run with --execute (or -e) to apply these changes."
fi
