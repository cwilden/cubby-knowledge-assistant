import { AlertTriangle } from "lucide-react";
import type { AssistantCitation, AssistantResponse } from "@/lib/assistant";
import { ASSISTANT_STATUS } from "@/lib/assistant-status";
import { CitationCards } from "./citation-cards";
import { CubbyBotAvatar } from "./cubby-bot-avatar";
import { MessageText } from "./message-text";

export function AssistantMessage({
  citations,
  isStreaming = false,
  status,
  text,
}: {
  citations: AssistantCitation[];
  isStreaming?: boolean;
  status: AssistantResponse["status"];
  text: string;
}) {
  const isAnswered = status === ASSISTANT_STATUS.answered;
  const statusLabel =
    status === ASSISTANT_STATUS.patientSpecificEligibility
      ? "Coverage cannot be determined"
      : "Needs more context";

  return (
    <div className="flex w-full max-w-5xl min-w-0 gap-3">
      <CubbyBotAvatar />
      <div
        className={`relative min-w-0 flex-1 rounded-md border p-5 shadow-sm before:absolute before:left-[-7px] before:top-5 before:h-3 before:w-3 before:rotate-45 before:border-b before:border-l ${
          isAnswered
            ? "border-[#c9d9e6] bg-white before:border-[#c9d9e6] before:bg-white"
            : "border-[#c9d9e6] bg-[#f8fbfd] before:border-[#c9d9e6] before:bg-[#f8fbfd]"
        }`}
      >
        {!isAnswered ? (
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-white px-2.5 text-xs font-semibold text-[#566078] ring-1 ring-[#e1e9f1]">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              {statusLabel}
            </span>
          </div>
        ) : null}
        <div>
          <MessageText text={text} />
          {isStreaming ? (
            <span
              className="ml-1 inline-block h-4 w-1.5 animate-pulse rounded-full bg-[#61b3e4] align-[-2px]"
              aria-hidden
            />
          ) : null}
        </div>
        <CitationCards citations={citations} isLoading={isStreaming} />
      </div>
    </div>
  );
}
