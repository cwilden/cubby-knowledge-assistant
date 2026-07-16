import { beforeEach, describe, expect, it, vi } from "vitest";
import { ASSISTANT_STATUS } from "./assistant-status";
import { createGroundedAnswer } from "./openai";
import type { RetrievalResult } from "./retrieval";

const createCompletion = vi.fn();

vi.mock("./openai-config", () => ({
  answerModel: () => "test-answer-model",
  hasOpenAIKey: () => true,
  openAIClient: () => ({
    chat: {
      completions: {
        create: createCompletion,
      },
    },
  }),
}));

function chunk(overrides: Partial<RetrievalResult>): RetrievalResult {
  return {
    id: "billing-code",
    pageTitle: "Billing Codes & Reimbursement (HCPCS)",
    sectionTitle: "Billing Codes & Reimbursement (HCPCS)",
    sourceId: "billing-code",
    text: "Cubby Beds typically use E1399 when a payer requires miscellaneous durable medical equipment coding.",
    url: "https://help.cubbybeds.com/en_us/billing-codes-for-cubby-beds-SkRI_gAqel",
    score: 30,
    ...overrides,
  };
}

function mockGroundedPayload(citationIds: string[]) {
  createCompletion.mockResolvedValueOnce({
    choices: [
      {
        message: {
          content: JSON.stringify({
            answer: "Use the documented Cubby billing guidance.",
            citationIds,
            status: ASSISTANT_STATUS.answered,
          }),
        },
      },
    ],
  });
}

describe("grounded answer citation contract", () => {
  beforeEach(() => {
    createCompletion.mockReset();
  });

  it("returns final citations selected from retrieved evidence", async () => {
    mockGroundedPayload(["billing-code"]);

    const response = await createGroundedAnswer("What billing code should I use?", [
      chunk({ id: "billing-code" }),
      chunk({
        id: "warranty",
        pageTitle: "Is there a warranty on your products?",
        sectionTitle: "Is there a warranty on your products?",
        sourceId: "warranty",
        text: "Cubby products include warranty details.",
        url: "https://help.cubbybeds.com/en_us/is-there-a-warranty-on-your-products",
        score: 12,
      }),
    ]);

    expect(response.status).toBe(ASSISTANT_STATUS.answered);
    expect(response.citations).toHaveLength(1);
    expect(response.citations[0]).toMatchObject({
      id: "billing-code",
      title: "Billing Codes & Reimbursement (HCPCS)",
    });
  });

  it("ignores unknown model citation IDs when at least one selected ID is valid", async () => {
    mockGroundedPayload(["not-in-evidence", "billing-code"]);

    const response = await createGroundedAnswer("What billing code should I use?", [
      chunk({ id: "billing-code" }),
    ]);

    expect(response.citations).toHaveLength(1);
    expect(response.citations[0]?.id).toBe("billing-code");
  });

  it("deduplicates duplicate model citation IDs and does not pad to a fixed count", async () => {
    mockGroundedPayload(["billing-code", "billing-code"]);

    const response = await createGroundedAnswer("What billing code should I use?", [
      chunk({ id: "billing-code" }),
      chunk({
        id: "order-form",
        pageTitle: "Supplier Portal Ordering",
        sectionTitle: "Order request form",
        sourceId: "order-form",
        text: "Use the order request form to start an order.",
        url: "https://cubbybeds.com/pages/supplier-portal-ordering",
        score: 24,
      }),
    ]);

    expect(response.citations.map((citation) => citation.id)).toEqual([
      "billing-code",
    ]);
  });

  it("prevents citations outside retrieved evidence from appearing in the final response", async () => {
    mockGroundedPayload(["fake-colorado-source"]);

    const response = await createGroundedAnswer("What billing code should I use?", [
      chunk({ id: "billing-code" }),
    ]);

    expect(response.citations).toHaveLength(1);
    expect(response.citations[0]?.id).toBe("billing-code");
    expect(response.citations.map((citation) => citation.id)).not.toContain(
      "fake-colorado-source",
    );
  });
});
