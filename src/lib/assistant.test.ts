import { describe, expect, it, vi } from "vitest";
import { answerQuestion, streamAnswerQuestion } from "./assistant";
import { ASSISTANT_STATUS } from "./assistant-status";

describe("answer guardrails", () => {
  const unsafeEligibilityClaims =
    /\b(can be covered|coverage is possible if|eligible|is covered)\b/i;

  it("does not call the LLM when retrieval evidence is weak", async () => {
    const generateAnswer = vi.fn();

    const response = await answerQuestion(
      "What is the best hiking trail near Denver?",
      generateAnswer,
    );

    expect(generateAnswer).not.toHaveBeenCalled();
    expect(response.status).toBe(ASSISTANT_STATUS.needsMoreContext);
    expect(response.answer).toContain(
      "couldn't find documentation in the Cubby Supplier Portal",
    );
    expect(response.citations).toEqual([]);
  });

  it("blocks patient-specific approval questions without calling the LLM", async () => {
    const generateAnswer = vi.fn();

    const response = await answerQuestion(
      "Will Medicaid cover this for my patient's diagnosis?",
      generateAnswer,
    );

    expect(generateAnswer).not.toHaveBeenCalled();
    expect(response.status).toBe(ASSISTANT_STATUS.patientSpecificEligibility);
    expect(response.answer).toContain(
      "can't determine whether a specific patient will be covered",
    );
    expect(response.answer).toContain("Public supplier documentation");
    expect(response.answer).toContain("do not guarantee approval");
    expect(response.answer).toContain("coverage determination");
    expect(response.answer).not.toMatch(unsafeEligibilityClaims);
  });

  it.each([
    "Is the Cubby Bed covered for an 8-year-old with epilepsy in Colorado?",
    "Will Medicaid approve this for my 7-year-old with autism in Florida?",
  ])(
    "returns a safe cited response for patient-specific eligibility: %s",
    async (question) => {
      const generateAnswer = vi.fn();

      const response = await answerQuestion(question, generateAnswer);

      expect(generateAnswer).not.toHaveBeenCalled();
      expect(response.status).toBe(ASSISTANT_STATUS.patientSpecificEligibility);
      expect(response.answer).toContain(
        "can't determine whether a specific patient will be covered",
      );
      expect(response.answer).toContain("Public supplier documentation");
      expect(response.answer).toContain("do not guarantee approval");
      expect(response.answer).toContain("coverage determination");
      expect(response.answer).not.toMatch(unsafeEligibilityClaims);
      expect(response.citations.length).toBeGreaterThan(0);
      expect(
        response.citations.every((citation) =>
          citation.url.includes("cubbybeds.com"),
        ),
      ).toBe(true);
    },
  );

  it("refuses blank questions without citations", async () => {
    const generateAnswer = vi.fn();

    const response = await answerQuestion("   ", generateAnswer);

    expect(generateAnswer).not.toHaveBeenCalled();
    expect(response.status).toBe(ASSISTANT_STATUS.needsMoreContext);
    expect(response.citations).toEqual([]);
  });

  it("passes strong evidence to the answer generator", async () => {
    const generateAnswer = vi.fn().mockResolvedValue({
      status: ASSISTANT_STATUS.answered,
      answer: "Use the billing code resource.",
      citations: [],
    });

    await answerQuestion(
      "What billing code should I use for the Cubby Bed?",
      generateAnswer,
    );

    expect(generateAnswer).toHaveBeenCalledOnce();
    expect(generateAnswer.mock.calls[0][1][0].id).toContain("billing-code");
  });

  it("passes state-specific Medicaid requirement sections to the answer generator", async () => {
    const generateAnswer = vi.fn().mockResolvedValue({
      status: ASSISTANT_STATUS.answered,
      answer: "Use the Florida Medicaid requirement sections.",
      citations: [],
    });

    await answerQuestion(
      "What are the Florida Medicaid requirements for Cubby Bed coverage?",
      generateAnswer,
    );

    const evidenceSections = generateAnswer.mock.calls[0][1].map(
      (chunk) => chunk.sectionTitle,
    );

    expect(evidenceSections).toEqual(
      expect.arrayContaining([
        "For caregivers",
        "For doctors",
        "For OT/PT",
        "For medical supplier",
      ]),
    );
  });

  it("streams weak-evidence refusals without calling the LLM", async () => {
    const generateAnswer = vi.fn();
    const deltas: string[] = [];

    const response = await streamAnswerQuestion(
      "What is the best hiking trail near Denver?",
      (delta) => deltas.push(delta),
      generateAnswer,
    );

    expect(generateAnswer).not.toHaveBeenCalled();
    expect(response.status).toBe(ASSISTANT_STATUS.needsMoreContext);
    expect(deltas.join("")).toBe(response.answer);
    expect(response.citations).toEqual([]);
  });
});
