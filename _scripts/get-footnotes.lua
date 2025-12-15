-- _scripts/get-footnotes.lua

local note_count = 0

function Note(elem)
  note_count = note_count + 1
  local file = PANDOC_STATE.input_files[1] or "Unknown"
  
  -- Target 'elem.content' (the blocks inside the note) 
  -- instead of 'elem' (the note container itself)
  local text = pandoc.utils.stringify(elem.content)
  
  -- Clean up newlines so the log stays on one line per footnote
  text = text:gsub("\n", " ")
  
  -- Truncate if too long (optional)
  if #text > 80 then text = text:sub(1, 77) .. "..." end

  -- Format: [NOTE] filename (Note #): Content
  io.stderr:write(string.format("[NOTE] %s (#%d): %s\n", file, note_count, text))
  
  return nil
end
