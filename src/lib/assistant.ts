import knowledgeBase from "../../data/portal-content.json";
import { createGroundedAnswer } from "./openai";
import type { PortalKnowledgeBase } from "./portal-content";
import {
  hasEnoughEvidence,
  retrieveChunks,
  type RetrievalResult,
} from "./retrieval";

export type AssistantCitation = {
  id: string;
  title: string;
  section: string;
  url: string;
};

export type AssistantResponse = {
  status: "answered" | "needs_more_context";
  answer: string;
  citations: AssistantCitation[];
};

export type AnswerGenerator = (
  question: string,
  evidence: RetrievalResult[],
) => Promise<AssistantResponse>;

const portalKnowledgeBase = knowledgeBase as PortalKnowledgeBase;

export function citationsFromEvidence(
  evidence: RetrievalResult[],
): AssistantCitation[] {
  return evidence.map((chunk) => ({
    id: chunk.id,
    title: chunk.pageTitle,
    section: chunk.sectionTitle,
    url: chunk.url,
  }));
}

export function fallbackAnswer(evidence: RetrievalResult[]): AssistantResponse {
  return {
    status: "needs_more_context",
    answer:
      "I could not find enough support in the supplier portal content to answer that confidently. Please try a more specific Cubby supplier question or contact Cubby for confirmation.",
    citations: citationsFromEvidence(evidence.slice(0, 3)),
  };
}

export async function answerQuestion(
  question: string,
  generateAnswer: AnswerGenerator = createGroundedAnswer,
): Promise<AssistantResponse> {
  const trimmedQuestion = question.trim();

  if (!trimmedQuestion) {
    return {
      status: "needs_more_context",
      answer: "Ask a Cubby supplier portal question to get a cited answer.",
      citations: [],
    };
  }

  const evidence = retrieveChunks(trimmedQuestion, portalKnowledgeBase.chunks);

  if (!hasEnoughEvidence(evidence)) {
    return fallbackAnswer(evidence);
  }

  return generateAnswer(trimmedQuestion, evidence);
}
