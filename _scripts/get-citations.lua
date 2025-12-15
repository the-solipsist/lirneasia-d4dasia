-- _scripts/get-citations.lua

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
