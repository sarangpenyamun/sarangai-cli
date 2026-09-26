export interface CodingModel {
  id: string;
  alias: string;
  name: string;
  role: string;
  description: string;
  maxTokens: number;
}

export const LOCKED_CODING_MODELS: Record<string, CodingModel> = {
  glm: {
    id: "z-ai/glm-5.3-flash",
    alias: "glm",
    name: "GLM 5.3 Flash",
    role: "Rapid Scaffolder",
    description: "Instant execution for boilerplate scaffolding, refactoring, and automation scripting.",
    maxTokens: 4096,
  },
  sonnet: {
    id: "anthropic/claude-sonnet-4.6",
    alias: "sonnet",
    name: "Claude Sonnet 4.6",
    role: "Deep Architect & Refactor",
    description: "Architecture design, systematic refactoring, and enterprise-grade clean code.",
    maxTokens: 8192,
  },
  luna: {
    id: "openai/gpt-5.6-luna",
    alias: "luna",
    name: "GPT-5.6 Luna",
    role: "Fast Precision & Fixer",
    description: "Multi-file analysis, edge-case bug fixing, and strict logic verification.",
    maxTokens: 8192,
  },
  deepseek: {
    id: "deepseek/deepseek-v3.2",
    alias: "deepseek",
    name: "DeepSeek V3.2",
    role: "Logic & Algorithm Engineer",
    description: "Performance optimization, high-precision syntax, and algorithm efficiency.",
    maxTokens: 8192,
  },
  mimo: {
    id: "xiaomi/mimo-v2.5-pro",
    alias: "mimo",
    name: "MiMo V2.5 Pro",
    role: "Fullstack & Multimodal Agent",
    description: "Terminal log inspection, stack trace analysis, and build script automation.",
    maxTokens: 4096,
  },
};

export const DEFAULT_CODING_MODEL = LOCKED_CODING_MODELS.glm.id;

/** Daftar alias untuk pesan error, mis. "glm, sonnet, luna, deepseek, mimo". */
export const MODEL_ALIAS_LIST = Object.keys(LOCKED_CODING_MODELS).join(', ');

/**
 * Cari model persis berdasar alias / nama / id (case-insensitive).
 * Mengembalikan NULL bila tidak cocok — TIDAK ada fallback diam-diam.
 */
export function findModel(input?: string): CodingModel | null {
  if (!input) return null;
  const q = input.trim().toLowerCase();
  if (!q) return null;
  return (
    Object.values(LOCKED_CODING_MODELS).find(
      (m) =>
        m.alias.toLowerCase() === q ||
        m.name.toLowerCase() === q ||
        m.id.toLowerCase() === q,
    ) ?? null
  );
}

/** Untuk default (flag CLI -m / konfigurasi): fallback ke glm bila tak cocok. */
export function resolveModel(input?: string): CodingModel {
  return findModel(input) ?? LOCKED_CODING_MODELS.glm;
}
