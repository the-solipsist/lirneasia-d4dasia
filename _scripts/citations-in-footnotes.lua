local note_count = 0

function Note(elem)
  -- 1. Increment the footnote counter
  note_count = note_count + 1
  
  -- 2. Get the filename
  -- When running 'quarto pandoc file.qmd', this returns the filename.
  -- Note: If you pass multiple files at once (e.g. *.qmd), Pandoc sees them as 
  -- one big stream, so this will only show the first filename for all footnotes.
  local current_file = PANDOC_STATE.input_files[1] or "Stdin/Unknown"

  -- 3. Define the local filter
  local search_cites = {
    Cite = function(cite_elem)
      for _, item in ipairs(cite_elem.citations) do
        -- Print to stderr so it appears in the console separate from document output
        io.stderr:write(
          string.format(
            "File: %s | Footnote #%d | CiteKey: @%s\n", 
            current_file, 
            note_count, 
            item.id
          )
        )
      end
    end
  }

  -- 4. Walk the footnote content
  pandoc.walk_block(pandoc.Div(elem.content), search_cites)
  
  return nil
end
