import { ArrowUpRight, ChevronDown, FileText, Loader2 } from "lucide-react";
import type { AssistantCitation } from "@/lib/assistant";

export function CitationCards({
  citations,
  isLoading = false,
}: {
  citations: AssistantCitation[];
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="mt-4 border-t border-[#e1e9f1] pt-3">
        <div className="flex items-center gap-2 text-sm font-medium text-[#6c7285]">
          <Loader2 className="h-4 w-4 animate-spin text-[#4b9dcc]" aria-hidden />
          Preparing source links...
        </div>
      </div>
    );
  }

  if (citations.length === 0) {
    return null;
  }

  return (
    <details className="group mt-4 min-w-0 border-t border-[#e1e9f1] pt-3">
      <summary className="flex min-w-0 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-[#4b9dcc] transition hover:text-[#2f6f9d]">
        <FileText className="h-4 w-4" aria-hidden />
        <span className="min-w-0 truncate">
          Supporting Cubby sources
        </span>
        <ChevronDown
          className="h-4 w-4 transition group-open:rotate-180"
          aria-hidden
        />
      </summary>

      <div className="mt-2 grid gap-1.5">
        {citations.map((citation, index) => {
          const shouldShowSection = citation.section !== citation.title;

          return (
            <a
              key={citation.id}
              href={citation.url}
              target="_blank"
              rel="noreferrer"
              className="group/source min-w-0 cursor-pointer rounded-md border border-[#e1e9f1] bg-white px-3 py-2 transition hover:border-[#61b3e4] hover:bg-[#eef7fc]"
            >
              <div className="flex items-center gap-2.5">
                <FileText
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#4b9dcc]"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#444963]">
                    {index + 1}. {citation.title}
                  </p>
                  {shouldShowSection ? (
                    <p className="mt-0.5 truncate text-xs font-medium text-[#4b9dcc]">
                      {citation.section}
                    </p>
                  ) : null}
                  <p className="mt-0.5 truncate text-xs text-[#6c7285]">
                    &ldquo;{citation.excerpt}&rdquo;
                  </p>
                </div>
                <ArrowUpRight
                  className="h-3.5 w-3.5 shrink-0 text-[#7e879b] transition group-hover/source:text-[#4b9dcc]"
                  aria-hidden
                />
              </div>
            </a>
          );
        })}
      </div>
    </details>
  );
}
