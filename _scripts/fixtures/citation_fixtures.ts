export interface CitationFixture {
  fail: string;
  candidates: string[];
  expectedBest: string;
  reason: string;
}

export const FIXTURES: CitationFixture[] = [
  {
    fail: "DigitalGovernmentStrategyFramework",
    candidates: [
      "smithDigitalGovernment2021",
      "smithDigitalHealth2021",
      "jonesDigitalGovernmentPolicy2021"
    ],
    expectedBest: "smithDigitalGovernment2021",
    reason: "3-word failing title collapses to 2-word canonical title; author/year enriched"
  },

  {
    fail: "InformationCommunicationTechnologyPolicy",
    candidates: [
      "InformationCommunicationTechnology2003",
      "InformationTechnologyPolicy2000"
    ],
    expectedBest: "InformationCommunicationTechnology2003",
    reason: "Failing key verbose; valid key canonical and dated"
  },

  {
    fail: "OnlineSafetyBillDraft",
    candidates: [
      "OnlineSafetyAct2024",
      "ChildOnlineProtectionAct2024"
    ],
    expectedBest: "OnlineSafetyAct2024",
    reason: "Title containment + canonical naming"
  },

  {
    fail: "NationalDigitalGovernmentFramework",
    candidates: [
      "NationalDigitalGovernment2022",
      "NationalCyberSecurity2022"
    ],
    expectedBest: "NationalDigitalGovernment2022",
    reason: "Failing title has extra descriptor; valid key shorter and canonical"
  }
];
