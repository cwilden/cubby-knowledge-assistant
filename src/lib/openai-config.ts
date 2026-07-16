import OpenAI from "openai";

const OPENAI_ENV = {
  apiKey: "OPENAI_API_KEY",
  classifierModel: "OPENAI_CLASSIFIER_MODEL",
  answerModel: "OPENAI_MODEL",
} as const;

const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";

export function hasOpenAIKey() {
  return Boolean(process.env[OPENAI_ENV.apiKey]);
}

export function openAIClient() {
  return new OpenAI({
    apiKey: process.env[OPENAI_ENV.apiKey],
  });
}

export function answerModel() {
  return process.env[OPENAI_ENV.answerModel] ?? DEFAULT_OPENAI_MODEL;
}

export function classifierModel() {
  return (
    process.env[OPENAI_ENV.classifierModel] ??
    process.env[OPENAI_ENV.answerModel] ??
    DEFAULT_OPENAI_MODEL
  );
}
