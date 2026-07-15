import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import slugify from "slugify";
import type {
  PortalChunk,
  PortalKnowledgeBase,
  PortalSource,
} from "../src/lib/portal-content";

const PORTAL_SOURCES: PortalSource[] = [
  {
    id: "overview",
    title: "Supplier Portal Overview",
    url: "https://cubbybeds.com/pages/supplier-portal-overview",
  },
  {
    id: "onboarding",
    title: "Supplier Portal Get Started",
    url: "https://cubbybeds.com/pages/supplier-portal-onboarding",
  },
  {
    id: "forms-docs",
    title: "Supplier Portal Funding Docs",
    url: "https://cubbybeds.com/pages/supplier-portal-forms-docs",
  },
  {
    id: "product-info",
    title: "Supplier Portal Product Info",
    url: "https://cubbybeds.com/pages/supplier-portal-product-info",
  },
  {
    id: "ordering",
    title: "Supplier Portal Ordering",
    url: "https://cubbybeds.com/pages/supplier-portal-ordering",
  },
  {
    id: "faqs",
    title: "Supplier Portal FAQs",
    url: "https://cubbybeds.com/pages/supplier-portal-faqs",
  },
  {
    id: "request-quote",
    title: "Supplier Portal Request Quote",
    url: "https://cubbybeds.com/pages/supplier-portal-request-quote",
  },
  {
    id: "replacement-orders",
    title: "Supplier Portal Replacement Orders",
    url: "https://cubbybeds.com/pages/supplier-portal-replacement-orders",
  },
  {
    id: "contact",
    title: "Supplier Portal Contact",
    url: "https://cubbybeds.com/pages/supplier-portal-contact",
  },
];

const OUTPUT_PATH = path.join(process.cwd(), "data", "portal-content.json");
const HEADING_SELECTOR = "h1, h2, h3";
const HELP_CENTER_HOST = "help.cubbybeds.com";
const HELP_ARTICLE_BODY_FIELD = "body";
const HELP_ARTICLE_TITLE_FIELD = "title";
const STRING_NOT_FOUND = -1;
const EXCLUDED_HELP_PATH_PATTERNS = ["giveaway", "official-rules"];
const CUBBY_SITE_HOST = "cubbybeds.com";
const CUBBY_PAGE_PATHS_TO_CRAWL = ["/pages/state-requirements"];

type PortalFetchResult = {
  categorySources: PortalSource[];
  chunks: PortalChunk[];
  cubbyPageSources: PortalSource[];
  helpSources: PortalSource[];
};

type HelpArticleFetchResult = {
  chunks: PortalChunk[];
  source: PortalSource;
};

type HelpCategoryFetchResult = {
  articleSources: PortalSource[];
  categorySources: PortalSource[];
};

type SectionDraft = {
  heading: string;
  index: number;
  parts: string[];
  url: string;
};

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function foundIndex(index: number) {
  return index !== STRING_NOT_FOUND;
}

function chunkId(sourceId: string, heading: string, index: number) {
  const slug = slugify(heading, { lower: true, strict: true });
  return `${sourceId}-${slug || "section"}-${index}`;
}

function sourceIdFromHelpUrl(url: string) {
  const pathname = new URL(url).pathname;
  const articleSlug = pathname.split("/").filter(Boolean).at(-1) ?? "article";
  const withoutHash = articleSlug.replace(/-[A-Za-z0-9_]+$/, "");

  return `help-${slugify(withoutHash, { lower: true, strict: true })}`;
}

function canonicalHelpUrl(value: string) {
  const url = new URL(value);

  url.search = "";
  url.hash = "";

  return url.toString();
}

function canonicalCubbyPageUrl(value: string) {
  const url = new URL(value);

  url.search = "";
  url.hash = "";

  return url.toString();
}

function isCrawlableCubbyPageUrl(url: URL) {
  return (
    url.hostname === CUBBY_SITE_HOST &&
    CUBBY_PAGE_PATHS_TO_CRAWL.some((pathname) =>
      url.pathname.startsWith(pathname),
    )
  );
}

function isHelpArticleUrl(url: URL) {
  return (
    url.hostname === HELP_CENTER_HOST &&
    url.pathname.startsWith("/en_us/") &&
    !url.pathname.startsWith("/en_us/categories/") &&
    !EXCLUDED_HELP_PATH_PATTERNS.some((pattern) =>
      url.pathname.toLowerCase().includes(pattern),
    )
  );
}

function isHelpCategoryUrl(url: URL) {
  return (
    url.hostname === HELP_CENTER_HOST &&
    url.pathname.startsWith("/en_us/categories/") &&
    !EXCLUDED_HELP_PATH_PATTERNS.some((pattern) =>
      url.pathname.toLowerCase().includes(pattern),
    )
  );
}

function uniqueByUrl(sources: PortalSource[]) {
  const seen = new Set<string>();

  return sources.filter((source) => {
    if (seen.has(source.url)) {
      return false;
    }

    seen.add(source.url);
    return true;
  });
}

async function fetchHtml(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.text();
}

function collectHelpLinks(source: PortalSource, html: string): PortalSource[] {
  const $ = cheerio.load(html);
  const links: PortalSource[] = [];

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");

    if (!href) {
      return;
    }

    const url = new URL(href, source.url);

    if (!isHelpArticleUrl(url)) {
      return;
    }

    const canonicalUrl = canonicalHelpUrl(url.toString());

    links.push({
      id: sourceIdFromHelpUrl(canonicalUrl),
      title: normalizeText($(element).text()) || "Cubby Help Center Article",
      url: canonicalUrl,
    });
  });

  return uniqueByUrl(links);
}

function collectCubbyPageLinks(source: PortalSource, html: string): PortalSource[] {
  const $ = cheerio.load(html);
  const links: PortalSource[] = [];

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");

    if (!href) {
      return;
    }

    const url = new URL(href, source.url);

    if (!isCrawlableCubbyPageUrl(url)) {
      return;
    }

    const canonicalUrl = canonicalCubbyPageUrl(url.toString());
    const pageSlug = url.pathname.split("/").filter(Boolean).at(-1) ?? "page";

    links.push({
      id: slugify(pageSlug, { lower: true, strict: true }),
      title: normalizeText($(element).text()) || "Cubby Requirements Page",
      url: canonicalUrl,
    });
  });

  return uniqueByUrl(links);
}

function collectHelpCategoryLinks(
  source: PortalSource,
  html: string,
): PortalSource[] {
  const $ = cheerio.load(html);
  const links: PortalSource[] = [];

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");

    if (!href) {
      return;
    }

    const url = new URL(href, source.url);

    if (!isHelpCategoryUrl(url)) {
      return;
    }

    const canonicalUrl = canonicalHelpUrl(url.toString());

    links.push({
      id: sourceIdFromHelpUrl(canonicalUrl),
      title: normalizeText($(element).text()) || "Cubby Help Center Category",
      url: canonicalUrl,
    });
  });

  return uniqueByUrl(links);
}

function collectHelpArticleLinksFromCategory(
  source: PortalSource,
  html: string,
): PortalSource[] {
  const hrefPattern = /&quot;href&quot;:&quot;([^&]+)&quot;/g;
  const links: PortalSource[] = [];

  for (const match of html.matchAll(hrefPattern)) {
    const href = match[1];

    if (!href) {
      continue;
    }

    const url = new URL(href, source.url);

    if (!isHelpArticleUrl(url)) {
      continue;
    }

    const canonicalUrl = canonicalHelpUrl(url.toString());

    links.push({
      id: sourceIdFromHelpUrl(canonicalUrl),
      title: "Cubby Help Center Article",
      url: canonicalUrl,
    });
  }

  return uniqueByUrl(links);
}

function collectHelpCategoryLinksFromCategory(
  source: PortalSource,
  html: string,
): PortalSource[] {
  const hrefPattern = /&quot;href&quot;:&quot;([^&]+)&quot;/g;
  const links: PortalSource[] = [];

  for (const match of html.matchAll(hrefPattern)) {
    const href = match[1];

    if (!href) {
      continue;
    }

    const url = new URL(href, source.url);

    if (!isHelpCategoryUrl(url)) {
      continue;
    }

    const canonicalUrl = canonicalHelpUrl(url.toString());

    links.push({
      id: sourceIdFromHelpUrl(canonicalUrl),
      title: "Cubby Help Center Category",
      url: canonicalUrl,
    });
  }

  return uniqueByUrl(links);
}

function collectChunksFromRoot(
  source: PortalSource,
  $: cheerio.CheerioAPI,
  root: cheerio.Cheerio<Element>,
): PortalChunk[] {
  const chunks: PortalChunk[] = [];
  let current: SectionDraft | undefined;

  function resolveUrl(value: string | undefined) {
    if (!value) {
      return source.url;
    }

    return new URL(value, source.url).toString();
  }

  function flushCurrent() {
    if (!current) {
      return;
    }

    const body = Array.from(new Set(current.parts))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    const text = body || current.heading;

    if (`${current.heading} ${text}`.length < 30) {
      current = undefined;
      return;
    }

    chunks.push({
      id: chunkId(source.id, current.heading, current.index),
      sourceId: source.id,
      pageTitle: source.title,
      sectionTitle: current.heading,
      url: current.url,
      text,
    });

    current = undefined;
  }

  root.find("h1, h2, h3, p, li").each((_, element) => {
    const text = normalizeText($(element).text());

    if (!text) {
      return;
    }

    if ($(element).is(HEADING_SELECTOR)) {
      flushCurrent();
      current = {
        heading: text,
        parts: [],
        index: chunks.length + 1,
        url: resolveUrl($(element).closest("a").attr("href")),
      };
      return;
    }

    if (!current) {
      current = {
        heading: source.title,
        parts: [],
        index: chunks.length + 1,
        url: source.url,
      };
    }

    current.parts.push(text);
  });

  flushCurrent();

  return chunks;
}

function collectPageChunks(source: PortalSource, html: string): PortalChunk[] {
  const $ = cheerio.load(html);
  const main = $("main").first();

  main.find("script, style, noscript, svg, header, footer, nav").remove();

  return collectChunksFromRoot(source, $, main);
}

function decodeEscapedHelpField(html: string, field: string) {
  const marker = `&quot;${field}&quot;:&quot;`;
  const start = html.indexOf(marker);

  if (!foundIndex(start)) {
    return undefined;
  }

  const valueStart = start + marker.length;
  const valueEnd = html.indexOf("&quot;", valueStart);

  if (!foundIndex(valueEnd)) {
    return undefined;
  }

  const escapedValue = html
    .slice(valueStart, valueEnd)
    .replace(/\\&quot;/g, "&quot;");
  const decoder = cheerio.load(`<textarea>${escapedValue}</textarea>`);
  const decodedValue = decoder("textarea").text();

  return decodedValue || undefined;
}

function decodeHelpArticleBody(html: string) {
  const marker = `&quot;${HELP_ARTICLE_BODY_FIELD}&quot;:&quot;`;
  const start = html.indexOf(marker);

  if (!foundIndex(start)) {
    return "";
  }

  const bodyStart = start + marker.length;
  const bodyEnd = html.indexOf("&quot;,&quot;categories", bodyStart);

  if (!foundIndex(bodyEnd)) {
    return "";
  }

  const escapedBody = html.slice(bodyStart, bodyEnd).replace(/\\&quot;/g, "&quot;");
  const decoder = cheerio.load(`<textarea>${escapedBody}</textarea>`);

  return decoder("textarea").text();
}

function decodeHelpArticleTitle(html: string) {
  const decodedTitle = normalizeText(
    decodeEscapedHelpField(html, HELP_ARTICLE_TITLE_FIELD) ?? "",
  );

  if (decodedTitle) {
    return decodedTitle;
  }

  const $ = cheerio.load(html);
  const title = normalizeText($("title").text());

  return title || undefined;
}

function collectHelpArticleChunks(
  source: PortalSource,
  html: string,
): PortalChunk[] {
  const bodyHtml = decodeHelpArticleBody(html);

  if (!bodyHtml) {
    return [];
  }

  const $ = cheerio.load(bodyHtml);
  const body = $("body");

  return collectChunksFromRoot(source, $, body);
}

async function fetchPortalSource(
  source: PortalSource,
): Promise<PortalFetchResult> {
  const html = await fetchHtml(source.url);

  return {
    categorySources: collectHelpCategoryLinks(source, html),
    chunks: collectPageChunks(source, html),
    cubbyPageSources: collectCubbyPageLinks(source, html),
    helpSources: collectHelpLinks(source, html),
  };
}

async function fetchCubbyPage(source: PortalSource): Promise<PortalFetchResult> {
  const html = await fetchHtml(source.url);
  const $ = cheerio.load(html);
  const title = normalizeText($("h1").first().text()) || source.title;
  const resolvedSource = {
    ...source,
    title,
  };

  return {
    categorySources: collectHelpCategoryLinks(resolvedSource, html),
    chunks: collectPageChunks(resolvedSource, html),
    cubbyPageSources: collectCubbyPageLinks(resolvedSource, html),
    helpSources: collectHelpLinks(resolvedSource, html),
  };
}

async function fetchHelpCategoryArticles(
  source: PortalSource,
): Promise<HelpCategoryFetchResult> {
  const html = await fetchHtml(source.url);

  return {
    articleSources: collectHelpArticleLinksFromCategory(source, html),
    categorySources: collectHelpCategoryLinksFromCategory(source, html),
  };
}

async function fetchHelpSource(
  source: PortalSource,
): Promise<HelpArticleFetchResult> {
  const html = await fetchHtml(source.url);
  const title = decodeHelpArticleTitle(html) ?? source.title;
  const resolvedSource = {
    ...source,
    title,
  };

  return {
    source: resolvedSource,
    chunks: collectHelpArticleChunks(resolvedSource, html),
  };
}

async function buildKnowledgeBase(): Promise<PortalKnowledgeBase> {
  const portalResults = await Promise.all(PORTAL_SOURCES.map(fetchPortalSource));
  const discoveredHelpSources = uniqueByUrl(
    portalResults.flatMap((result) => result.helpSources),
  );
  const discoveredCategorySources = uniqueByUrl(
    portalResults.flatMap((result) => result.categorySources),
  );
  const directCubbyPageSources = uniqueByUrl(
    portalResults.flatMap((result) => result.cubbyPageSources),
  );
  const directCubbyPageResults = await Promise.all(
    directCubbyPageSources.map(fetchCubbyPage),
  );
  const nestedCubbyPageSources = uniqueByUrl(
    directCubbyPageResults.flatMap((result) => result.cubbyPageSources),
  );
  const nestedCubbyPageResults = await Promise.all(
    nestedCubbyPageSources
      .filter(
        (source) =>
          !directCubbyPageSources.some(
            (directSource) => directSource.url === source.url,
          ),
      )
      .map(fetchCubbyPage),
  );
  const directCategoryResults = await Promise.all(
    discoveredCategorySources.map(fetchHelpCategoryArticles),
  );
  const nestedCategorySources = uniqueByUrl(
    directCategoryResults.flatMap((result) => result.categorySources),
  );
  const nestedCategoryResults = await Promise.all(
    nestedCategorySources.map(fetchHelpCategoryArticles),
  );
  const categoryArticleSources = uniqueByUrl(
    [...directCategoryResults, ...nestedCategoryResults].flatMap(
      (result) => result.articleSources,
    ),
  );
  const allHelpSources = uniqueByUrl([
    ...discoveredHelpSources,
    ...categoryArticleSources,
  ]);
  const helpResults = await Promise.all(
    allHelpSources.map(fetchHelpSource),
  );
  const sources = [
    ...PORTAL_SOURCES,
    ...uniqueByUrl([
      ...directCubbyPageSources,
      ...nestedCubbyPageSources,
    ]),
    ...helpResults
      .filter((result) => result.chunks.length > 0)
      .map((result) => result.source),
  ];
  const chunks = [
    ...portalResults.flatMap((result) => result.chunks),
    ...directCubbyPageResults.flatMap((result) => result.chunks),
    ...nestedCubbyPageResults.flatMap((result) => result.chunks),
    ...helpResults.flatMap((result) => result.chunks),
  ];
  return {
    generatedAt: new Date().toISOString(),
    sources,
    chunks,
  };
}

async function main() {
  const knowledgeBase = await buildKnowledgeBase();

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(knowledgeBase, null, 2)}\n`);

  console.log(
    `Wrote ${knowledgeBase.chunks.length} section chunks from ${knowledgeBase.sources.length} sources to ${OUTPUT_PATH}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
