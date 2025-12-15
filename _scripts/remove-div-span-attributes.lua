-- _scripts/remove-div-span-attributes.lua

-- Helper to render an element as Markdown string for logging
local function to_md(elem)
  local doc
  -- Check if element is Inline (Link) or Block (Header)
  if elem.t == "Link" then
    -- Inlines must be wrapped in a Block (Plain) to be writable
    doc = pandoc.Pandoc({pandoc.Plain({elem})})
  else
    -- Blocks can go directly into Pandoc
    doc = pandoc.Pandoc({elem})
  end
  
  -- Render and strip trailing newlines
  return pandoc.write(doc, "markdown"):gsub("\n", "")
end

-- Helper to log changes
local function log_change(file, type, before, after)
  if before ~= after then
    io.stderr:write(string.format("CHANGE|%s|%s|%s|%s\n", file, type, before, after))
  end
end

function Header(elem)
  local file = PANDOC_STATE.input_files[1] or "Unknown"
  
  -- Only proceed if there is an identifier to remove
  if elem.identifier and elem.identifier ~= "" then
    local before = to_md(elem)
    
    -- MODIFY: Remove ID
    elem.identifier = ""
    
    local after = to_md(elem)
    log_change(file, "Header ID", before, after)
  end
  return elem
end

function Link(elem)
  local file = PANDOC_STATE.input_files[1] or "Unknown"
  
  -- Check if it has target classes (.uri or .email)
  local has_target = false
  for _, c in ipairs(elem.classes) do
    if c == "uri" or c == "email" then has_target = true break end
  end

  if has_target then
    local before = to_md(elem)

    -- MODIFY: Filter classes
    local new_classes = {}
    for _, c in ipairs(elem.classes) do
      if c ~= "uri" and c ~= "email" then
        table.insert(new_classes, c)
      end
    end
    elem.classes = new_classes
    
    local after = to_md(elem)
    log_change(file, "Link Class", before, after)
  end
  return elem
end
