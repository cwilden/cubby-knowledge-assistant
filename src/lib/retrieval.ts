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
  "cubby",
  "bed",
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
  billing: ["code", "codes", "claims", "coding", "hcpcs", "reimbursement"],
  claim: ["claims", "billing", "insurance"],
  code: ["codes", "billing", "coding", "hcpcs"],
  coding: ["code", "codes", "billing", "hcpcs"],
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
  reimbursement: ["billing", "code", "codes", "hcpcs"],
  order: ["ordering", "request", "form"],
  pricing: ["price", "map"],
  quote: ["request", "ordering"],
  requirements: ["state", "medicaid", "insurance"],
  safety: ["safe", "features", "checklist"],
};

const STATE_REQUIREMENT_SOURCE_PREFIX = "state-requirements-for-";
const STATE_REQUIREMENT_ROLE_SECTIONS = new Set([
  "For caregivers",
  "For doctors",
  "For medical supplier",
  "For OT/PT",
]);
const STATE_SLUGS = [
  "alabama",
  "arizona",
  "california",
  "colorado",
  "connecticut",
  "florida",
  "georgia",
  "illinois",
  "indiana",
  "iowa",
  "kentucky",
  "louisiana",
  "maryland",
  "massachusetts",
  "michigan",
  "minnesota",
  "missouri",
  "new-hampshire",
  "new-york",
  "north-carolina",
  "ohio",
  "oklahoma",
  "oregon",
  "pennsylvania",
  "south-carolina",
  "tennessee",
  "texas",
  "virginia",
  "washington",
  "wisconsin",
];

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

function stateSlugsFromQuery(query: string) {
  const normalizedQuery = query.toLowerCase().replace(/[^a-z0-9]+/g, " ");

  return new Set(
    STATE_SLUGS.filter((stateSlug) =>
      normalizedQuery.includes(stateSlug.replace(/-/g, " ")),
    ),
  );
}

function isStateRequirementChunk(chunk: PortalChunk) {
  return chunk.sourceId.startsWith(STATE_REQUIREMENT_SOURCE_PREFIX);
}

function matchesRequestedState(
  chunk: PortalChunk,
  requestedStateSlugs: Set<string>,
) {
  if (requestedStateSlugs.size === 0 || !isStateRequirementChunk(chunk)) {
    return true;
  }

  const isRequestedStateChunk = Array.from(requestedStateSlugs).some(
    (stateSlug) =>
      chunk.sourceId === `${STATE_REQUIREMENT_SOURCE_PREFIX}${stateSlug}`,
  );

  return isRequestedStateChunk && chunk.sectionTitle !== "All other states";
}

function scoreChunk(
  queryTokens: string[],
  query: string,
  chunk: PortalChunk,
  requestedStateSlugs: Set<string>,
) {
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

  if (
    requestedStateSlugs.size > 0 &&
    Array.from(requestedStateSlugs).some(
      (stateSlug) =>
        chunk.sourceId === `${STATE_REQUIREMENT_SOURCE_PREFIX}${stateSlug}`,
    )
  ) {
    score += 10;
  }

  if (
    requestedStateSlugs.size > 0 &&
    STATE_REQUIREMENT_ROLE_SECTIONS.has(chunk.sectionTitle)
  ) {
    score += 16;
  }

  return score;
}

export function retrieveChunks(
  query: string,
  chunks: PortalChunk[],
  limit = 12,
): RetrievalResult[] {
  const queryTokens = expandTokens(tokenize(query));
  const requestedStateSlugs = stateSlugsFromQuery(query);

  if (queryTokens.length === 0) {
    return [];
  }

  return chunks
    .filter((chunk) => matchesRequestedState(chunk, requestedStateSlugs))
    .map((chunk) => ({
      ...chunk,
      score: scoreChunk(queryTokens, query, chunk, requestedStateSlugs),
    }))
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function hasEnoughEvidence(results: RetrievalResult[]) {
  const [topResult] = results;

  return Boolean(topResult && topResult.score >= 6);
}
