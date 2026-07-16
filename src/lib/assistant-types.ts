import type { AssistantStatus } from "./assistant-status";

export type AssistantCitation = {
  excerpt: string;
  id: string;
  title: string;
  section: string;
  url: string;
};

export type AssistantResponse = {
  status: AssistantStatus;
  answer: string;
  citations: AssistantCitation[];
};
