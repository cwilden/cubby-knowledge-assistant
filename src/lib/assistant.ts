import knowledgeBase from "../../data/portal-content.json";
import { ASSISTANT_STATUS, type AssistantStatus } from "./assistant-status";
import {
  citationsForEvidence,
  createGroundedAnswer,
  createStreamingGroundedAnswer,
} from "./openai";
import type { PortalKnowledgeBase } from "./portal-content";
import { classifyQuestionRisk, QUESTION_RISK } from "./question-risk";
import {
  hasEnoughEvidence,
  retrieveChunks,
  type RetrievalResult,
} from "./retrieval";

export type AssistantCitation = {
  excerpt: string;
  id: string;
  title: string;
  section: string;
  url: string;
};

export type AssistantResponse = {
  status: AssistantStatus;
  answer: string;
  citations: AssistantCitation[];
};

export type AnswerGenerator = (
  question: string,
  evidence: RetrievalResult[],
) => Promise<AssistantResponse>;

export type StreamingAnswerGenerator = (
  question: string,
  evidence: RetrievalResult[],
  onDelta: (delta: string) => void,
) => Promise<AssistantResponse>;

const RELATED_SUPPLIER_RESOURCES = [
  {
    label: "Funding & Insurance",
    url: "https://help.cubbybeds.com/en_us/funding-guide:-insurance-+-medicaid-process-SJ5IpfGGgl",
  },
  {
    label: "Medicaid Resources",
    url: "https://cubbybeds.com/pages/state-requirements",
  },
  {
    label: "Contact Cubby Support",
    url: "https://cubbybeds.com/pages/supplier-portal-contact",
  },
];
const SCOPE_LIMITED_TOPIC_PATTERN =
  /\b(coverage|covered|clinical|diagnosis|eligible|eligibility|insurance|medicaid|medical|patient|payer|policy|qualify|requirements)\b/i;

const portalKnowledgeBase = knowledgeBase as PortalKnowledgeBase;

function relatedResourceLinks() {
  return RELATED_SUPPLIER_RESOURCES.map(
    (resource) => `- [${resource.label}](${resource.url})`,
  ).join("\n");
}

function streamStaticAnswer(answer: string, onDelta: (delta: string) => void) {
  onDelta(answer);
}

function patientSpecificEligibilityAnswer(evidence: RetrievalResult[]): AssistantResponse {
  const stateRequirement = evidence.find((chunk) =>
    chunk.sourceId.startsWith("state-requirements-for-"),
  );
  const requirementScope = stateRequirement
    ? `${stateRequirement.pageTitle} Medicaid supplier requirements`
    : "the relevant Medicaid or payer requirements";

  return {
    status: ASSISTANT_STATUS.patientSpecificEligibility,
    answer: `I can't determine whether a specific patient will be covered based on public supplier documentation alone.

Public supplier documentation can still help prepare the submission:

- Review ${requirementScope}.
- Complete the required prescription and prior authorization forms listed in the source documents.
- Work with the physician and OT/PT to prepare the required Letter of Medical Necessity and supporting documentation.
- Confirm any patient-specific eligibility or documentation requirements with the payer or Cubby before submitting.

These documented requirements do not guarantee approval and shouldn't be interpreted as a coverage determination for a specific patient.`,
    citations: citationsForEvidence([], evidence),
  };
}

function medicalOrClinicalAdviceAnswer(): AssistantResponse {
  return {
    status: ASSISTANT_STATUS.needsMoreContext,
    answer:
      "I can't provide medical or clinical advice. I can help locate Cubby supplier documentation, but clinical decisions should be confirmed with a qualified clinician and Cubby when appropriate.",
    citations: [],
  };
}

export function fallbackAnswer(question = ""): AssistantResponse {
  const scopeExplanation = SCOPE_LIMITED_TOPIC_PATTERN.test(question)
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

export async function answerQuestion(
  question: string,
  generateAnswer: AnswerGenerator = createGroundedAnswer,
): Promise<AssistantResponse> {
  const trimmedQuestion = question.trim();

  if (!trimmedQuestion) {
    return {
      status: ASSISTANT_STATUS.needsMoreContext,
      answer: "Ask a Cubby supplier portal question to get a cited answer.",
      citations: [],
    };
  }

  const questionRisk = classifyQuestionRisk(trimmedQuestion);

  if (questionRisk === QUESTION_RISK.medicalOrClinicalAdvice) {
    return medicalOrClinicalAdviceAnswer();
  }

  if (questionRisk === QUESTION_RISK.patientSpecificEligibility) {
    const evidence = retrieveChunks(trimmedQuestion, portalKnowledgeBase.chunks);

    return patientSpecificEligibilityAnswer(evidence);
  }

  const evidence = retrieveChunks(trimmedQuestion, portalKnowledgeBase.chunks);

  if (!hasEnoughEvidence(evidence)) {
    return fallbackAnswer(trimmedQuestion);
  }

  return generateAnswer(trimmedQuestion, evidence);
}

export async function streamAnswerQuestion(
  question: string,
  onDelta: (delta: string) => void,
  generateAnswer: StreamingAnswerGenerator = createStreamingGroundedAnswer,
): Promise<AssistantResponse> {
  const trimmedQuestion = question.trim();

  if (!trimmedQuestion) {
    const response: AssistantResponse = {
      status: ASSISTANT_STATUS.needsMoreContext,
      answer: "Ask a Cubby supplier portal question to get a cited answer.",
      citations: [],
    };

    streamStaticAnswer(response.answer, onDelta);
    return response;
  }

  const questionRisk = classifyQuestionRisk(trimmedQuestion);

  if (questionRisk === QUESTION_RISK.medicalOrClinicalAdvice) {
    const response = medicalOrClinicalAdviceAnswer();

    streamStaticAnswer(response.answer, onDelta);
    return response;
  }

  if (questionRisk === QUESTION_RISK.patientSpecificEligibility) {
    const evidence = retrieveChunks(trimmedQuestion, portalKnowledgeBase.chunks);
    const response = patientSpecificEligibilityAnswer(evidence);

    streamStaticAnswer(response.answer, onDelta);
    return response;
  }

  const evidence = retrieveChunks(trimmedQuestion, portalKnowledgeBase.chunks);

  if (!hasEnoughEvidence(evidence)) {
    const response = fallbackAnswer(trimmedQuestion);

    streamStaticAnswer(response.answer, onDelta);
    return response;
  }

  return generateAnswer(trimmedQuestion, evidence, onDelta);
}
