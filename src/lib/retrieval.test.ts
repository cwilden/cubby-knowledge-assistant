import { describe, expect, it } from "vitest";
import knowledgeBase from "../../data/portal-content.json";
import { hasEnoughEvidence, retrieveChunks } from "./retrieval";
import type { PortalKnowledgeBase } from "./portal-content";

const chunks = (knowledgeBase as PortalKnowledgeBase).chunks;

describe("retrieval quality", () => {
  it("retrieves the billing code article for natural-language billing questions", () => {
    const results = retrieveChunks(
      "What billing code should I use for the Cubby Bed?",
      chunks,
    );

    expect(results[0]?.id).toContain("billing-code");
    expect(results.some((result) => result.text.includes("E1399"))).toBe(true);
    expect(results[0]?.url).toContain("billing-codes");
    expect(hasEnoughEvidence(results)).toBe(true);
  });

  it("retrieves ordering resources for order form questions", () => {
    const results = retrieveChunks("Where is the order request form?", chunks);

    expect(results[0]?.id).toContain("order-request-form");
    expect(results[0]?.pageTitle).toContain("Ordering");
    expect(hasEnoughEvidence(results)).toBe(true);
  });

  it("prioritizes state-specific Medicaid accordion sections", () => {
    const results = retrieveChunks(
      "What are the Florida Medicaid requirements for Cubby Bed coverage?",
      chunks,
    );

    expect(results.map((result) => result.sectionTitle)).toEqual(
      expect.arrayContaining([
        "For caregivers",
        "For doctors",
        "For OT/PT",
        "For medical supplier",
      ]),
    );
    expect(
      results.every(
        (result) =>
          !result.sourceId.startsWith("state-requirements-for-") ||
          result.sourceId === "state-requirements-for-florida",
      ),
    ).toBe(true);
    expect(hasEnoughEvidence(results)).toBe(true);
  });

  it("treats unrelated questions as weak evidence", () => {
    const results = retrieveChunks(
      "What is the best hiking trail near Denver?",
      chunks,
    );

    expect(hasEnoughEvidence(results)).toBe(false);
  });

  it("indexes collapsed state Medicaid accordion requirements", () => {
    const floridaRequirements = chunks.filter(
      (chunk) => chunk.sourceId === "state-requirements-for-florida",
    );

    expect(
      floridaRequirements.map((chunk) => chunk.sectionTitle),
    ).toEqual(
      expect.arrayContaining([
        "For caregivers",
        "For doctors",
        "For OT/PT",
        "For medical supplier",
      ]),
    );
    expect(
      floridaRequirements
        .find((chunk) => chunk.sectionTitle === "For caregivers")
        ?.text,
    ).toContain("Confirm they’ve received all the necessary documents");
  });
});
