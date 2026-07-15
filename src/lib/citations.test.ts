import { describe, expect, it } from "vitest";
import { citationsFromEvidence } from "./citations";
import type { RetrievalResult } from "./retrieval";

describe("citation mapping", () => {
  it("includes a concise excerpt from the cited chunk", () => {
    const [citation] = citationsFromEvidence([
      {
        id: "billing-code",
        pageTitle: "Billing Codes & Reimbursement (HCPCS)",
        sectionTitle: "What payers need",
        text: "Cubby Beds typically use E1399 when a payer requires miscellaneous durable medical equipment coding. The rest of the article explains supporting documentation.",
        url: "https://help.cubbybeds.com/billing",
        score: 10,
      } satisfies RetrievalResult,
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
        {
          id: "caregivers",
          pageTitle: "Florida",
          sectionTitle: "For caregivers",
          text: "Caregivers should schedule an appointment and gather required documents.",
          url: "https://cubbybeds.com/pages/state-requirements-for-florida",
          score: 30,
        },
        {
          id: "doctors",
          pageTitle: "Florida",
          sectionTitle: "For doctors",
          text: "Doctors should complete the Prescription Form and document medical necessity.",
          url: "https://cubbybeds.com/pages/state-requirements-for-florida",
          score: 29,
        },
      ] satisfies RetrievalResult[],
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
      {
        id: "billing-intro",
        pageTitle: "Billing Codes & Reimbursement (HCPCS)",
        sectionTitle: "Billing Codes & Reimbursement (HCPCS)",
        text: "This article is a starting point for medical suppliers.",
        url: "https://help.cubbybeds.com/en_us/billing-codes-for-cubby-beds-SkRI_gAqel",
        score: 30,
      },
      {
        id: "billing-reminders",
        pageTitle: "Billing Codes & Reimbursement (HCPCS)",
        sectionTitle: "A few reminders",
        text: "Look for payer-specific guidance before you bill.",
        url: "https://help.cubbybeds.com/en_us/billing-codes-for-cubby-beds-SkRI_gAqel?utm_source=supplier-portal#reminders",
        score: 28,
      },
      {
        id: "order-form",
        pageTitle: "Ordering",
        sectionTitle: "Order request form",
        text: "Use the order request form to start an order.",
        url: "https://cubbybeds.com/pages/supplier-portal-ordering",
        score: 20,
      },
    ] satisfies RetrievalResult[]);

    expect(citations).toHaveLength(2);
    expect(citations.map((citation) => citation.id)).toEqual([
      "billing-intro",
      "order-form",
    ]);
  });

  it("can preserve multiple sections from the same article", () => {
    const citations = citationsFromEvidence(
      [
        {
          id: "caregivers",
          pageTitle: "Florida",
          sectionTitle: "For caregivers",
          text: "Caregivers should schedule an appointment and gather required documents.",
          url: "https://cubbybeds.com/pages/state-requirements-for-florida",
          score: 30,
        },
        {
          id: "doctors",
          pageTitle: "Florida",
          sectionTitle: "For doctors",
          text: "Doctors should complete the Prescription Form and document medical necessity.",
          url: "https://cubbybeds.com/pages/state-requirements-for-florida",
          score: 29,
        },
      ] satisfies RetrievalResult[],
      { dedupeByArticle: false },
    );

    expect(citations.map((citation) => citation.section)).toEqual([
      "For caregivers",
      "For doctors",
    ]);
  });
});
