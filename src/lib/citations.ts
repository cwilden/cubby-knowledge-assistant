import type { AssistantCitation } from "./assistant";
import type { RetrievalResult } from "./retrieval";

export const STRONG_EVIDENCE_SCORE = 6;
const EXCERPT_MAX_LENGTH = 220;

function excerptFromText(text: string) {
  const normalizedText = text.replace(/\s+/g, " ").trim();
  const [firstSentence] = normalizedText.match(/[^.!?]+[.!?]/) ?? [];
  const excerpt = firstSentence?.trim() || normalizedText;

  if (excerpt.length <= EXCERPT_MAX_LENGTH) {
    return excerpt;
  }

  return `${excerpt.slice(0, EXCERPT_MAX_LENGTH - 1).trim()}...`;
}

function canonicalCitationUrl(value: string) {
  const url = new URL(value);

  url.search = "";
  url.hash = "";

  return url.toString();
}

function uniqueEvidenceByArticle(evidence: RetrievalResult[]) {
  const seenUrls = new Set<string>();

  return evidence.filter((chunk) => {
    const url = canonicalCitationUrl(chunk.url);

    if (seenUrls.has(url)) {
      return false;
    }

    seenUrls.add(url);
    return true;
  });
}

export function citationsFromEvidence(
  evidence: RetrievalResult[],
  options: {
    dedupeByArticle?: boolean;
    limit?: number;
    strongOnly?: boolean;
  } = {},
): AssistantCitation[] {
  const { dedupeByArticle = true, strongOnly = false, limit } = options;
  const filteredEvidence = strongOnly
    ? evidence.filter((chunk) => chunk.score >= STRONG_EVIDENCE_SCORE)
    : evidence;
  const uniqueEvidence = dedupeByArticle
    ? uniqueEvidenceByArticle(filteredEvidence)
    : filteredEvidence;
  const limitedEvidence =
    typeof limit === "number"
      ? uniqueEvidence.slice(0, limit)
      : uniqueEvidence;

  return limitedEvidence.map((chunk) => ({
    excerpt: excerptFromText(chunk.text),
    id: chunk.id,
    title: chunk.pageTitle,
    section: chunk.sectionTitle,
    url: chunk.url,
  }));
}
