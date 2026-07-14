import OpenAI from "openai";
import type { AssistantResponse } from "./assistant";
import type { RetrievalResult } from "./retrieval";

const SYSTEM_PROMPT = `You are a Cubby supplier portal assistant for DME partners.
Answer only using the supplied Cubby portal evidence.
Do not invent coverage rules, payer requirements, pricing, billing instructions, medical claims, or clinical advice.
If the evidence does not support a direct answer, say that you could not verify the answer in the portal content.
Keep the answer concise and practical for a DME partner.
Return only JSON that matches the provided schema.`;

const answerSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: {
      type: "string",
      enum: ["answered", "needs_more_context"],
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

function parseModelResponse(content: string) {
  const parsed = JSON.parse(content) as {
    status: AssistantResponse["status"];
    answer: string;
    citationIds: string[];
  };

  return parsed;
}

export async function createGroundedAnswer(
  question: string,
  evidence: RetrievalResult[],
): Promise<AssistantResponse> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      status: "answered",
      answer:
        "OpenAI is not configured, so this demo is showing the matching Cubby portal resources instead of synthesizing an LLM answer.",
      citations: evidence.slice(0, 3).map((chunk) => ({
        id: chunk.id,
        title: chunk.pageTitle,
        section: chunk.sectionTitle,
        url: chunk.url,
      })),
    };
  }

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

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
  const allowedCitationIds = new Set(evidence.map((chunk) => chunk.id));
  const citations = evidence
    .filter((chunk) => parsed.citationIds.includes(chunk.id))
    .filter((chunk) => allowedCitationIds.has(chunk.id))
    .map((chunk) => ({
      id: chunk.id,
      title: chunk.pageTitle,
      section: chunk.sectionTitle,
      url: chunk.url,
    }));

  return {
    status: parsed.status,
    answer: parsed.answer,
    citations,
  };
}
