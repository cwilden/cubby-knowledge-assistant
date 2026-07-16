import { describe, expect, it } from "vitest";
import {
  conservativeDeterministicFallback,
  policyForClassification,
  QUESTION_RISK,
  REASONING_CODE,
} from "./question-risk";

describe("question risk policy", () => {
  it("keeps obvious resource lookups on the general path during outages", () => {
    const classification = conservativeDeterministicFallback(
      "Where can I find the patient safety worksheet?",
    );

    expect(classification.risk).toBe(QUESTION_RISK.generalInformation);
    expect(classification.reasoningCode).toBe(
      REASONING_CODE.generalResourceLookup,
    );
    expect(classification.searchQuery).toBe(
      "Where can I find the patient safety worksheet?",
    );
  });

  it("routes obvious general coverage questions to the high-risk path during outages", () => {
    const classification = conservativeDeterministicFallback(
      "What are Colorado Medicaid requirements?",
    );

    expect(classification.risk).toBe(QUESTION_RISK.highRiskCoverage);
    expect(classification.reasoningCode).toBe(
      REASONING_CODE.generalCoverageGuidance,
    );
  });

  it("keeps typo interpretation out of the outage fallback", () => {
    const classification = conservativeDeterministicFallback(
      "Is my patient coverd?",
    );

    expect(classification.risk).toBe(QUESTION_RISK.generalInformation);
    expect(classification.reasoningCode).toBe(
      REASONING_CODE.generalResourceLookup,
    );
    expect(classification.searchQuery).toBe("Is my patient coverd?");
  });

  it("does not treat documentation follow-ups as patient-specific during outages", () => {
    const classification = conservativeDeterministicFallback(
      "what do i ask the physician for?",
    );

    expect(classification.risk).toBe(QUESTION_RISK.generalInformation);
    expect(classification.reasoningCode).toBe(
      REASONING_CODE.generalResourceLookup,
    );
  });

  it("routes obvious clinical advice questions during outages", () => {
    const classification = conservativeDeterministicFallback(
      "Is this bed medically appropriate for my autistic child?",
    );

    expect(classification.risk).toBe(QUESTION_RISK.medicalOrClinicalAdvice);
    expect(classification.reasoningCode).toBe(
      REASONING_CODE.clinicalRecommendation,
    );
  });

  it("treats low-confidence classifier output as high-risk coverage", () => {
    const classification = policyForClassification({
      clarificationOptions: [],
      clarificationQuestion: "",
      confidence: 0.6,
      isSupplierQuestion: true,
      requiresClarification: false,
      reasoningCode: REASONING_CODE.generalResourceLookup,
      risk: QUESTION_RISK.generalInformation,
      searchQuery: "Colorado Medicaid requirements",
      state: "Colorado",
    });

    expect(classification).toEqual({
      clarificationOptions: [],
      clarificationQuestion: "",
      confidence: 1,
      isSupplierQuestion: true,
      requiresClarification: false,
      reasoningCode: REASONING_CODE.generalCoverageGuidance,
      risk: QUESTION_RISK.highRiskCoverage,
      searchQuery: "Colorado Medicaid requirements",
      state: "Colorado",
    });
  });
});
