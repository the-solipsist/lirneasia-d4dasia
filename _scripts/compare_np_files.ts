const mdPath = "reports/np/d4dasia_country-report_np.to-clean.md";
const qmdPath = "reports/np/d4dasia_country-report_np.qmd";

const md = await Deno.readTextFile(mdPath);
const qmd = await Deno.readTextFile(qmdPath);

function normalize(text: string) {
    return text
        .toLowerCase()
        .replace(/^[0-9]+\.\s+/gm, "")
        .replace(/^\s+[0-9]+\.\s+/gm, "")
        .replace(/\*\*/g, "")
        .replace(/#/g, "")
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

// Avoid complex regex in split for stability
const mdParagraphs = md.split("\n\n").map(p => p.trim()).filter(p => p.length > 50);
const qmdContent = normalize(qmd);

console.log(`Checking ${mdParagraphs.length} substantial paragraphs from source...`);

let missingCount = 0;
for (const p of mdParagraphs) {
    // Skip the title line
    if (p.startsWith("# **Data Governance Framework: Nepal")) continue;
    if (p.includes("Data for Development Asia Project")) continue;

    const normP = normalize(p);
    const fingerprint = normP.substring(0, 50);
    
    if (fingerprint && !qmdContent.includes(fingerprint)) {
        // Double check with a middle fingerprint in case of heading split
        const midPoint = Math.floor(normP.length / 2);
        const midFingerprint = normP.substring(midPoint, midPoint + 50);
        
        if (!qmdContent.includes(midFingerprint)) {
            console.log("\n❌ POTENTIALLY MISSING CONTENT:");
            console.log(`SOURCE: "${p.substring(0, 300)}..."`);
            missingCount++;
        }
    }
}

if (missingCount === 0) {
    console.log("\n✅ No missing substantive paragraphs found.");
} else {
    console.log(`\n⚠️ Found ${missingCount} potentially missing sections.`);
}
