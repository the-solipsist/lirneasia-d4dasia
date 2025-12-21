--[[ 
  LUA FILTER: Audit Citation Keys
  ===============================
  
  Parent Script:
    _scripts/audit_citation_usage.ts
  
  Purpose:
    This Pandoc Lua filter extracts *every* citation key used in the document.
    It provides a master list of references cited in the text.
  
  How it works:
    1. Listens for 'Cite' elements.
    2. Iterates through all citation items within that element.
    3. Logs the filename and citation key to stderr.
  
  Output Format (stderr):
    [CITE] <filename>: @<key>
]]

function Cite(elem)
  -- Get the current filename if available
  local file = PANDOC_STATE.input_files[1] or "Unknown"

  for _, item in ipairs(elem.citations) do
    -- Format: [CITE] filename: @citationKey
    io.stderr:write(string.format("[CITE] %s: @%s\n", file, item.id))
  end
  
  -- Return nil to keep the document unchanged
  return nil
end