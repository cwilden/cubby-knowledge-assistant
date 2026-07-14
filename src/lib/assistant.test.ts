import { describe, expect, it, vi } from "vitest";
import { answerQuestion } from "./assistant";

describe("answerQuestion", () => {
  it("does not call the LLM when retrieval evidence is weak", async () => {
    const generateAnswer = vi.fn();

    const response = await answerQuestion(
      "What is the best hiking trail near Denver?",
      generateAnswer,
    );

    expect(generateAnswer).not.toHaveBeenCalled();
    expect(response.status).toBe("needs_more_context");
    expect(response.answer).toContain("could not find enough support");
  });

  it("passes strong evidence to the answer generator", async () => {
    const generateAnswer = vi.fn().mockResolvedValue({
      status: "answered",
      answer: "Use the billing code resource.",
      citations: [],
    });

    await answerQuestion(
      "What billing code should I use for the Cubby Bed?",
      generateAnswer,
    );

    expect(generateAnswer).toHaveBeenCalledOnce();
    expect(generateAnswer.mock.calls[0][1][0].id).toContain("billing-code");
  });
});
