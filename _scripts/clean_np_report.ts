import { join } from "stdlib/path";
import { parse } from "stdlib/flags";

const args = parse(Deno.args, {
  boolean: ["fix"],
  alias: { fix: ["execute", "e"] },
});

const isFixMode = args.fix;
const inputPath = "reports/np/d4dasia_country-report_np.to-clean.md";
const outputPath = "reports/np/d4dasia_country-report_np.qmd";

console.log("- ".repeat(40));
console.log(`🧹 CLEANING NEPAL REPORT`);
console.log(`   Input:  ${inputPath}`);
console.log(`   Mode:   ${isFixMode ? "⚠️  FIX (Writing changes)" : "🔍 DRY RUN"}`);
console.log("- ".repeat(40));

const content = await Deno.readTextFile(inputPath);
const lines = content.split("\n");

const abbreviationsTable = [
    "## List of abbreviations",
    "",
    "```{=html}",
    "<table><tr><td></td><td></td></tr>",
    "<tr><td>API</td><td>Application Programming Interface</td></tr>",
    "<tr><td>BAFIA</td><td>Bank and Financial Institution Act</td></tr>",
    "<tr><td>ESB</td><td>Enterprise Service Bus</td></tr>",
    "<tr><td>ETA</td><td>Electronic Transaction Act</td></tr>",
    "<tr><td>GIDC</td><td>Government Data Center</td></tr>",
    "<tr><td>GRDC</td><td>Government Recovery Data Center</td></tr>",
    "<tr><td>NeGIF</td><td>Nepal E-Government Interoperability Framework</td></tr>",
    "<tr><td>NRB</td><td>Nepal Rastra Bank</td></tr>",
    "<tr><td>RTI</td><td>Right to Information</td></tr>",
    "<tr><td>SOA</td><td>Service Oriented Architecture</td></tr>",
    "</table>",
    "```",
    "",
    "{{< include ../_common/about-this-report.qmd >}}",
    "",
    "{{< include ../_common/introduction.qmd >}}",
    ""
].join("\n");

let result = [abbreviationsTable];

for (let line of lines) {
    let trimmed = line.trim();
    
    // Skip empty lines at the start or metadata-like lines
    if (trimmed === "" && result.length === 1) continue;
    if (line.startsWith("# **Data Governance Framework: Nepal")) continue;
    if (line.includes("Data for Development Asia Project")) continue;

    // 1. Convert List Headings to standard Markdown headings
    // Level 1: "1. **Title:**"
    let h1Match = line.match(/^[0-9]+\.\s+\*\*([^*]+)\*\*:?/);
    if (h1Match) {
        result.push("");
        result.push(`# ${h1Match[1].trim().replace(/:$/, "")}`);
        result.push("");
        continue;
    }

    // Level 2: "   3. **Title:**"
    let h2Match = line.match(/^   [0-9]+\.\s+\*\*([^*]+)\*\*:?/);
    if (h2Match) {
        result.push("");
        result.push(`## ${h2Match[1].trim().replace(/:$/, "")}`);
        result.push("");
        continue;
    }

    // Level 3: "      1. **Title:**"
    let h3Match = line.match(/^      [0-9]+\.\s+\*\*([^*]+)\*\*:?/);
    if (h3Match) {
        result.push("");
        result.push(`### ${h3Match[1].trim().replace(/:$/, "")}`);
        result.push("");
        continue;
    }

    // 2. Strip manual paragraph numbering
    // e.g. "   1. The significance..." -> "The significance..."
    // e.g. "      1. The significance..." -> "The significance..."
    let paraMatch = line.match(/^(\s*)([0-9]+\.)\s+(.*)/);
    if (paraMatch) {
        result.push(paraMatch[3].trim());
        continue;
    }

    // 3. Cleanup indentation from other lines
    if (line.startsWith("   ") || line.startsWith("      ")) {
        result.push(line.trim());
    } else {
        result.push(line);
    }
}

let final = result.join("\n");

// Final cleanup of redundant bolds in headings
final = final.replace(/^(#+)\s+\*\*([^*]+)\*\*/gm, "$1 $2");

if (isFixMode) {
    await Deno.writeTextFile(outputPath, final);
    console.log(`\n✅ Success: Cleaned report written to ${outputPath}`);
} else {
    console.log("\n🔍 PREVIEW (First 60 lines):\n");
    console.log("-".repeat(40));
    console.log(final.split("\n").slice(0, 60).join("\n"));
    console.log("-".repeat(40));
    console.log("\nRun with --fix to apply these changes.");
}
