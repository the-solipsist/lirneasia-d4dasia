import type { CSLItem } from "../resolve_citations.ts";

export interface CitationFixture {
  fail: string;
  candidates: string[];
  candidateCSL?: Record<string, CSLItem>;
  expectedBest: string | null;
  reason: string;
}

export const FIXTURES: CitationFixture[] = [
  // 1. Legal Document: Exact Year Match + Title Containment (CSL)
  {
    fail: "OnlineSafetyAct2024",
    candidates: ["OnlineSafety2024"],
    candidateCSL: {
      "OnlineSafety2024": {
        id: "OnlineSafety2024",
        type: "legislation",
        title: "Online Safety Act No. 9 of 2024",
        issued: { "date-parts": [[2024]] }
      }
    },
    expectedBest: "OnlineSafety2024",
    reason: "Fail key words found in full CSL title; year matches."
  },

  // 2. Truncation fix: Fail key has 'Digital', Valid key is truncated, but CSL Title has it.
  {
    fail: "bankofthailandDStatementServiceDigital2022",
    candidates: ["bankofthailandDStatementService2022"],
    candidateCSL: {
      "bankofthailandDStatementService2022": {
        id: "bankofthailandDStatementService2022",
        title: "Guideline on D-Statement Service (Digital Bank Statement)",
        issued: { "date-parts": [[2022]] }
      }
    },
    expectedBest: "bankofthailandDStatementService2022",
    reason: "CSL title confirms the missing 'Digital' word from valid key."
  },

  // 3. Normalization: Repeated Year artifact (20202020)
  {
    fail: "AntiTerrorismAct20202020",
    candidates: ["AntiTerrorismAct2020"],
    expectedBest: "AntiTerrorismAct2020",
    reason: "Normalization fixes repeated year."
  },

  // 4. Enrichment: Yearless Key to Dated Law (Real)
  {
    fail: "InformationCommunicationTechnology",
    candidates: ["parliamentofthedemocraticsocialistrepublicofsrilankaInformationCommunication2003"],
    candidateCSL: {
      "parliamentofthedemocraticsocialistrepublicofsrilankaInformationCommunication2003": {
        id: "parliamentofthedemocraticsocialistrepublicofsrilankaInformationCommunication2003",
        title: "Information and Communication Technology Act No. 27 of 2003",
        type: "legislation"
      }
    },
    expectedBest: "parliamentofthedemocraticsocialistrepublicofsrilankaInformationCommunication2003",
    reason: "Enriches yearless title from CSL metadata."
  },

  // 5. STRICT REJECTION: Legal Document Year Mismatch
  {
    fail: "PersonalDataProtection2019",
    candidates: ["PersonalData2022"],
    candidateCSL: {
      "PersonalData2022": {
        id: "PersonalData2022",
        type: "legislation",
        issued: { "date-parts": [[2022]] }
      }
    },
    expectedBest: null,
    reason: "STRICT: 2019 != 2022. Legislation year mismatch is fatal."
  },

  // 6. Fuzzy Match: Non-Legal Document
  {
    fail: "ChamaraSampathNeil2018",
    candidates: ["ChamaraSampath2018"],
    expectedBest: "ChamaraSampath2018",
    reason: "Non-legal doc allows fuzzy fallback."
  }
];
