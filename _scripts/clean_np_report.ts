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
console.log(`🧹 CLEANING NEPAL REPORT (FIXING ORPHANED MARKERS)`);
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
    if (trimmed === "" && result.length === 1) continue;
    if (line.startsWith("# **Data Governance Framework: Nepal")) continue;
    if (line.includes("Data for Development Asia Project")) continue;

    // Detect list-heading pattern
    const listHeadingMatch = line.match(/^(\s*)[0-9]+\.\s+\*\*(.*)/);
    if (listHeadingMatch) {
        const indent = listHeadingMatch[1].length;
        const fullContent = listHeadingMatch[0].replace(/^\s*[0-9]+\.\s+/, "");
        
        // Split at the first colon that appears after at least one bold marker set
        // Usually titles are "**Title:** Body"
        const firstColonIndex = fullContent.indexOf(":");
        
        let title = "";
        let body = "";
        
        if (firstColonIndex !== -1) {
            title = fullContent.substring(0, firstColonIndex).trim();
            body = fullContent.substring(firstColonIndex + 1).trim();
            
            // Clean up title: remove all asterisks
            title = title.replace(/\*/g, "");
            
            // Clean up body: remove any leading orphaned asterisks or formatting residue
            body = body.replace(/^[*:\s]+/, "");
        } else {
            title = fullContent.replace(/\*/g, "").trim();
        }
        
        let level = 1;
        if (indent >= 6) level = 3;
        else if (indent >= 3) level = 2;
        
        result.push("");
        result.push("#".repeat(level) + " " + title);
        result.push("");
        if (body) result.push(body);
        continue;
    }

    // Strip remaining simple list markers
    let paraMatch = line.match(/^(\s*)([0-9]+\.)\s+(.*)/);
    if (paraMatch) {
        result.push(paraMatch[3].trim());
        continue;
    }

    // Standard line cleanup
    if (line.startsWith("   ") || line.startsWith("      ")) {
        result.push(line.trim());
    } else {
        result.push(line);
    }
}

let final = result.join("\n");

// Final sweep for redundant newlines
final = final.replace(/\n{3,}/g, "\n\n");

if (isFixMode) {
    await Deno.writeTextFile(outputPath, final);
    console.log(`\n✅ Success: Refined report written to ${outputPath}`);
} else {
    console.log("\n🔍 PREVIEW (Checking Social Networks section):\n");
    console.log("-".repeat(40));
    const finalLines = final.split("\n");
    const idx = finalLines.findIndex(l => l.includes("Directives for Managing the Use of Social Networks"));
    if (idx !== -1) {
        console.log(finalLines.slice(idx - 1, idx + 5).join("\n"));
    }
    console.log("-".repeat(40));
    console.log("\nRun with --fix to apply.");
}
