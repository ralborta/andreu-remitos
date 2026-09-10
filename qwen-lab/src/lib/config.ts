export const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL?.replace(/\/$/, "") || "http://100.72.79.37:11434";

export const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:1.5b";

export const LAB_TITLE = process.env.LAB_TITLE || "Qwen Lab";
export const LAB_HOST_LABEL = process.env.LAB_HOST_LABEL || "Empliados LLM Server";
