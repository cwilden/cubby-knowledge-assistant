import { describe, expect, it } from "vitest";
import { __openAITestUtils, citationsForEvidence } from "./openai";
import type { RetrievalResult } from "./retrieval";

function chunk(overrides: Omit<RetrievalResult, "sourceId">): RetrievalResult {
  return {
    ...overrides,
    sourceId: "state-requirements-for-florida",
  };
}

describe("OpenAI citation selection", () => {
  it("collapses state Medicaid role sections into one page citation", () => {
    const citations = citationsForEvidence([], [
      chunk({
        id: "florida-caregivers",
        pageTitle: "Florida",
        sectionTitle: "For caregivers",
        text: "Caregivers should schedule an appointment and gather required documents.",
        url: "https://cubbybeds.com/pages/state-requirements-for-florida",
        score: 30,
      }),
      chunk({
        id: "florida-doctors",
        pageTitle: "Florida",
        sectionTitle: "For doctors",
        text: "Doctors should complete the Prescription Form and document medical necessity.",
        url: "https://cubbybeds.com/pages/state-requirements-for-florida",
        score: 29,
      }),
      chunk({
        id: "florida-ot-pt",
        pageTitle: "Florida",
        sectionTitle: "For OT/PT",
        text: "OTs and PTs should write a Letter of Medical Necessity when possible.",
        url: "https://cubbybeds.com/pages/state-requirements-for-florida",
        score: 28,
      }),
      chunk({
        id: "florida-supplier",
        pageTitle: "Florida",
        sectionTitle: "For medical supplier",
        text: "Medical suppliers should confirm documents and submit the request to Medicaid.",
        url: "https://cubbybeds.com/pages/state-requirements-for-florida",
        score: 27,
      }),
    ]);

    expect(citations).toEqual([
      {
        excerpt: "",
        id: "state-requirements-for-florida",
        section: "Florida",
        title: "Florida",
        url: "https://cubbybeds.com/pages/state-requirements-for-florida",
      },
    ]);
  });
});

describe("OpenAI answer cleanup", () => {
  it("removes user-requested role adoption generically", () => {
    expect(
      __openAITestUtils.cleanAnswer(
        "As a senior procurement reviewer, Cubby Beds typically use E1399 when a payer requires miscellaneous durable medical equipment coding.",
      ),
    ).toBe(
      "Cubby Beds typically use E1399 when a payer requires miscellaneous durable medical equipment coding.",
    );
    expect(
      __openAITestUtils.cleanAnswer(
        "As the person approving this request, the key documents you need to receive include the prescription form and LMN.",
      ),
    ).toBe(
      "The key documents you need to receive include the prescription form and LMN.",
    );
    expect(
      __openAITestUtils.cleanAnswer(
        "You need to share these documents with me as your assigned reviewer: prescription and LMN.",
      ),
    ).toBe("You need to share these documents: prescription and LMN.");
  });
});
