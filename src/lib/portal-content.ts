export type PortalSource = {
  id: string;
  title: string;
  url: string;
};

export type PortalChunk = {
  id: string;
  sourceId: string;
  pageTitle: string;
  sectionTitle: string;
  url: string;
  text: string;
};

export type PortalKnowledgeBase = {
  generatedAt: string;
  sources: PortalSource[];
  chunks: PortalChunk[];
};
