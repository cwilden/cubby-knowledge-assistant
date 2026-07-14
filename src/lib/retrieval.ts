import type { PortalChunk } from "./portal-content";

export type RetrievalResult = PortalChunk & {
  score: number;
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "can",
  "do",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "should",
  "the",
  "this",
  "to",
  "use",
  "what",
  "where",
  "with",
]);

const EXPANSIONS: Record<string, string[]> = {
  appeal: ["appeals", "denial", "denials"],
  appeals: ["appeal", "denial", "denials"],
  authorization: ["funding", "insurance", "submission"],
  billing: ["code", "codes", "claims"],
  claim: ["claims", "billing", "insurance"],
  code: ["codes", "billing"],
  coverage: ["funding", "insurance", "medicaid"],
  denial: ["denials", "appeal", "appeals"],
  denials: ["denial", "appeal", "appeals"],
  document: ["documents", "docs", "forms"],
  documents: ["document", "docs", "forms"],
  florida: ["state", "medicaid", "requirements"],
  insurance: ["funding", "authorization", "submission"],
  letter: ["lmn", "medical", "necessity"],
  lmn: ["letter", "medical", "necessity"],
  map: ["pricing", "price"],
  medicaid: ["state", "requirements", "coverage"],
  order: ["ordering", "request", "form"],
  pricing: ["price", "map"],
  quote: ["request", "ordering"],
  requirements: ["state", "medicaid", "insurance"],
  safety: ["safe", "features", "checklist"],
};

function normalizeToken(token: string) {
  const normalized = token.toLowerCase().replace(/[^a-z0-9]/g, "");

  if (normalized.endsWith("ies") && normalized.length > 4) {
    return `${normalized.slice(0, -3)}y`;
  }

  if (normalized.endsWith("s") && normalized.length > 4) {
    return normalized.slice(0, -1);
  }

  return normalized;
}

function tokenize(value: string) {
  return value
    .split(/\s+/)
    .map(normalizeToken)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function expandTokens(tokens: string[]) {
  const expanded = new Set(tokens);

  for (const token of tokens) {
    for (const expansion of EXPANSIONS[token] ?? []) {
      expanded.add(normalizeToken(expansion));
    }
  }

  return Array.from(expanded);
}

function scoreChunk(queryTokens: string[], query: string, chunk: PortalChunk) {
  const sectionTokens = new Set(tokenize(chunk.sectionTitle));
  const pageTokens = new Set(tokenize(chunk.pageTitle));
  const textTokens = new Set(tokenize(chunk.text));
  const haystack = `${chunk.pageTitle} ${chunk.sectionTitle} ${chunk.text}`
    .toLowerCase()
    .replace(/\s+/g, " ");
  const normalizedQuery = query.toLowerCase().replace(/\s+/g, " ").trim();

  let score = 0;

  for (const token of queryTokens) {
    if (sectionTokens.has(token)) {
      score += 4;
    }

    if (pageTokens.has(token)) {
      score += 2;
    }

    if (textTokens.has(token)) {
      score += 1;
    }
  }

  if (normalizedQuery.length > 8 && haystack.includes(normalizedQuery)) {
    score += 6;
  }

  return score;
}

export function retrieveChunks(
  query: string,
  chunks: PortalChunk[],
  limit = 5,
): RetrievalResult[] {
  const queryTokens = expandTokens(tokenize(query));

  if (queryTokens.length === 0) {
    return [];
  }

  return chunks
    .map((chunk) => ({
      ...chunk,
      score: scoreChunk(queryTokens, query, chunk),
    }))
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function hasEnoughEvidence(results: RetrievalResult[]) {
  const [topResult] = results;

  return Boolean(topResult && topResult.score >= 6);
}
