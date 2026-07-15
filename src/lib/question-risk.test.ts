import { describe, expect, it } from "vitest";
import { classifyQuestionRisk, QUESTION_RISK } from "./question-risk";

describe("question risk classifier", () => {
  it.each([
    "Is the Cubby Bed covered for an 8-year-old with epilepsy in Colorado?",
    "Will Medicaid approve this for my 7-year-old with autism in Florida?",
  ])("classifies patient-specific eligibility questions: %s", (question) => {
    expect(classifyQuestionRisk(question)).toBe(
      QUESTION_RISK.patientSpecificEligibility,
    );
  });

  it("keeps general state requirement questions out of the patient-specific path", () => {
    expect(
      classifyQuestionRisk(
        "What are the Florida Medicaid requirements for Cubby Bed coverage?",
      ),
    ).toBe(QUESTION_RISK.highRiskCoverage);
  });

  it("classifies ordinary supplier questions as general information", () => {
    expect(
      classifyQuestionRisk("What billing code should I use for the Cubby Bed?"),
    ).toBe(QUESTION_RISK.generalInformation);
  });

  it("classifies medical advice requests separately", () => {
    expect(classifyQuestionRisk("Is this bed safe for seizures?")).toBe(
      QUESTION_RISK.medicalOrClinicalAdvice,
    );
  });
});
