import { Loader2, Search, Send } from "lucide-react";
import type { FormEvent } from "react";

export function QuestionComposer({
  disabled,
  onChange,
  onSubmit,
  value,
}: {
  disabled: boolean;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  value: string;
}) {
  return (
    <div>
      <form onSubmit={onSubmit} className="flex gap-3">
        <label className="sr-only" htmlFor="question">
          Ask a supplier question
        </label>
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#7e879b]"
            aria-hidden
          />
          <input
            id="question"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Ask about billing codes, forms, ordering, appeals..."
            className="h-12 w-full rounded-md border border-[#c9d9e6] bg-white pl-10 pr-3 text-base outline-none transition focus:border-[#4b9dcc] focus:ring-4 focus:ring-[#61b3e4]/20"
          />
        </div>
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="inline-flex h-12 min-w-12 cursor-pointer items-center justify-center rounded-md bg-[#4b9dcc] px-4 text-sm font-semibold text-white transition hover:bg-[#2f6f9d] disabled:cursor-not-allowed disabled:bg-[#a7c9dd]"
          title="Ask"
        >
          {disabled ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          ) : (
            <Send className="h-5 w-5" aria-hidden />
          )}
          <span className="sr-only">Ask</span>
        </button>
      </form>
      <p className="mt-2 text-xs leading-5 text-[#7e879b]">
        Answers include citations back to official supplier documentation.
      </p>
    </div>
  );
}
