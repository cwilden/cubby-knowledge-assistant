import { describe, expect, it } from "vitest";
import { citationsFromEvidence } from "./citations";
import type { RetrievalResult } from "./retrieval";

function chunk(overrides: Omit<RetrievalResult, "sourceId">): RetrievalResult {
  return {
    ...overrides,
    sourceId: overrides.id,
  };
}

describe("citation mapping", () => {
  it("includes a concise excerpt from the cited chunk", () => {
    const [citation] = citationsFromEvidence([
      chunk({
        id: "billing-code",
        pageTitle: "Billing Codes & Reimbursement (HCPCS)",
        sectionTitle: "What payers need",
        text: "Cubby Beds typically use E1399 when a payer requires miscellaneous durable medical equipment coding. The rest of the article explains supporting documentation.",
        url: "https://help.cubbybeds.com/billing",
        score: 10,
      }),
    ]);

    expect(citation).toMatchObject({
      excerpt:
        "Cubby Beds typically use E1399 when a payer requires miscellaneous durable medical equipment coding.",
      id: "billing-code",
      section: "What payers need",
      title: "Billing Codes & Reimbursement (HCPCS)",
      url: "https://help.cubbybeds.com/billing",
    });
  });

  it("preserves source identity, order, and citation limits", () => {
    const citations = citationsFromEvidence(
      [
        chunk({
          id: "caregivers",
          pageTitle: "Florida",
          sectionTitle: "For caregivers",
          text: "Caregivers should schedule an appointment and gather required documents.",
          url: "https://cubbybeds.com/pages/state-requirements-for-florida",
          score: 30,
        }),
        chunk({
          id: "doctors",
          pageTitle: "Florida",
          sectionTitle: "For doctors",
          text: "Doctors should complete the Prescription Form and document medical necessity.",
          url: "https://cubbybeds.com/pages/state-requirements-for-florida",
          score: 29,
        }),
      ],
      { limit: 1 },
    );

    expect(citations).toEqual([
      {
        excerpt:
          "Caregivers should schedule an appointment and gather required documents.",
        id: "caregivers",
        section: "For caregivers",
        title: "Florida",
        url: "https://cubbybeds.com/pages/state-requirements-for-florida",
      },
    ]);
  });

  it("deduplicates citations that point to the same article", () => {
    const citations = citationsFromEvidence([
      chunk({
        id: "billing-intro",
        pageTitle: "Billing Codes & Reimbursement (HCPCS)",
        sectionTitle: "Billing Codes & Reimbursement (HCPCS)",
        text: "This article is a starting point for medical suppliers.",
        url: "https://help.cubbybeds.com/en_us/billing-codes-for-cubby-beds-SkRI_gAqel",
        score: 30,
      }),
      chunk({
        id: "billing-reminders",
        pageTitle: "Billing Codes & Reimbursement (HCPCS)",
        sectionTitle: "A few reminders",
        text: "Look for payer-specific guidance before you bill.",
        url: "https://help.cubbybeds.com/en_us/billing-codes-for-cubby-beds-SkRI_gAqel?utm_source=supplier-portal#reminders",
        score: 28,
      }),
      chunk({
        id: "order-form",
        pageTitle: "Ordering",
        sectionTitle: "Order request form",
        text: "Use the order request form to start an order.",
        url: "https://cubbybeds.com/pages/supplier-portal-ordering",
        score: 20,
      }),
    ]);

    expect(citations).toHaveLength(2);
    expect(citations.map((citation) => citation.id)).toEqual([
      "billing-intro",
      "order-form",
    ]);
  });

  it("deduplicates citations that share the same document title", () => {
    const citations = citationsFromEvidence([
      chunk({
        id: "forms-docs-required-insurance-documents",
        pageTitle: "Supplier Portal Funding Docs",
        sectionTitle: "Required insurance documents",
        text: "This includes our prescription form, quick start guide, clinician assessment, LMN guide + safety concerns sheet.",
        url: "https://cubbybeds.com/pages/provider-insurance-documents?utm_source=supplier-portal&utm_content=funding-docs",
        score: 30,
      }),
      chunk({
        id: "forms-docs-funding-resources",
        pageTitle: "Supplier Portal Funding Docs",
        sectionTitle: "Funding resources",
        text: "This includes our manufacturer notices, supportive research and references for authorization submission.",
        url: "https://cubbybeds.com/pages/funding-justification",
        score: 28,
      }),
    ]);

    expect(citations).toHaveLength(1);
    expect(citations[0]?.id).toBe("forms-docs-required-insurance-documents");
  });

  it("does not pad citations with weaker off-topic matches", () => {
    const citations = citationsFromEvidence(
      [
        chunk({
          id: "damage",
          pageTitle: "My order arrived damaged. What do I do?",
          sectionTitle: "My order arrived damaged. What do I do?",
          text: "Document the damage and contact support.",
          url: "https://help.cubbybeds.com/en_us/my-order-arrived-damaged",
          score: 21,
        }),
        chunk({
          id: "defective",
          pageTitle: "What should I do if my Cubby Bed is damaged or defective?",
          sectionTitle: "What should I do if my Cubby Bed is damaged or defective?",
          text: "Report damaged or defective components.",
          url: "https://help.cubbybeds.com/en_us/damaged-or-defective",
          score: 21,
        }),
        chunk({
          id: "order-form",
          pageTitle: "Supplier Portal Ordering",
          sectionTitle: "Order request form",
          text: "Use the order request form to start an order.",
          url: "https://cubbybeds.com/pages/supplier-portal-ordering",
          score: 17,
        }),
        chunk({
          id: "po-number",
          pageTitle: "How do I find my Order Number?",
          sectionTitle: "How do I find my Order Number?",
          text: "Find order number details.",
          url: "https://help.cubbybeds.com/en_us/order-number",
          score: 13,
        }),
      ],
      { strongOnly: true },
    );

    expect(citations.map((citation) => citation.id)).toEqual([
      "damage",
      "defective",
    ]);
  });

  it("can preserve multiple sections from the same article", () => {
    const citations = citationsFromEvidence(
      [
        chunk({
          id: "caregivers",
          pageTitle: "Florida",
          sectionTitle: "For caregivers",
          text: "Caregivers should schedule an appointment and gather required documents.",
          url: "https://cubbybeds.com/pages/state-requirements-for-florida",
          score: 30,
        }),
        chunk({
          id: "doctors",
          pageTitle: "Florida",
          sectionTitle: "For doctors",
          text: "Doctors should complete the Prescription Form and document medical necessity.",
          url: "https://cubbybeds.com/pages/state-requirements-for-florida",
          score: 29,
        }),
      ],
      { dedupeByArticle: false },
    );

    expect(citations.map((citation) => citation.section)).toEqual([
      "For caregivers",
      "For doctors",
    ]);
  });
});
