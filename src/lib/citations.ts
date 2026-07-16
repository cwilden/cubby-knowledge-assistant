import type { AssistantCitation } from "./assistant-types";
import type { RetrievalResult } from "./retrieval";

const STRONG_EVIDENCE_SCORE = 6;
const RELATED_EVIDENCE_SCORE_RATIO = 0.85;
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

function canonicalCitationTitle(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function uniqueEvidenceByArticle(evidence: RetrievalResult[]) {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();

  return evidence.filter((chunk) => {
    const url = canonicalCitationUrl(chunk.url);
    const title = canonicalCitationTitle(chunk.pageTitle);

    if (seenUrls.has(url) || seenTitles.has(title)) {
      return false;
    }

    seenUrls.add(url);
    seenTitles.add(title);
    return true;
  });
}

function strongRelatedEvidence(evidence: RetrievalResult[]) {
  const topScore = evidence[0]?.score ?? 0;
  const relatedScore = topScore * RELATED_EVIDENCE_SCORE_RATIO;

  return evidence.filter(
    (chunk) =>
      chunk.score >= STRONG_EVIDENCE_SCORE && chunk.score >= relatedScore,
  );
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
  const filteredEvidence = strongOnly ? strongRelatedEvidence(evidence) : evidence;
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
