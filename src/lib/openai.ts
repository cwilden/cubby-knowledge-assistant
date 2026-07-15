import OpenAI from "openai";
import type { AssistantResponse } from "./assistant";
import {
  ASSISTANT_STATUS,
  ASSISTANT_STATUS_VALUES,
  isAssistantStatus,
} from "./assistant-status";
import { citationsFromEvidence } from "./citations";
import type { RetrievalResult } from "./retrieval";

const SYSTEM_PROMPT = `You are a Cubby supplier portal assistant for DME partners.
Answer only using the supplied Cubby portal evidence.
Do not invent coverage rules, payer requirements, pricing, billing instructions, medical claims, or clinical advice.
If the evidence does not support a direct answer, say that you could not verify the answer in the portal content.
When relevant evidence exists, include the citation IDs for the resources the user should open next.
Do not write citation numbers or citation IDs in the answer text. The app displays selected citations separately.
If you include a source link in the answer, use descriptive markdown link text instead of a bare URL. For example, write "The direct link to the form is [here](https://example.com)." instead of pasting the URL.
Use Markdown when it improves scanability: short bullet lists, bold labels, and descriptive links are welcome. Do not over-format simple answers.
Assume the user is a DME supplier unless they say otherwise. When state Medicaid evidence includes role-specific sections, distinguish supplier actions from caregiver, doctor, and OT/PT requirements instead of blending them into one generic checklist.
Keep the answer concise and practical for a DME partner.
When it feels natural, end with one short follow-up question that helps the partner continue the workflow.
Return only JSON that matches the provided schema.`;

const STREAMING_SYSTEM_PROMPT = `You are a Cubby supplier portal assistant for DME partners.
Answer only using the supplied Cubby portal evidence.
Do not invent coverage rules, payer requirements, pricing, billing instructions, medical claims, or clinical advice.
If the evidence does not support a direct answer, say that you could not verify the answer in the portal content.
Do not write citation numbers or citation IDs in the answer text. The app displays selected citations separately.
If a direct source link is useful, use descriptive markdown link text instead of a bare URL. For example, write "The direct link to the form is [here](https://example.com)." instead of pasting the URL.
Use Markdown when it improves scanability: short bullet lists, bold labels, and descriptive links are welcome. Do not over-format simple answers.
Assume the user is a DME supplier unless they say otherwise. When state Medicaid evidence includes role-specific sections, distinguish supplier actions from caregiver, doctor, and OT/PT requirements instead of blending them into one generic checklist.
Keep the answer concise and practical for a DME partner.
When it feels natural, end with one short follow-up question that helps the partner continue the workflow.`;

const CITATION_LIMIT = 4;
const INLINE_CITATION_REFERENCE_PATTERN =
  /\s*\((?:see\s+)?citations?[^)]*\)\s*$/i;
const MARKDOWN_LINK_PATTERN = /\[[^\]]+\]\([^)]+\)/g;
const BARE_URL_PATTERN = /https?:\/\/[^\s)]+/g;
const STATE_REQUIREMENT_ROLE_SECTIONS = new Set([
  "For caregivers",
  "For doctors",
  "For medical supplier",
  "For OT/PT",
]);

const answerSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: {
      type: "string",
      enum: ASSISTANT_STATUS_VALUES,
    },
    answer: {
      type: "string",
    },
    citationIds: {
      type: "array",
      items: {
        type: "string",
      },
    },
  },
  required: ["status", "answer", "citationIds"],
};

type GroundedAnswerPayload = {
  answer: string;
  citationIds: string[];
  status: AssistantResponse["status"];
};

function buildEvidencePrompt(evidence: RetrievalResult[]) {
  return evidence
    .map(
      (chunk, index) => `[${index + 1}] ${chunk.id}
Page: ${chunk.pageTitle}
Section: ${chunk.sectionTitle}
URL: ${chunk.url}
Text: ${chunk.text}`,
    )
    .join("\n\n");
}

function parseModelResponse(content: string): GroundedAnswerPayload {
  const parsed = JSON.parse(content) as Partial<GroundedAnswerPayload>;

  if (
    !isAssistantStatus(parsed.status) ||
    typeof parsed.answer !== "string" ||
    !Array.isArray(parsed.citationIds)
  ) {
    throw new Error("OpenAI returned an invalid grounded answer payload.");
  }

  return {
    answer: parsed.answer,
    citationIds: parsed.citationIds.filter(
      (citationId): citationId is string => typeof citationId === "string",
    ),
    status: parsed.status,
  };
}

function withoutInlineCitationReferences(answer: string) {
  return answer.replace(INLINE_CITATION_REFERENCE_PATTERN, "").trim();
}

function withDescriptiveLinks(answer: string) {
  const markdownLinks: string[] = [];
  const placeholderAnswer = answer.replace(MARKDOWN_LINK_PATTERN, (link) => {
    const placeholder = `__CUBBY_MARKDOWN_LINK_${markdownLinks.length}__`;
    markdownLinks.push(link);
    return placeholder;
  });

  const linkedAnswer = placeholderAnswer.replace(
    BARE_URL_PATTERN,
    (url) => `[here](${url})`,
  );

  return markdownLinks.reduce(
    (currentAnswer, link, index) =>
      currentAnswer.replace(`__CUBBY_MARKDOWN_LINK_${index}__`, link),
    linkedAnswer,
  );
}

function cleanAnswer(answer: string) {
  return withDescriptiveLinks(withoutInlineCitationReferences(answer));
}

export function citationsForEvidence(
  parsedCitationIds: string[],
  evidence: RetrievalResult[],
) {
  const roleRequirementEvidence = evidence.filter((chunk) =>
    STATE_REQUIREMENT_ROLE_SECTIONS.has(chunk.sectionTitle),
  );

  if (roleRequirementEvidence.length >= 3) {
    return citationsFromEvidence(roleRequirementEvidence, {
      dedupeByArticle: false,
      limit: CITATION_LIMIT,
    });
  }

  const requestedCitationIds = new Set(parsedCitationIds);
  const modelCitations = evidence
    .filter((chunk) => requestedCitationIds.has(chunk.id))
    .flatMap((chunk) => citationsFromEvidence([chunk]));

  const selectedCitations = modelCitations.length > 0
    ? modelCitations
    : citationsFromEvidence(evidence, {
        strongOnly: true,
        limit: CITATION_LIMIT,
      });

  return selectedCitations.slice(0, CITATION_LIMIT);
}

function selectCitations(
  parsedCitationIds: string[],
  evidence: RetrievalResult[],
) {
  return citationsForEvidence(parsedCitationIds, evidence);
}

function serviceUnavailableAnswer(evidence: RetrievalResult[]): AssistantResponse {
  return {
    status: ASSISTANT_STATUS.needsMoreContext,
    answer:
      "I found relevant Cubby portal resources, but the LLM answer service is unavailable right now. Please use the cited resources below to verify the answer.",
    citations: citationsFromEvidence(evidence, {
      strongOnly: true,
      limit: CITATION_LIMIT,
    }),
  };
}

export async function createGroundedAnswer(
  question: string,
  evidence: RetrievalResult[],
): Promise<AssistantResponse> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      status: ASSISTANT_STATUS.answered,
      answer:
        "OpenAI is not configured, so this demo is showing the matching Cubby portal resources instead of synthesizing an LLM answer.",
      citations: citationsFromEvidence(evidence, {
        strongOnly: true,
        limit: CITATION_LIMIT,
      }),
    };
  }

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: `Question: ${question}

Cubby portal evidence:
${buildEvidencePrompt(evidence)}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "grounded_cubby_answer",
          strict: true,
          schema: answerSchema,
        },
      },
    });

    const content = completion.choices[0]?.message.content;

    if (!content) {
      throw new Error("OpenAI returned an empty response.");
    }

    const parsed = parseModelResponse(content);

    return {
      status: parsed.status,
      answer: cleanAnswer(parsed.answer),
      citations: selectCitations(parsed.citationIds, evidence),
    };
  } catch (error) {
    console.error("Unable to synthesize grounded answer.", error);

    return serviceUnavailableAnswer(evidence);
  }
}

export async function createStreamingGroundedAnswer(
  question: string,
  evidence: RetrievalResult[],
  onDelta: (delta: string) => void,
): Promise<AssistantResponse> {
  if (!process.env.OPENAI_API_KEY) {
    const answer =
      "OpenAI is not configured, so this demo is showing the matching Cubby portal resources instead of synthesizing an LLM answer.";

    onDelta(answer);

    return {
      status: ASSISTANT_STATUS.answered,
      answer,
      citations: citationsForEvidence([], evidence),
    };
  }

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    const stream = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      temperature: 0.2,
      stream: true,
      messages: [
        {
          role: "system",
          content: STREAMING_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: `Question: ${question}

Cubby portal evidence:
${buildEvidencePrompt(evidence)}`,
        },
      ],
    });

    let answer = "";

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta.content ?? "";

      if (!delta) {
        continue;
      }

      answer += delta;
      onDelta(delta);
    }

    return {
      status: ASSISTANT_STATUS.answered,
      answer: cleanAnswer(answer),
      citations: citationsForEvidence([], evidence),
    };
  } catch (error) {
    console.error("Unable to stream grounded answer.", error);

    const response = serviceUnavailableAnswer(evidence);

    onDelta(response.answer);

    return response;
  }
}
