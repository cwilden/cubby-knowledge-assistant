"use client";

import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { Home } from "lucide-react";
import { AssistantMessage } from "@/components/assistant/assistant-message";
import { ChatWelcome } from "@/components/assistant/chat-welcome";
import { CubbyBotAvatar } from "@/components/assistant/cubby-bot-avatar";
import { LoadingMessage } from "@/components/assistant/loading-message";
import { PromptCardGrid } from "@/components/assistant/prompt-card-grid";
import { QuestionComposer } from "@/components/assistant/question-composer";
import { UserMessage } from "@/components/assistant/user-message";
import type { AssistantResponse } from "@/lib/assistant";
import { ASSISTANT_STATUS } from "@/lib/assistant-status";

const EXAMPLE_QUESTIONS = [
  "What billing code should I use for the Cubby Bed?",
  "Where can I find the order request form?",
  "What documents are needed for insurance funding?",
  "How should we handle appeals and denials?",
];

const PENDING_RESPONSE: AssistantResponse = {
  status: ASSISTANT_STATUS.answered,
  answer: "",
  citations: [],
};
const STREAMING_RESPONSE: AssistantResponse = {
  status: ASSISTANT_STATUS.answered,
  answer: "",
  citations: [],
};

type ChatTurn = {
  id: number;
  question: string;
  response: AssistantResponse;
  isLoading: boolean;
};

function parseServerSentEvents(
  buffer: string,
  onEvent: (event: string, data: unknown) => void,
) {
  const messages = buffer.split("\n\n");
  const remainder = messages.pop() ?? "";

  for (const message of messages) {
    const eventLine = message
      .split("\n")
      .find((line) => line.startsWith("event: "));
    const dataLine = message
      .split("\n")
      .find((line) => line.startsWith("data: "));

    if (!eventLine || !dataLine) {
      continue;
    }

    onEvent(
      eventLine.replace("event: ", ""),
      JSON.parse(dataLine.replace("data: ", "")) as unknown,
    );
  }

  return remainder;
}

export function AssistantClient() {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [areExamplesVisible, setAreExamplesVisible] = useState(true);
  const nextTurnId = useRef(1);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop =
          scrollContainerRef.current.scrollHeight;
        return;
      }

      scrollAnchorRef.current?.scrollIntoView({ block: "end" });
    });
  }, [turns]);

  function updateTurnResponse(
    turnId: number,
    updater: (response: AssistantResponse) => AssistantResponse,
  ) {
    setTurns((currentTurns) =>
      currentTurns.map((turn) =>
        turn.id === turnId
          ? {
              ...turn,
              response: updater(turn.response),
            }
          : turn,
      ),
    );
  }

  function finishTurn(turnId: number) {
    setTurns((currentTurns) =>
      currentTurns.map((turn) =>
        turn.id === turnId ? { ...turn, isLoading: false } : turn,
      ),
    );
  }

  async function askQuestion(nextQuestion = question) {
    const trimmedQuestion = nextQuestion.trim();

    if (!trimmedQuestion || isLoading) {
      return;
    }

    const turnId = nextTurnId.current;
    nextTurnId.current += 1;

    setTurns((currentTurns) => [
      ...currentTurns,
      {
        id: turnId,
        question: trimmedQuestion,
        response: PENDING_RESPONSE,
        isLoading: true,
      },
    ]);
    setQuestion("");
    setIsLoading(true);
    setError("");
    setAreExamplesVisible(false);

    try {
      const apiResponse = await fetch("/api/ask", {
        method: "POST",
        headers: {
          Accept: "text/event-stream",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question: trimmedQuestion }),
      });

      if (!apiResponse.ok) {
        throw new Error("Something went wrong.");
      }

      const reader = apiResponse.body?.getReader();

      if (!reader) {
        throw new Error("The answer stream could not be read.");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      updateTurnResponse(turnId, () => STREAMING_RESPONSE);

      for (;;) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer = parseServerSentEvents(
          `${buffer}${decoder.decode(value, { stream: true })}`,
          (event, data) => {
            if (event === "delta") {
              const delta = (data as { delta?: unknown }).delta;

              if (typeof delta !== "string") {
                return;
              }

              updateTurnResponse(turnId, (currentResponse) => ({
                ...currentResponse,
                answer: `${currentResponse.answer}${delta}`,
              }));
            }

            if (event === "final") {
              updateTurnResponse(turnId, () => data as AssistantResponse);
            }
          },
        );
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Something went wrong.",
      );
    } finally {
      finishTurn(turnId);
      setIsLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void askQuestion();
  }

  function handleHomeClick() {
    setTurns([]);
    setQuestion("");
    setError("");
    setAreExamplesVisible(true);
  }

  return (
    <main className="min-h-screen bg-[#f5f8fb] text-[#2f344a]">
      <div className="flex min-h-screen w-full flex-col px-4 py-4 sm:px-6 lg:px-8">
        <section className="flex min-h-0 flex-1">
          <div className="flex h-[calc(100vh-2rem)] min-h-[560px] w-full flex-col overflow-hidden rounded-md border border-[#d6e4ef] bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-[#e1e9f1] bg-white px-4 py-3 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <CubbyBotAvatar />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-lg font-semibold tracking-normal text-[#444963]">
                      Ask Cubby
                    </h1>
                    <span className="rounded-full border border-[#e1e9f1] bg-[#f8fbfd] px-2 py-0.5 text-xs font-medium text-[#7e879b]">
                      Beta
                    </span>
                  </div>
                  <p className="mt-1 max-w-2xl text-xs leading-5 text-[#6c7285]">
                    Powered by official supplier documentation.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isLoading}
                onClick={handleHomeClick}
                className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-md border border-[#e1e9f1] bg-[#f8fbfd] px-3 text-sm font-semibold text-[#566078] transition hover:border-[#61b3e4] hover:bg-[#eef7fc] hover:text-[#4b9dcc] focus:outline-none focus:ring-4 focus:ring-[#61b3e4]/20 disabled:cursor-not-allowed disabled:opacity-60"
                title="Return home"
              >
                <Home className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">Home</span>
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col bg-[#f8fbfd]">
              <div
                ref={scrollContainerRef}
                data-testid="chat-scroll-container"
                className="flex min-h-0 flex-1 flex-col gap-5 overflow-x-hidden overflow-y-auto p-4 sm:p-6"
              >
                {turns.length === 0 ? (
                  <ChatWelcome
                    disabled={isLoading}
                    onSelect={(topicQuestion) => void askQuestion(topicQuestion)}
                  />
                ) : null}

                {turns.map((turn) => (
                  <div key={turn.id} className="flex min-w-0 flex-col gap-5">
                    <UserMessage text={turn.question} />

                    {turn.isLoading && !turn.response.answer ? (
                      <LoadingMessage />
                    ) : null}

                    {turn.response.answer ? (
                      <AssistantMessage
                        citations={turn.response.citations}
                        isStreaming={
                          turn.isLoading && Boolean(turn.response.answer)
                        }
                        status={turn.response.status}
                        text={turn.response.answer}
                      />
                    ) : null}
                  </div>
                ))}

                {error ? (
                  <p className="max-w-5xl rounded-md border border-[#efc5bd] bg-[#fff1ee] p-4 text-sm text-[#923927]">
                    {error}
                  </p>
                ) : null}
                <div ref={scrollAnchorRef} />
              </div>

              <div className="border-t border-[#e1e9f1] bg-white p-4 shadow-[0_-10px_30px_rgba(68,73,99,0.04)] sm:p-5">
                {areExamplesVisible ? (
                  <PromptCardGrid
                    disabled={isLoading}
                    examples={EXAMPLE_QUESTIONS}
                    onDismiss={() => setAreExamplesVisible(false)}
                    onSelect={(example) => void askQuestion(example)}
                  />
                ) : null}

                <QuestionComposer
                  disabled={isLoading}
                  onChange={setQuestion}
                  onSubmit={handleSubmit}
                  value={question}
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
