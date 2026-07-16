import { ASSISTANT_STATUS } from "./assistant-status";
import type { AssistantResponse } from "./assistant-types";
import { RELATED_SUPPLIER_RESOURCES } from "./cubby-resources";
import { citationsForEvidence } from "./openai";
import type { RetrievalResult } from "./retrieval";

type FallbackAnswerOptions = {
  includeScopeExplanation?: boolean;
};

type ClarificationAnswerOptions = {
  options: string[];
  question: string;
};

function relatedResourceLinks() {
  return RELATED_SUPPLIER_RESOURCES.map(
    (resource) => `- [${resource.label}](${resource.url})`,
  ).join("\n");
}

export function emptyQuestionAnswer(): AssistantResponse {
  return {
    status: ASSISTANT_STATUS.needsMoreContext,
    answer: "Ask a Cubby supplier portal question to get a cited answer.",
    citations: [],
  };
}

export function clarificationAnswer({
  options,
  question,
}: ClarificationAnswerOptions): AssistantResponse {
  const optionList = options.map((option) => `- ${option}`).join("\n");
  const answer = optionList ? `${question}\n\n${optionList}` : question;

  return {
    status: ASSISTANT_STATUS.conversational,
    answer,
    citations: [],
  };
}

export function medicalOrClinicalAdviceAnswer(): AssistantResponse {
  return {
    status: ASSISTANT_STATUS.medicalOrClinicalAdvice,
    answer:
      "I can't provide medical or clinical advice. I can help locate Cubby supplier documentation, but clinical decisions should be confirmed with a qualified clinician and Cubby when appropriate.",
    citations: [],
  };
}

export function patientSpecificEligibilityAnswer(
  stateEvidence: RetrievalResult[],
): AssistantResponse {
  const stateRequirement = stateEvidence[0];
  const requirementScope = stateRequirement
    ? `${stateRequirement.pageTitle} Medicaid supplier requirements`
    : "the relevant Medicaid or payer requirements";
  const relatedResources = stateRequirement
    ? ""
    : `\n\nYou may find these related supplier resources helpful:\n\n${relatedResourceLinks()}`;

  return {
    status: ASSISTANT_STATUS.patientSpecificEligibility,
    answer: `I can't determine whether a specific patient will be covered based on public supplier documentation alone.

Public supplier documentation can still help prepare the submission:

- Review ${requirementScope}.
- Complete the required prescription and prior authorization forms listed in the source documents.
- Work with the physician and OT/PT to prepare the required Letter of Medical Necessity and supporting documentation.
- Confirm any patient-specific eligibility or documentation requirements with the payer or Cubby before submitting.

These documented requirements do not guarantee approval and shouldn't be interpreted as a coverage determination for a specific patient.${relatedResources}`,
    citations: citationsForEvidence([], stateEvidence),
  };
}

export function fallbackAnswer({
  includeScopeExplanation = false,
}: FallbackAnswerOptions = {}): AssistantResponse {
  const scopeExplanation = includeScopeExplanation
    ? "\n\nQuestions about insurance coverage may depend on patient-specific clinical information, payer policies, and state requirements, which are outside the scope of this prototype."
    : "";

  return {
    status: ASSISTANT_STATUS.needsMoreContext,
    answer: `I couldn't find documentation in the Cubby Supplier Portal that answers this question confidently.${scopeExplanation}

You may find these related supplier resources helpful:

${relatedResourceLinks()}`,
    citations: [],
  };
}
