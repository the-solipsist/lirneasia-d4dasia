import { join } from "stdlib/path";

const bibPath = "_references/d4dasia-bib.json";
const qmdPath = "reports/np/d4dasia_country-report_np.qmd";
const outputPath = "reports/np/footnote_mapping.csv";

const OTHER_COUNTRIES = ["indonesia", "india", "thailand", "philippines", "philipinnes", "srilanka", "pakistan"];

interface BibItem {
    id: string;
    title?: string;
    author?: any[];
    issued?: { "date-parts"?: number[][] };
}

const bibContent = await Deno.readTextFile(bibPath);
const bib: BibItem[] = JSON.parse(bibContent);

const qmdContent = await Deno.readTextFile(qmdPath);

// 1. Extract footnote definitions
const footnoteDefs = new Map<string, string>();
const defMatches = qmdContent.matchAll(/^\[\^([0-9]+)\]:\s*(.*)/gm);
for (const match of defMatches) {
    footnoteDefs.set(match[1], match[2]);
}

// 2. Map footnotes
const csvRows = ["Footnote,Citation Key 1,Pinpoint,Confidence,Original Content"];

for (const [num, content] of footnoteDefs) {
    const marker = `[^${num}]`;
    const escapedMarker = marker.replace(/[\[\]\^]/g, "\\$&");
    const contextRegex = new RegExp(`(.{0,100})${escapedMarker}`, "g");
    const contextMatch = contextRegex.exec(qmdContent);
    const context = contextMatch ? contextMatch[1] : "";
    
    const combinedSearch = (context + " " + content).toLowerCase();
    const years = combinedSearch.match(/\b(19|20)[0-9]{2}\b/g) || [];

    let bestMatch: BibItem | null = null;
    let bestScore = 0;

    for (let item of bib) {
        const idLower = item.id.toLowerCase();
        
        // --- MANDATORY EXCLUSION ---
        // If the citekey contains another country's name, skip it entirely.
        if (OTHER_COUNTRIES.some(country => idLower.includes(country))) {
            continue;
        }

        let score = 0;
        const title = (item.title || "").toLowerCase();

        // Country bonus for Nepal
        if (idLower.includes("nepal") || title.includes("nepal")) {
            score += 30;
        }

        // Title matching
        const titleWords = title.split(/[^a-z0-9]/).filter(t => t.length > 3);
        let matches = 0;
        for (let word of titleWords) {
            if (combinedSearch.includes(word)) matches++;
        }
        if (titleWords.length > 0) {
            score += (matches / titleWords.length) * 60;
        }

        // Year matching
        const itemYear = item.issued?.["date-parts"]?.[0]?.[0]?.toString();
        if (itemYear && years.includes(itemYear)) {
            score += 40;
        }

        if (score > bestScore) {
            bestScore = score;
            bestMatch = item;
        }
    }

    let pinpoint = "";
    const pinpointMatch = content.match(/\b(Section|Clause|Rule|Page|Schedule|Art\.|Article)\s+[0-9A-Z.]+\b/i);
    if (pinpointMatch) pinpoint = pinpointMatch[0];

    const escapedContent = content.replace(/"/g, '""');
    
    // Confidence threshold
    if (bestMatch && bestScore > 45) {
        csvRows.push(`"${marker}","@${bestMatch.id}","${pinpoint}","${bestScore.toFixed(0)}","${escapedContent}"`);
    } else {
        csvRows.push(`"${marker}","","${pinpoint}","0","${escapedContent}"`);
    }
}

await Deno.writeTextFile(outputPath, csvRows.join("\n"));
console.log(`Mapping CSV written to ${outputPath}`);
