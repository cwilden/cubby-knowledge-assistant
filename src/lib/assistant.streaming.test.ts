import { describe, expect, it, vi } from "vitest";
import { answerQuestion, streamAnswerQuestion } from "./assistant";
import { ASSISTANT_STATUS } from "./assistant-status";
import {
  QUESTION_RISK,
  REASONING_CODE,
  type QuestionClassification,
} from "./question-risk";

const generalInformation: QuestionClassification = {
  clarificationOptions: [],
  clarificationQuestion: "",
  confidence: 1,
  isSupplierQuestion: true,
  requiresClarification: false,
  reasoningCode: REASONING_CODE.generalResourceLookup,
  risk: QUESTION_RISK.generalInformation,
  searchQuery: "",
};

const patientSpecificEligibility: QuestionClassification = {
  ...generalInformation,
  reasoningCode: REASONING_CODE.individualCoverageDecision,
  risk: QUESTION_RISK.patientSpecificEligibility,
};

function classifier(classification: QuestionClassification) {
  return vi.fn().mockResolvedValue(classification);
}

describe("streaming answer parity", () => {
  it("matches non-streaming policy for patient-specific eligibility with state evidence", async () => {
    const classify = classifier({
      ...patientSpecificEligibility,
      searchQuery: "Colorado Medicaid requirements",
      state: "Colorado",
    });
    const streamDeltas: string[] = [];

    const nonStreaming = await answerQuestion(
      "Is the Cubby Bed covered for an 8-year-old with epilepsy in Colorado?",
      { classify },
    );
    const streaming = await streamAnswerQuestion(
      "Is the Cubby Bed covered for an 8-year-old with epilepsy in Colorado?",
      (delta) => streamDeltas.push(delta),
      { classify },
    );

    expect(streaming.status).toBe(nonStreaming.status);
    expect(streaming.citations).toEqual(nonStreaming.citations);
    expect(streamDeltas.join("")).toBe(streaming.answer);
  });

  it("matches non-streaming policy for vague patient eligibility with no citations", async () => {
    const classify = classifier({
      ...patientSpecificEligibility,
      searchQuery: "patient coverage eligibility insurance Medicaid requirements",
    });
    const streamDeltas: string[] = [];

    const nonStreaming = await answerQuestion("Is my patient coverd?", {
      classify,
    });
    const streaming = await streamAnswerQuestion(
      "Is my patient coverd?",
      (delta) => streamDeltas.push(delta),
      { classify },
    );

    expect(streaming.status).toBe(nonStreaming.status);
    expect(streaming.citations).toEqual([]);
    expect(streaming.citations).toEqual(nonStreaming.citations);
    expect(streamDeltas.join("")).toBe(streaming.answer);
  });

  it("matches non-streaming policy for ambiguous topic clarification", async () => {
    const classify = classifier({
      ...generalInformation,
      clarificationOptions: ["Billing codes", "Billing documentation"],
      clarificationQuestion: "Which billing topic do you need help with?",
      requiresClarification: true,
      searchQuery: "Billing",
    });
    const streamDeltas: string[] = [];

    const nonStreaming = await answerQuestion("Billing", { classify });
    const streaming = await streamAnswerQuestion(
      "Billing",
      (delta) => streamDeltas.push(delta),
      { classify },
    );

    expect(streaming.status).toBe(nonStreaming.status);
    expect(streaming.citations).toEqual(nonStreaming.citations);
    expect(streaming.answer).toContain("Which billing topic");
    expect(streamDeltas.join("")).toBe(streaming.answer);
  });

  it("matches non-streaming policy for medical advice refusals", async () => {
    const classify = classifier({
      ...generalInformation,
      reasoningCode: REASONING_CODE.clinicalRecommendation,
      risk: QUESTION_RISK.medicalOrClinicalAdvice,
      searchQuery: "medical clinical advice Cubby Bed",
    });
    const streamDeltas: string[] = [];

    const nonStreaming = await answerQuestion("Should this patient have a Cubby Bed?", {
      classify,
    });
    const streaming = await streamAnswerQuestion(
      "Should this patient have a Cubby Bed?",
      (delta) => streamDeltas.push(delta),
      { classify },
    );

    expect(streaming.status).toBe(nonStreaming.status);
    expect(streaming.status).toBe(ASSISTANT_STATUS.medicalOrClinicalAdvice);
    expect(streaming.citations).toEqual(nonStreaming.citations);
    expect(streamDeltas.join("")).toBe(streaming.answer);
  });
});
