import { describe, expect, it } from "vitest";
import { citationsForEvidence } from "./openai";
import type { RetrievalResult } from "./retrieval";

describe("OpenAI citation selection", () => {
  it("preserves state Medicaid role sections from the same page", () => {
    const citations = citationsForEvidence([], [
      {
        id: "florida-caregivers",
        pageTitle: "Florida",
        sectionTitle: "For caregivers",
        text: "Caregivers should schedule an appointment and gather required documents.",
        url: "https://cubbybeds.com/pages/state-requirements-for-florida",
        score: 30,
      },
      {
        id: "florida-doctors",
        pageTitle: "Florida",
        sectionTitle: "For doctors",
        text: "Doctors should complete the Prescription Form and document medical necessity.",
        url: "https://cubbybeds.com/pages/state-requirements-for-florida",
        score: 29,
      },
      {
        id: "florida-ot-pt",
        pageTitle: "Florida",
        sectionTitle: "For OT/PT",
        text: "OTs and PTs should write a Letter of Medical Necessity when possible.",
        url: "https://cubbybeds.com/pages/state-requirements-for-florida",
        score: 28,
      },
      {
        id: "florida-supplier",
        pageTitle: "Florida",
        sectionTitle: "For medical supplier",
        text: "Medical suppliers should confirm documents and submit the request to Medicaid.",
        url: "https://cubbybeds.com/pages/state-requirements-for-florida",
        score: 27,
      },
    ] satisfies RetrievalResult[]);

    expect(citations.map((citation) => citation.section)).toEqual([
      "For caregivers",
      "For doctors",
      "For OT/PT",
      "For medical supplier",
    ]);
  });
});
