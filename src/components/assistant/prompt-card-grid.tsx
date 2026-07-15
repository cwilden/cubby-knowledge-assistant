import { X } from "lucide-react";

export function PromptCardGrid({
  disabled,
  examples,
  onDismiss,
  onSelect,
}: {
  disabled: boolean;
  examples: string[];
  onDismiss: () => void;
  onSelect: (question: string) => void;
}) {
  return (
    <div className="mb-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase text-[#7e879b]">
          Example questions
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-[#7e879b] transition hover:bg-[#eef7fc] hover:text-[#4b9dcc] focus:outline-none focus:ring-4 focus:ring-[#61b3e4]/20"
          title="Hide example questions"
        >
          <X className="h-4 w-4" aria-hidden />
          <span className="sr-only">Hide example questions</span>
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {examples.map((example) => (
          <button
            type="button"
            key={example}
            disabled={disabled}
            onClick={() => onSelect(example)}
            className="shrink-0 cursor-pointer rounded-full border border-[#e1e9f1] bg-[#f8fbfd] px-3 py-1.5 text-sm font-medium text-[#566078] transition hover:border-[#61b3e4] hover:bg-[#eef7fc] hover:text-[#4b9dcc] focus:outline-none focus:ring-4 focus:ring-[#61b3e4]/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}
