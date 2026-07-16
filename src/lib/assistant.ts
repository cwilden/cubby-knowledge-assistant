import knowledgeBase from "../../data/portal-content.json";
import {
  clarificationAnswer,
  emptyQuestionAnswer,
  fallbackAnswer,
  medicalOrClinicalAdviceAnswer,
  patientSpecificEligibilityAnswer,
} from "./assistant-responses";
import type { AssistantResponse } from "./assistant-types";
import { STATE_REQUIREMENT_SOURCE_PREFIX } from "./cubby-resources";
import {
  createConversationalAnswer,
  createGroundedAnswer,
  createStreamingGroundedAnswer,
} from "./openai";
import type { PortalChunk, PortalKnowledgeBase } from "./portal-content";
import {
  classifyQuestion,
  QUESTION_RISK,
  type QuestionClassification,
} from "./question-risk";
import {
  hasEnoughEvidence,
  MIN_RETRIEVAL_EVIDENCE_SCORE,
  retrieveChunks,
  type RetrievalResult,
} from "./retrieval";

export type AnswerGenerator = (
  question: string,
  evidence: RetrievalResult[],
) => Promise<AssistantResponse>;

export type StreamingAnswerGenerator = (
  question: string,
  evidence: RetrievalResult[],
  onDelta: (delta: string) => void,
) => Promise<AssistantResponse>;

type ConversationalAnswerGenerator = (
  question: string,
  context?: string,
) => Promise<AssistantResponse>;

type QuestionClassifier = (
  question: string,
  context?: string,
) => Promise<QuestionClassification>;

type AnswerOptions = {
  classify?: QuestionClassifier;
  context?: string;
  generateConversation?: ConversationalAnswerGenerator;
  generateAnswer?: AnswerGenerator;
};

type StreamingAnswerOptions = {
  classify?: QuestionClassifier;
  context?: string;
  generateConversation?: ConversationalAnswerGenerator;
  generateAnswer?: StreamingAnswerGenerator;
};

type AssistantResolution =
  | {
      response: AssistantResponse;
      type: "static";
    }
  | {
      evidence: RetrievalResult[];
      question: string;
      type: "grounded";
    }
  | {
      context: string;
      question: string;
      type: "conversational";
    };

type ClarificationFollowUp =
  | {
      type: "none";
    }
  | {
      option: string;
      type: "selected";
    }
  | {
      options: string[];
      type: "needsSelection";
    };

const portalKnowledgeBase = knowledgeBase as PortalKnowledgeBase;
const CLARIFICATION_EVIDENCE_SCORE_RATIO = 0.6;
const GENERATION_EVIDENCE_SCORE_RATIO = 0.5;
const MEANINGFUL_TEXT_PATTERN = /[a-z0-9]/i;
const ASSISTANT_CONTEXT_LABEL = "Assistant:";
const CLARIFICATION_OPTION_PREFIX = "- ";
const AFFIRMATIVE_FOLLOW_UPS = new Set([
  "yes",
  "yeah",
  "yep",
  "sure",
  "ok",
  "okay",
  "please",
  "that one",
  "sounds good",
]);
const ORDINAL_SELECTIONS = new Map([
  ["first", 0],
  ["second", 1],
  ["third", 2],
  ["fourth", 3],
  ["fifth", 4],
]);

export type { AssistantCitation, AssistantResponse } from "./assistant-types";

function questionWithContext(question: string, context = "") {
  if (!context.trim()) {
    return question;
  }

  return `Recent conversation context:
${context}

Current user question:
${question}`;
}

function streamStaticAnswer(answer: string, onDelta: (delta: string) => void) {
  onDelta(answer);
}

function hasMeaningfulText(question: string) {
  return MEANINGFUL_TEXT_PATTERN.test(question);
}

function normalizeDialogueReply(reply: string) {
  return reply
    .toLowerCase()
    .replaceAll(/[^a-z0-9\s]/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function lastAssistantContextMessage(context: string) {
  const start = context.lastIndexOf(ASSISTANT_CONTEXT_LABEL);

  if (start < 0) {
    return "";
  }

  return context.slice(start + ASSISTANT_CONTEXT_LABEL.length).trim();
}

function clarificationOptionsFromContext(context: string) {
  return lastAssistantContextMessage(context)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith(CLARIFICATION_OPTION_PREFIX))
    .map((line) => line.slice(CLARIFICATION_OPTION_PREFIX.length).trim())
    .filter(Boolean);
}

function selectedOptionIndex(reply: string, optionCount: number) {
  const normalizedReply = normalizeDialogueReply(reply);
  const numericSelection = Number.parseInt(normalizedReply, 10);

  if (
    Number.isInteger(numericSelection) &&
    numericSelection >= 1 &&
    numericSelection <= optionCount
  ) {
    return numericSelection - 1;
  }

  const ordinalSelection = ORDINAL_SELECTIONS.get(normalizedReply);

  if (
    ordinalSelection !== undefined &&
    ordinalSelection >= 0 &&
    ordinalSelection < optionCount
  ) {
    return ordinalSelection;
  }

  return undefined;
}

function optionForRepeatedTopic(reply: string, options: string[]) {
  if (!normalizeDialogueReply(reply)) {
    return undefined;
  }

  const optionChunks: PortalChunk[] = options.map((option, index) => ({
    id: `clarification-option-${index}`,
    pageTitle: option,
    sectionTitle: option,
    sourceId: `clarification-option-${index}`,
    text: option,
    url: "",
  }));
  const [matchedOption] = retrieveChunks(reply, optionChunks, 1);

  if (!matchedOption || !hasEnoughEvidence([matchedOption])) {
    return undefined;
  }

  return matchedOption.pageTitle;
}

function resolveClarificationFollowUp(
  question: string,
  context: string,
): ClarificationFollowUp {
  const options = clarificationOptionsFromContext(context);

  if (options.length === 0) {
    return { type: "none" };
  }

  const optionIndex = selectedOptionIndex(question, options.length);

  if (optionIndex !== undefined) {
    return {
      option: options[optionIndex],
      type: "selected",
    };
  }

  const repeatedTopicOption = optionForRepeatedTopic(question, options);

  if (repeatedTopicOption) {
    return {
      option: repeatedTopicOption,
      type: "selected",
    };
  }

  if (!AFFIRMATIVE_FOLLOW_UPS.has(normalizeDialogueReply(question))) {
    return { type: "none" };
  }

  if (options.length === 1) {
    return {
      option: options[0],
      type: "selected",
    };
  }

  return {
    options,
    type: "needsSelection",
  };
}

function stateRequirementEvidence(evidence: RetrievalResult[]) {
  return evidence.filter((chunk) =>
    chunk.sourceId.startsWith(STATE_REQUIREMENT_SOURCE_PREFIX),
  );
}

function retrievalQuery(question: string, classification: QuestionClassification) {
  const normalizedQuery = classification.searchQuery.trim() || question;

  return [normalizedQuery, classification.state, classification.payer]
    .filter(Boolean)
    .join(" ");
}

function evidenceMatchesClassification(
  evidence: RetrievalResult[],
  classification: QuestionClassification,
) {
  if (classification.state && stateRequirementEvidence(evidence).length === 0) {
    return false;
  }

  if (!classification.payer) {
    return true;
  }

  const payer = classification.payer.toLowerCase();

  return evidence.some((chunk) =>
    `${chunk.pageTitle} ${chunk.sectionTitle} ${chunk.text}`
      .toLowerCase()
      .includes(payer),
  );
}

function retrieveEvidence(
  question: string,
  classification: QuestionClassification,
) {
  return retrieveChunks(
    retrievalQuery(question, classification),
    portalKnowledgeBase.chunks,
  );
}

function focusEvidence(
  evidence: RetrievalResult[],
  scoreRatio: number,
) {
  const topScore = evidence[0]?.score;

  if (!topScore) {
    return [];
  }

  const minimumScore = Math.max(
    MIN_RETRIEVAL_EVIDENCE_SCORE,
    topScore * scoreRatio,
  );

  return evidence.filter((chunk) => chunk.score >= minimumScore);
}

function focusEvidenceForGeneration(evidence: RetrievalResult[]) {
  return focusEvidence(evidence, GENERATION_EVIDENCE_SCORE_RATIO);
}

function focusEvidenceForClarification(evidence: RetrievalResult[]) {
  return focusEvidence(evidence, CLARIFICATION_EVIDENCE_SCORE_RATIO);
}

function isUsefulClarificationOption(option: string) {
  return (
    option.length > 2 &&
    !option.endsWith(":") &&
    !option.toLowerCase().startsWith("click here") &&
    !/^\d+[.)]?\s/.test(option)
  );
}

function clarificationOptionsFromEvidence(evidence: RetrievalResult[]) {
  const focusedEvidence = focusEvidenceForClarification(evidence);
  const options = new Set<string>();

  for (const chunk of focusedEvidence) {
    const option = chunk.pageTitle.trim();

    if (isUsefulClarificationOption(option)) {
      options.add(option);
    }

    if (options.size >= 5) {
      break;
    }
  }

  for (const chunk of focusedEvidence) {
    const option = chunk.sectionTitle.trim();

    if (
      option !== chunk.pageTitle &&
      isUsefulClarificationOption(option)
    ) {
      options.add(option);
    }

    if (options.size >= 5) {
      break;
    }
  }

  return Array.from(options);
}

function shouldUseFallbackAnswer(
  evidence: RetrievalResult[],
  classification: QuestionClassification,
) {
  if (!hasEnoughEvidence(evidence)) {
    return true;
  }

  return (
    classification.risk === QUESTION_RISK.highRiskCoverage &&
    !evidenceMatchesClassification(evidence, classification)
  );
}

async function resolveQuestion(
  question: string,
  classify: QuestionClassifier,
  context = "",
): Promise<AssistantResolution> {
  const trimmedQuestion = question.trim();

  if (!trimmedQuestion || !hasMeaningfulText(trimmedQuestion)) {
    return {
      response: emptyQuestionAnswer(),
      type: "static",
    };
  }

  const clarificationFollowUp = resolveClarificationFollowUp(
    trimmedQuestion,
    context,
  );

  if (clarificationFollowUp.type === "needsSelection") {
    return {
      response: clarificationAnswer({
        options: clarificationFollowUp.options,
        question: "Which option should I use?",
      }),
      type: "static",
    };
  }

  if (clarificationFollowUp.type === "selected") {
    const evidence = retrieveChunks(
      clarificationFollowUp.option,
      portalKnowledgeBase.chunks,
    );

    if (!hasEnoughEvidence(evidence)) {
      return {
        response: fallbackAnswer(),
        type: "static",
      };
    }

    return {
      evidence: focusEvidenceForGeneration(evidence),
      question: questionWithContext(clarificationFollowUp.option, context),
      type: "grounded",
    };
  }

  const classification = await classify(trimmedQuestion, context);

  if (classification.requiresClarification) {
    const evidenceOptions = clarificationOptionsFromEvidence(
      retrieveChunks(trimmedQuestion, portalKnowledgeBase.chunks),
    );

    return {
      response: clarificationAnswer({
        options: evidenceOptions.length > 0
          ? evidenceOptions
          : classification.clarificationOptions,
        question: classification.clarificationQuestion,
      }),
      type: "static",
    };
  }

  if (!classification.isSupplierQuestion) {
    return {
      context,
      question: trimmedQuestion,
      type: "conversational",
    };
  }

  if (classification.risk === QUESTION_RISK.medicalOrClinicalAdvice) {
    return {
      response: medicalOrClinicalAdviceAnswer(),
      type: "static",
    };
  }

  const evidence = retrieveEvidence(trimmedQuestion, classification);

  if (classification.risk === QUESTION_RISK.patientSpecificEligibility) {
    return {
      response: patientSpecificEligibilityAnswer(
        classification.state ? stateRequirementEvidence(evidence) : [],
      ),
      type: "static",
    };
  }

  if (shouldUseFallbackAnswer(evidence, classification)) {
    return {
      response: fallbackAnswer({
        includeScopeExplanation:
          classification.risk === QUESTION_RISK.highRiskCoverage,
      }),
      type: "static",
    };
  }

  return {
    evidence: focusEvidenceForGeneration(evidence),
    question: questionWithContext(trimmedQuestion, context),
    type: "grounded",
  };
}

export async function answerQuestion(
  question: string,
  optionsOrGenerateAnswer: AnswerOptions | AnswerGenerator = {},
): Promise<AssistantResponse> {
  const options =
    typeof optionsOrGenerateAnswer === "function"
      ? { generateAnswer: optionsOrGenerateAnswer }
      : optionsOrGenerateAnswer;
  const classify = options.classify ?? classifyQuestion;
  const generateAnswer = options.generateAnswer ?? createGroundedAnswer;
  const generateConversation =
    options.generateConversation ?? createConversationalAnswer;
  const resolution = await resolveQuestion(question, classify, options.context);

  if (resolution.type === "static") {
    return resolution.response;
  }

  if (resolution.type === "conversational") {
    return generateConversation(resolution.question, resolution.context);
  }

  return generateAnswer(resolution.question, resolution.evidence);
}

export async function streamAnswerQuestion(
  question: string,
  onDelta: (delta: string) => void,
  optionsOrGenerateAnswer: StreamingAnswerOptions | StreamingAnswerGenerator = {},
): Promise<AssistantResponse> {
  const options =
    typeof optionsOrGenerateAnswer === "function"
      ? { generateAnswer: optionsOrGenerateAnswer }
      : optionsOrGenerateAnswer;
  const classify = options.classify ?? classifyQuestion;
  const generateAnswer = options.generateAnswer ?? createStreamingGroundedAnswer;
  const generateConversation =
    options.generateConversation ?? createConversationalAnswer;
  const resolution = await resolveQuestion(question, classify, options.context);

  if (resolution.type === "static") {
    streamStaticAnswer(resolution.response.answer, onDelta);
    return resolution.response;
  }

  if (resolution.type === "conversational") {
    const response = await generateConversation(
      resolution.question,
      resolution.context,
    );

    streamStaticAnswer(response.answer, onDelta);
    return response;
  }

  return generateAnswer(resolution.question, resolution.evidence, onDelta);
}
