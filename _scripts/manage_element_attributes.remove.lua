--[[ LUA FILTER: Remove Attributes (Fix Mode) ======================================== Parent Script: _scripts/manage_element_attributes.ts (with --fix flag) Purpose: This filter actively MODIFIES the document structure to remove unwanted attributes. It focuses on: 1. Headers: Removing hardcoded identifiers (IDs) to let Quarto/Pandoc auto-generate them. 2. Links: Removing specific Pandoc-generated classes like `.uri` or `.email` that might interfere with custom styling. How it works: 1. Intercepts Header and Link elements. 2. Checks for the unwanted attributes. 3. If found, it records the "Before" state (as Markdown). 4. Modifies the element object (removes ID, filters classes). 5. Records the "After" state. 6. Logs the change to stderr for the TS script to report. 7. Returns the Modified Element to Pandoc. ]]--

-- Helper to render an element as a Markdown string (for logging purposes)
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

-- Helper to log changes to stderr in a pipe-delimited format
local function log_change(file, type, before, after)
  if before ~= after then
    io.stderr:write(string.format("CHANGE|%s|%s|%s|%s\n", file, type, before, after))
  end
end

-- Function to process Header elements
function Header(elem)
  local file = PANDOC_STATE.input_files[1] or "Unknown"
  
  -- Only proceed if there is an identifier to remove
  if elem.identifier and elem.identifier ~= "" then
    local before = to_md(elem)
    
    -- ACTION: Clear the identifier
    elem.identifier = ""
    
    local after = to_md(elem)
    log_change(file, "Header ID", before, after)
  end
  return elem
end

-- Function to process Link elements
function Link(elem)
  local file = PANDOC_STATE.input_files[1] or "Unknown"
  
  -- Check if it has target classes (.uri or .email)
  local has_target = false
  for _, c in ipairs(elem.classes) do
    if c == "uri" or c == "email" then has_target = true break end
  end

  if has_target then
    local before = to_md(elem)

    -- ACTION: Filter out the unwanted classes
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