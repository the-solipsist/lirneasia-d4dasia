/**
 * CITATION RESOLVER (Asymmetric CSL-Enhanced)
 * ===========================================
 *
 * Usage:
 *   quarto run _scripts/resolve_citations.ts
 *   quarto run _scripts/resolve_citations.ts -- --fix
 * 
 * Purpose:
 *   Matches failing citation keys (raw strings) against valid keys (rich CSL metadata).
 *   Uses "Asymmetric Matching" to handle truncated BetterBibTeX keys vs full CSL titles.
 */

import { walk } from "stdlib/fs";
import { join, dirname, fromFileUrl } from "stdlib/path";
import { parse } from "stdlib/flags";

// --- CONFIGURATION ---
const PATHS = {
  FAILING: "_references/citekeys-reports-failing.txt",
  VALID:   "_references/citekeys-bib-valid.txt",
  BIB_JSON:"_references/d4dasia-bib.json",
  REPORTS: "reports",
  LOG:     "citation_fix_log.txt",
  UPDATE_SCRIPT: "_scripts/manage_citations.ts",
  MANUAL_FALSE_POSITIVES: "_references/citekeys-manual-false-positives.txt",
  MANUAL_TRUE_POSITIVES: "_references/citekeys-manual-true-positives.txt"
};

const SCORING = {
  HIGH_THRESHOLD: 0.85,
  MED_THRESHOLD:  0.60,
  BONUS: {
    EXACT_YEAR: 0.6,
    EXACT_AUTHOR: 0.4,
    SUBSTR_AUTHOR: 0.25,
    EXACT_TITLE: 0.5,
    STRONG_TITLE: 0.4,
    WEAK_TITLE: 0.2,
    YEAR_ENRICH: 0.4,
    AUTHOR_ENRICH: 0.15,
  }
};

const LEGAL_SUFFIXES = [
  "Act", "Bill", "Law", "Code", "Regulation", "Regulations",
  "Rule", "Rules", "Ordinance", "Constitution", "Amendment",
  "Policy", "Convention", "Treaty", "Agreement", "Protocol"
];

const STRIPPABLE_SUFFIXES = ["Report", "Paper", "Document", "Study"];

// --- ARGS ---
const args = parse(Deno.args, {
  boolean: ["fix", "auto-fix-high", "verbose", "no-update-citations", "manual-only", "auto-manual"],
  string: ["output"],
  alias: { v: "verbose", o: "output" }
});
const MODE = {
  INTERACTIVE: args.fix,
  AUTO_HIGH:   args["auto-fix-high"],
  AUTO_MANUAL: args["auto-manual"],
  VERBOSE:     args.verbose,
  OUTPUT_FILE: args.output,
  DRY_RUN:     !args.fix && !args["auto-fix-high"] && !args["auto-manual"],
  SKIP_UPDATE: args["no-update-citations"],
  MANUAL_ONLY: args["manual-only"]
};

// --- TYPES ---
export interface KeyParts {
  original: string;
  author: string | null;
  titleWords: string[];
  year: string | null;
  suffix: string | null;
  isLegalDocument: boolean;
}

export interface CSLItem {
  id: string;
  type?: string;
  title?: string;
  author?: Array<{family?: string; given?: string; literal?: string}>;
  issued?: { "date-parts"?: number[][] };
  "container-title"?: string;
  publisher?: string;
}

interface MatchResult {
  fail: string;
  bestMatch: string;
  bestScore: number;
  contexts: string[];
  method: string;
  explanation: string;
}

// =============================================================================
// LOGIC HELPERS
// =============================================================================

function escapeRegExp(s: string): string {
  const chars = [".", "*", "+", "?", "^", "$", "{", "}", "(", ")", "|", "[", "]", "\\"];
  let res = s;
  for (const c of chars) {
    res = res.replaceAll(c, "\\" + c);
  }
  return res;
}

function createCitationRegex(key: string): RegExp {
  return new RegExp(`@${escapeRegExp(key)}(?=[^a-zA-Z0-9_]|$)`, "g");
}

function normalizeKey(key: string): string {
  let normalized = key;
  // Fix: "AntiTerrorismAct20202020" -> "AntiTerrorismAct2020"
  normalized = normalized.replace(/(\d{4})\1+$/, "$1");
  // Fix: "2018ImplementingRules2018" -> "ImplementingRules2018"
  const leadYearMatch = normalized.match(/^(\d{4})/);
  const trailYearMatch = normalized.match(/(\d{4})([a-z])?$/);
  if (leadYearMatch && trailYearMatch && leadYearMatch[1] === trailYearMatch[1]) {
    normalized = normalized.substring(4);
  }
  return normalized;
}

function isLegalDocument(titleWords: string[]): boolean {
  if (titleWords.length === 0) return false;
  const lastWord = titleWords[titleWords.length - 1];
  const wordsStr = titleWords.join("").toLowerCase();
  
  return LEGAL_SUFFIXES.includes(lastWord) || 
         wordsStr.includes("data") || 
         wordsStr.includes("privacy") || 
         wordsStr.includes("protection");
}

export function parseKey(key: string): KeyParts | null {
  let temp = normalizeKey(key);
  let year: string | null = null;
  let suffix: string | null = null;

  const yearMatch = temp.match(/(\d{4})([a-z])?$/);
  if (yearMatch) {
    year = yearMatch[1];
    suffix = yearMatch[2] || null;
    temp = temp.substring(0, temp.length - yearMatch[0].length);
  }

  let author: string | null = null;
  let rawTitle = "";

  const authorMatch = temp.match(/^([a-z]+)(?=[A-Z]|$)/);
  if (authorMatch) {
    author = authorMatch[1];
    rawTitle = temp.substring(author.length);
  } else {
    rawTitle = temp;
  }

  if (!author && !rawTitle && !year) return null;

  const titleWords = rawTitle.split(/(?=[A-Z])/).filter(s => s.length > 0);
  const isLegal = isLegalDocument(titleWords);

  return {
    original: key,
    author: author || null,
    titleWords: titleWords,
    year: year || null,
    suffix: suffix || null,
    isLegalDocument: isLegal
  };
}

function stripNonLegalSuffixes(words: string[]): string[] {
  if (words.length === 0) return words;
  const lastWord = words[words.length - 1];
  if (STRIPPABLE_SUFFIXES.includes(lastWord)) {
    return words.slice(0, -1);
  }
  return words;
}

function getTitleString(words: string[], stripSuffixes: boolean = false): string {
  const workingWords = stripSuffixes ? stripNonLegalSuffixes(words) : words;
  return workingWords.map(w => w.toLowerCase()).join("");
}

function calculateTitleCoverage(failT: string, validT: string): {
  coverage: number;
  match: "exact" | "strong" | "weak" | "none";
} {
  if (!failT || !validT) return { coverage: 0, match: "none" };
  
  if (failT === validT) {
    return { coverage: 1.0, match: "exact" };
  }
  
  const minLen = Math.min(failT.length, validT.length);
  const maxLen = Math.max(failT.length, validT.length);
  
  if (failT.includes(validT)) {
    const coverage = validT.length / maxLen;
    return {
      coverage,
      match: coverage >= 0.7 ? "strong" : coverage >= 0.5 ? "weak" : "none"
    };
  }
  
  if (validT.includes(failT)) {
    const coverage = failT.length / maxLen;
    return {
      coverage,
      match: coverage >= 0.6 ? "strong" : coverage >= 0.4 ? "weak" : "none"
    };
  }
  
  return { coverage: 0, match: "none" };
}

export function jaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  
  const len1 = s1.length, len2 = s2.length;
  const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
  
  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);
  
  let matches = 0;
  let transpositions = 0;
  
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, len2);
    
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = s2Matches[j] = true;
      matches++;
      break;
    }
  }
  
  if (matches === 0) return 0;
  
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }
  
  const jaro = (matches / len1 + matches / len2 + 
                (matches - transpositions / 2) / matches) / 3;
  
  let prefix = 0;
  for (let i = 0; i < Math.min(4, len1, len2); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }
  
  return jaro + (prefix * 0.1 * (1 - jaro));
}

// --- CORE COMPARISON LOGIC (ASYMMETRIC) ---

export function compareStructured(
  fail: KeyParts, 
  valid: KeyParts,
  validCSL?: CSLItem | null
): {
  score: number;
  explanation: string;
} {
  let score = 0;
  const reasons: string[] = [];

  // Determine legal document status from CSL if available
  const validIsLegal = validCSL?.type && 
    ["legislation", "bill", "regulation", "treaty", "legal_case"].includes(validCSL.type);
  
  let requiresStrictYear = fail.isLegalDocument || validIsLegal;

  // 1. ENHANCEMENT: Check valid's full title for legal indicators
  if (validCSL?.title && !validIsLegal) {
    const titleLower = validCSL.title.toLowerCase();
    const hasLegalSuffix = LEGAL_SUFFIXES.some(suffix => 
      new RegExp(`\\b${suffix.toLowerCase()}\\b`).test(titleLower)
    );
    if (hasLegalSuffix) {
      requiresStrictYear = true;
    }
  }

  // 2. YEAR MATCHING (Use CSL date if key date missing)
  let validYear = valid.year;
  if (!validYear && validCSL?.issued?.["date-parts"]?.[0]?.[0]) {
    validYear = String(validCSL.issued["date-parts"][0][0]);
  }

  if (fail.year && validYear) {
    if (fail.year === validYear) {
      score += SCORING.BONUS.EXACT_YEAR;
      reasons.push(`Year: ${fail.year}`);
    } else {
      if (requiresStrictYear) {
        return { 
          score: 0, 
          explanation: `LEGAL DOC year mismatch: ${fail.year} != ${validYear}` 
        };
      } else {
        return { 
          score: 0, 
          explanation: `Year mismatch: ${fail.year} != ${validYear}` 
        };
      }
    }
  } else if (!fail.year && validYear) {
    // Enrichment
    score += SCORING.BONUS.YEAR_ENRICH;
    reasons.push(`Year enrich: +${validYear}`);
  } else if (fail.year && !validYear) {
    if (requiresStrictYear) {
      score -= 0.1;
      reasons.push(`Valid key missing year (suspicious)`);
    } else {
      score -= 0.05;
    }
  }

  // 3. ENHANCEMENT: Full Title Containment
  // This helps when fail key has "Act" but valid key (truncated) does not
  if (validCSL?.title) {
    const validFullTitle = validCSL.title.toLowerCase().replace(/[^a-z0-9]/g, "");
    const failKeyStr = fail.titleWords.join("").toLowerCase();
    
    if (validFullTitle.includes(failKeyStr)) {
      score += 0.3;
      reasons.push(`Fail key in valid title`);
    } else if (failKeyStr.includes(validFullTitle)) {
      score += 0.25;
      reasons.push(`Valid title in fail key`);
    } else {
      const titleSim = jaroWinkler(failKeyStr, validFullTitle);
      if (titleSim > 0.7) {
        score += 0.2 * titleSim;
        reasons.push(`Key vs title: ${(titleSim * 100).toFixed(0)}%`);
      }
    }
  }

  // 4. Standard Title Word Matching
  const failTWithSuffix = getTitleString(fail.titleWords, false);
  const validTWithSuffix = getTitleString(valid.titleWords, false);
  const failTNoSuffix = getTitleString(fail.titleWords, true);
  const validTNoSuffix = getTitleString(valid.titleWords, true);
  
  let titleResult;
  if (requiresStrictYear) {
    titleResult = calculateTitleCoverage(failTWithSuffix, validTWithSuffix);
  } else {
    const coverageWithSuffix = calculateTitleCoverage(failTWithSuffix, validTWithSuffix);
    const coverageNoSuffix = calculateTitleCoverage(failTNoSuffix, validTNoSuffix);
    titleResult = coverageNoSuffix.match !== "none" ? coverageNoSuffix : coverageWithSuffix;
  }
  
  const titleMatch = titleResult.match;
  
  if (titleMatch === "exact") {
    score += SCORING.BONUS.EXACT_TITLE;
    reasons.push("Title exact");
  } else if (titleMatch === "strong") {
    score += SCORING.BONUS.STRONG_TITLE * titleResult.coverage;
    reasons.push(`Title strong (${(titleResult.coverage * 100).toFixed(0)}%)`);
  } else if (titleMatch === "weak") {
    score += SCORING.BONUS.WEAK_TITLE * titleResult.coverage;
    reasons.push(`Title weak (${(titleResult.coverage * 100).toFixed(0)}%)`);
  }

  // 5. Author Matching (Enhanced with CSL)
  let authorMatched = false;
  
  if (fail.author && validCSL?.author) {
    const validAuthors = validCSL.author.map(a => {
      if ('family' in a && a.family) return a.family.toLowerCase();
      if ('literal' in a && a.literal) return a.literal.toLowerCase();
      return '';
    }).filter(Boolean);
    
    const failAuthorLower = fail.author.toLowerCase();
    
    for (const vAuthor of validAuthors) {
      if (vAuthor === failAuthorLower) {
        score += SCORING.BONUS.EXACT_AUTHOR;
        reasons.push(`Author: ${fail.author} (CSL)`);
        authorMatched = true;
        break;
      } else if (vAuthor.startsWith(failAuthorLower) && failAuthorLower.length >= 3) {
        score += SCORING.BONUS.SUBSTR_AUTHOR;
        reasons.push(`Author prefix: ${fail.author} (CSL)`);
        authorMatched = true;
        break;
      }
    }
  } 
  
  // Fallback / Key-based Author Matching
  if (!authorMatched && fail.author && valid.author) {
    if (fail.author === valid.author) {
      score += SCORING.BONUS.EXACT_AUTHOR;
      reasons.push(`Author: ${fail.author}`);
      authorMatched = true;
    } else if (valid.author.startsWith(fail.author) && fail.author.length >= 3) {
      score += SCORING.BONUS.SUBSTR_AUTHOR;
      reasons.push(`Author prefix: ${fail.author}`);
      authorMatched = true;
    } else {
      return { 
        score: 0, 
        explanation: `Author mismatch: ${fail.author} != ${valid.author}` 
      };
    }
  } 
  
  // Author Enrichment
  if (!authorMatched && !fail.author && (valid.author || validCSL?.author)) {
    if (titleMatch === "exact" || titleMatch === "strong") {
      score += SCORING.BONUS.AUTHOR_ENRICH;
      reasons.push(`Author enrich`);
    }
  }

  // 6. Suffix matching
  if (fail.suffix && valid.suffix && fail.suffix !== valid.suffix) {
    return {
      score: 0,
      explanation: `Suffix mismatch: ${fail.suffix} != ${valid.suffix}`
    };
  }

  return {
    score: Math.min(1.5, score), // Cap slightly above 1 to distinguish perfect matches
    explanation: reasons.join("; ")
  };
}

// =============================================================================
// I/O HELPERS
// =============================================================================

async function loadCSLData(): Promise<Map<string, CSLItem>> {
  try {
    const text = await Deno.readTextFile(PATHS.BIB_JSON);
    const items: CSLItem[] = JSON.parse(text);
    const map = new Map<string, CSLItem>();
    for (const item of items) {
      if (item.id) {
        map.set(item.id, item);
      }
    }
    console.log(`✓ Loaded ${map.size} CSL entries from bibliography.`);
    return map;
  } catch (e) {
    console.warn(`⚠️  Could not load CSL data from ${PATHS.BIB_JSON}. Using key-only matching.`);
    return new Map();
  }
}

async function reportMatch(lines: string[]) {
  for (const line of lines) {
    console.log(line);
  }
  if (MODE.OUTPUT_FILE) {
    const clean = lines.map(l => l.replace(/\x1b\[[0-9;]*m/g, "")).join("\n");
    await Deno.writeTextFile(MODE.OUTPUT_FILE, clean + "\n", { append: true });
  }
}

async function loadKeys(path: string): Promise<string[]> {
  try {
    const text = await Deno.readTextFile(path);
    // Preserves order while filtering out duplicates, empty lines, and report headers (#)
    const keys: string[] = [];
    const seen = new Set<string>();
    
    text.split("\n").map(s => s.trim()).forEach(s => {
      if (s !== "" && !s.startsWith("#") && !seen.has(s)) {
        keys.push(s);
        seen.add(s);
      }
    });
    return keys;
  } catch (e) {
    console.error(`Failed to load keys from ${path}`);
    return [];
  }
}

async function runUpdateScript() {
  console.log("Updating citation lists...");
  const cmd = new Deno.Command("quarto", {
    args: ["run", PATHS.UPDATE_SCRIPT, "--list-available", "--list-used", "--list-failing"],
    stdout: "inherit", stderr: "inherit"
  });
  const status = await cmd.output();
  if (!status.success) {
    console.error("❌ Aborting: Citation list update failed.");
    Deno.exit(1);
  }
}

async function saveSession(fileContents: Map<string, string>, changeLog: string[]) {
  if (changeLog.length === 0) return;
  console.log(`\nWriting changes to ${changeLog.length} keys across files...`);
  let savedCount = 0;
  for (const [path, newContent] of fileContents.entries()) {
    try {
      const currentDisk = await Deno.readTextFile(path);
      if (currentDisk !== newContent) {
        await Deno.writeTextFile(path, newContent);
        console.log(`   Saved: ${path}`);
        savedCount++;
      }
    } catch (e) {
      console.error(`   ❌ Failed to save ${path}:`, e);
    }
  }
  try {
    const logPath = PATHS.LOG;
    let oldLog = "";
    try { oldLog = await Deno.readTextFile(logPath) + "\n"; } catch { /* ignore new file */ }
    await Deno.writeTextFile(logPath, oldLog + changeLog.join("\n"));
    console.log(`\n✅ Saved ${savedCount} files.`);
    console.log(`📝 Log appended to: ${logPath}`);
  } catch (e) {
    console.error("Failed to write log file:", e);
  }
}

function promptUser(q: string, options: string): string {
  if (!Deno.isatty(Deno.stdin.rid)) {
    console.warn("Non-interactive terminal detected. Skipping prompt.");
    return "";
  }
  const res = prompt(`${q} \x1b[1m[${options}]\x1b[0m:`);
  return res ? res.trim().toLowerCase() : "";
}

async function loadManualOverrides(path: string): Promise<Set<string>> {
  try {
    const text = await Deno.readTextFile(path);
    const set = new Set<string>();
    for (const line of text.split("\n")) {
      const clean = line.trim();
      if (clean && !clean.startsWith("#")) {
        // Split by |, trim parts, and re-join without spaces for canonical lookup
        const parts = clean.split("|").map(p => p.trim());
        if (parts.length === 2) {
          set.add(`${parts[0]}|${parts[1]}`);
        }
      }
    }
    console.log(`✓ Loaded ${set.size} manual overrides from ${path}`);
    return set;
  } catch (e) {
    console.warn(`⚠️  Could not load manual overrides from ${path} (file may not exist).`);
    return new Set();
  }
}

// --- MAIN EXECUTION ---

async function main() {
  try {
    if (MODE.OUTPUT_FILE) {
      await Deno.writeTextFile(MODE.OUTPUT_FILE, ""); 
    }

    if (!MODE.SKIP_UPDATE) {
      await runUpdateScript();
    }
    
    const failingKeys = await loadKeys(PATHS.FAILING);
    const validKeys = await loadKeys(PATHS.VALID);
    const cslData = await loadCSLData(); // NEW: Load CSL data
    
    const manualFalsePositives = await loadManualOverrides(PATHS.MANUAL_FALSE_POSITIVES);
    const manualTruePositives = await loadManualOverrides(PATHS.MANUAL_TRUE_POSITIVES);

    console.log(`Loaded ${failingKeys.length} failing keys and ${validKeys.length} valid keys.`);

    const fileContents = new Map<string, string>();
    try {
      for await (const entry of walk(PATHS.REPORTS, { exts: [".qmd"] })) {
        if (entry.isFile) fileContents.set(entry.path, await Deno.readTextFile(entry.path));
      }
    } catch (e) {
      console.error(`❌ Failed to scan ${PATHS.REPORTS}:`, e);
      Deno.exit(1);
    }
    console.log(`Scanned ${fileContents.size} content files.`);

    console.log("\nAnalyzing matches...");
    const actionableMatches: MatchResult[] = [];

    for (const fail of failingKeys) {
      let bestMatch = "";
      let bestScore = -1;
      let method = "none";
      let explanation = "";

      const failParsed = parseKey(fail);

      for (const valid of validKeys) {
        // --- MANUAL OVERRIDES ---
        const pairKey = `${fail}|${valid}`;
        if (manualFalsePositives.has(pairKey)) continue;

        let score = 0;
        let currMethod = "none";
        let currExpl = "";

        if (manualTruePositives.has(pairKey)) {
          score = 2.0;
          currMethod = "Manual Override";
          currExpl = "Explicitly allowed in manual-true-positives.txt";
        } else if (!MODE.MANUAL_ONLY) {
          // --- STANDARD SCORING ---
          const validParsed = parseKey(valid);
          const validCSL = cslData.get(valid) || null; // Get CSL for this key

          // 1. Cascading Step 1: Structural Match (Asymmetric)
          if (failParsed && validParsed) {
            const structResult = compareStructured(failParsed, validParsed, validCSL);
            if (structResult.score > 0) {
              score = structResult.score;
              currMethod = "Structure";
              currExpl = structResult.explanation;
            }
          }

          // 2. Cascading Step 2: Fuzzy Match (Fallback)
          const strictMode = (failParsed?.isLegalDocument && failParsed?.year) || 
                            (validParsed?.isLegalDocument && validParsed?.year) ||
                            (validCSL?.type === "legislation" && validCSL.issued); // Check CSL too!
          
          if (score === 0 && !strictMode) {
            const fuzzyScore = jaroWinkler(fail.toLowerCase(), valid.toLowerCase());
            const boosted = (fail.includes(valid) || valid.includes(fail))
              ? Math.min(1.0, fuzzyScore + 0.15)
              : fuzzyScore;
            
            if (boosted > 0.5) {
              score = boosted;
              currMethod = "Fuzzy (Jaro)";
              currExpl = `String similarity: ${(boosted * 100).toFixed(0)}%`;
            }
          }
        } // End else if (!MODE.MANUAL_ONLY)

        if (score > bestScore) {
          bestScore = score;
          bestMatch = valid;
          method = currMethod;
          explanation = currExpl;
        }
      }

      if (bestScore < 0.01) continue;

      // Find Contexts
      const contexts: string[] = [];
      const regex = createCitationRegex(fail);
      
      for (const [path, content] of fileContents.entries()) {
        let m;
        while ((m = regex.exec(content)) !== null) {
          const start = Math.max(0, m.index - 60);
          const end = Math.min(content.length, m.index + m[0].length + 60);
          let snippet = content.substring(start, end).replace(/\n/g, " ");
          snippet = snippet.replace(m[0], `\x1b[1m\x1b[31m${m[0]}\x1b[0m`);
          contexts.push(`   \x1b[36m${path}\x1b[0m:\n     "...${snippet.trim()}..."\n`);
        }
      }

      if (contexts.length > 0) {
        actionableMatches.push({ fail, bestMatch, bestScore, contexts, method, explanation });
      }
    }

    actionableMatches.sort((a, b) => b.bestScore - a.bestScore);

    if (actionableMatches.length === 0) {
      console.log("No actionable citation matches found.");
      return;
    }

    // Reporting Phase
    if (MODE.DRY_RUN) {
      console.log(`\n\x1b[1mCITATION MATCH REPORT\x1b[0m (${actionableMatches.length} suggestions)`);
      console.log("Run with \x1b[1m--fix\x1b[0m to interactively apply changes.");
    } else {
      console.log("\n" + "=".repeat(60));
      console.log("INTERACTIVE CITATION RESOLVER");
      console.log("=".repeat(60));
    }

    const changeLog: string[] = [];

    for (let i = 0; i < actionableMatches.length; i++) {
      const { fail, bestMatch, bestScore, contexts, method, explanation } = actionableMatches[i];

      let label = "\x1b[31mLow \x1b[0m";
      let isHigh = false;
      if (bestScore >= SCORING.HIGH_THRESHOLD) { label = "\x1b[32mHigh\x1b[0m"; isHigh = true; }
      else if (bestScore >= SCORING.MED_THRESHOLD) { label = "\x1b[33mMed \x1b[0m"; }

      await reportMatch([
        "-".repeat(60),
        `${label} Match:  \x1b[31m@${fail}\x1b[0m  ->  \x1b[32m@${bestMatch}\x1b[0m  (Score: ${bestScore.toFixed(2)})`,
        `   Method: ${method} | Reason: ${explanation}`,
        ...contexts
      ]);

      let shouldQueue = false;

      if (MODE.AUTO_HIGH && isHigh) {
        console.log("   -> \x1b[32mAuto-queuing fix\x1b[0m (High Confidence)");
        shouldQueue = true;
      } 
      else if (MODE.AUTO_MANUAL && method === "Manual Override") {
        console.log("   -> \x1b[32mAuto-queuing fix\x1b[0m (Manual Override)");
        shouldQueue = true;
      }
      else if (MODE.INTERACTIVE) {
        const input = promptUser("   Queue fix?", "y/N/q");
        if (input === "y") shouldQueue = true;
        else if (input === "q") {
          await saveSession(fileContents, changeLog);
          Deno.exit(0);
        }
      }

      if (shouldQueue) {
        const regex = createCitationRegex(fail);
        for (const path of fileContents.keys()) {
          let content = fileContents.get(path)!;
          if (regex.test(content)) {
            content = content.replace(regex, `@${bestMatch}`);
            fileContents.set(path, content);
          }
        }
        changeLog.push(`${fail} -> ${bestMatch}`);
      }
    }

    if (changeLog.length > 0) {
      if (MODE.AUTO_HIGH) await saveSession(fileContents, changeLog);
      else if (MODE.INTERACTIVE) {
        if (promptUser("Write all changes to disk?", "y/N") === "y") {
          await saveSession(fileContents, changeLog);
        }
      }
    }

  } catch (err) {
    console.error("Critical Error:", err);
    Deno.exit(1);
  }
}

if (import.meta.main) main();
