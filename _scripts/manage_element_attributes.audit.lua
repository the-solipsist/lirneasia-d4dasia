--[[ LUA FILTER: Audit Attributes (Divs/Spans) ========================================= Parent Script: _scripts/manage_element_attributes.ts Purpose: This filter inspects block (Div, Header, CodeBlock) and inline (Span, Link, Image) elements for attributes that might be problematic, such as: - Missing Alt Text on Images (Critical for accessibility). - Broken highlighting syntax (e.g. `{.mark}`). - Inline styles that should be moved to CSS classes. - Specific raw text patterns that look like broken attributes. How it works: 1. It defines a set of functions for various element types. 2. `get_attr_str` helper converts the element's attributes back to a string representation. 3. `emit` logs the findings to stderr in a pipe-delimited format for the TS script to parse. Output Format (stderr): <filename>|<type>|<attributes>|<content preview>]]

-- Helper to safely extract attributes into a string format like "{#id .class key=val}"
local function get_attr_str(elem)
  if not elem.attr then return nil end
  
  local parts = {}
  if elem.attr.identifier ~= "" then table.insert(parts, "#" .. elem.attr.identifier) end
  for _, c in ipairs(elem.attr.classes) do table.insert(parts, "." .. c) end
  for k, v in pairs(elem.attr.attributes) do table.insert(parts, k .. "=\"" .. v .. "\"") end

  if #parts > 0 then return "{" .. table.concat(parts, " ") .. "}" end
  return nil
end

-- Helper to write structured logs to stderr
local function emit(file, type, attr, content)
  -- Clean content for log display (no newlines, truncate length)
  content = content:gsub("\n", " ")
  if #content > 60 then content = content:sub(1, 57) .. "..." end
  io.stderr:write(string.format("%s|%s|%s|%s\n", file, type, attr, content))
end

-- 1. Check Standard Elements (Divs, Spans, Links, etc.)
local function check_element(type, elem)
  local attr_str = get_attr_str(elem)
  local file = PANDOC_STATE.input_files[1] or "Unknown"
  local content = ""

  -- Special handling for Images: Explicitly check for Alt Text
  if type == "Image" then
    content = pandoc.utils.stringify(elem.caption)
    if content == "" then
      -- Emit specific warning for missing alt text, even if it has no other attributes
      emit(file, "Image (No Alt)", attr_str or "{}", "MISSING ALT TEXT")
      return -- Stop here to avoid double printing
    end
  end

  -- If attributes exist, log them for the TypeScript auditor to classify
  if attr_str then
    if not content or content == "" then
      if elem.content then content = pandoc.utils.stringify(elem.content)
      elseif elem.text then content = elem.text
      end
    end
    emit(file, type, attr_str, content)
  end
end

-- 2. Check Plain Text for "Broken" Attributes
-- Sometimes attributes like `{.mark}` fail to parse and appear as raw text `{.mark}`.
local function check_text(elem)
  local s = elem.text
  -- Regex matches patterns that look like attributes: { ... }
  if s:match("{[%w%-%._#=]+}") then
    local file = PANDOC_STATE.input_files[1] or "Unknown"
    emit(file, "Text (Raw)", "Potential Broken Attribute", s)
  end
end

-- Return the filter table mapping element names to functions
return {
  Span      = function(e) check_element("Span", e) end,
  Div       = function(e) check_element("Div", e) end,
  Link      = function(e) check_element("Link", e) end,
  Image     = function(e) check_element("Image", e) end,
  Code      = function(e) check_element("Code", e) end,
  CodeBlock = function(e) check_element("CodeBlock", e) end,
  Header    = function(e) check_element("Header", e) end,
  Str       = function(e) check_text(e) end
}