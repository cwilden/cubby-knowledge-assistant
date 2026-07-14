import * as cheerio from "cheerio";
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

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function chunkId(sourceId: string, heading: string, index: number) {
  const slug = slugify(heading, { lower: true, strict: true });
  return `${sourceId}-${slug || "section"}-${index}`;
}

function collectPageChunks(source: PortalSource, html: string): PortalChunk[] {
  const $ = cheerio.load(html);
  const main = $("main").first();

  main.find("script, style, noscript, svg, header, footer, nav").remove();

  const chunks: PortalChunk[] = [];
  let current:
    | {
        heading: string;
        parts: string[];
        index: number;
        url: string;
      }
    | undefined;

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

  main.find("h1, h2, h3, p, li").each((_, element) => {
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

async function fetchSource(source: PortalSource) {
  const response = await fetch(source.url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${source.url}: ${response.status}`);
  }

  const html = await response.text();
  return collectPageChunks(source, html);
}

async function main() {
  const chunks = (await Promise.all(PORTAL_SOURCES.map(fetchSource))).flat();
  const knowledgeBase: PortalKnowledgeBase = {
    generatedAt: new Date().toISOString(),
    sources: PORTAL_SOURCES,
    chunks,
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(knowledgeBase, null, 2)}\n`);

  console.log(
    `Wrote ${chunks.length} section chunks from ${PORTAL_SOURCES.length} sources to ${OUTPUT_PATH}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
