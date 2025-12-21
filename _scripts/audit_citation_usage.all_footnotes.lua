--[[ 
  LUA FILTER: Audit All Footnotes
  ===============================
  
  Parent Script:
    _scripts/audit_citation_usage.ts (with --all-footnotes flag)
  
  Purpose:
    This Pandoc Lua filter extracts the *content* of every footnote in the document.
    It is useful for reviewing footnote usage, checking for length, or manual auditing.
  
  How it works:
    1. Listens for 'Note' elements.
    2. Extracts the text content.
    3. Logs the filename, footnote number, and truncated content to stderr.
  
  Output Format (stderr):
    [NOTE] <filename> (#<n>): <text content...>
]]

local note_count = 0

function Note(elem)
  note_count = note_count + 1
  local file = PANDOC_STATE.input_files[1] or "Unknown"
  
  -- Extract text from the footnote's content blocks
  local text = pandoc.utils.stringify(elem.content)
  
  -- Clean up newlines to ensure the log is a single line per footnote
  text = text:gsub("\n", " ")
  
  -- Optional: Truncate if the footnote is extremely long
  if #text > 80 then text = text:sub(1, 77) .. "..." end

  -- Log to stderr
  io.stderr:write(string.format("[NOTE] %s (#%d): %s\n", file, note_count, text))
  
  -- Return nil to leave the document unchanged
  return nil
end